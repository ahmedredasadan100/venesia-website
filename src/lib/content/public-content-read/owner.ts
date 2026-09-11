import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import {
  CONTENT_TYPES,
  isContentType,
  type ContentType,
} from "../../admin/content/content-types";
import {
  buildAdminCategoryTree,
  flattenAdminCategoryTree,
  getCategoryAndDescendantIds,
  type AdminContentCategory,
} from "../../admin/content/category-hierarchy";
import {
  normalizeYouTubeUrl,
  parseMediaTopicPayload,
  validateGalleryPayload,
  validateVideoPayload,
} from "../../admin/media-topic-payload";
import { formatArabicContentDate } from "../../content-dates";
import type { Json } from "../../database.types";
import { logError } from "../../logging";
import { resolveLocalPublicImage } from "../../media/resolve-local-public-image";
import { getSupabaseAdmin } from "../../supabase-admin";
import { estimateReadingTimeLabel } from "../reading-time";
import { resolvePublicContentPath } from "../public-content-path";
import {
  applyPublicContentTextSearch,
  normalizePublicContentCollectionInput,
  PUBLIC_CONTENT_COLLECTION_MAX_PAGE_SIZE,
  type PublicContentCollectionInput,
  type PublicContentCollectionResult,
  type PublicContentFeedCategory,
  type PublicContentFeedSeries,
  type PublicContentFeedTaxonomyInput,
  type PublicContentSummary,
  type PublicContentTextSearchQuery,
} from "./contract";

const PUBLIC_CONTENT_CACHE_TAG = "public-content";
const ARTICLE_IMAGE_FALLBACK = "/images/topics/default.jpg";
const MEDIA_IMAGE_FALLBACK = "/images/venesia-5.png";

/** Exact projection for every Public Collection read. Body and SEO fields are excluded. */
export const PUBLIC_CONTENT_COLLECTION_SELECT =
  "id, slug, title, excerpt, image, image_alt, category, category_slug, series, series_slug, date_label, published_at, content_type, is_featured, is_popular, views_count, media_kind:media_payload->>kind, media_duration:media_payload->>duration, media_thumbnail:media_payload->>thumbnail, media_gallery_cover:media_payload->images->0->>url, media_gallery_cover_alt:media_payload->images->0->>alt, media_project, show_title_on_page, show_image_on_page, show_excerpt_on_page, show_date_on_page, show_category_on_page, show_series_on_page, show_intro_card_on_page";

/** Exact projection for one public detail. Collection consumers never receive these fields. */
export const PUBLIC_CONTENT_DETAIL_SELECT =
  "id, slug, title, excerpt, content, image, image_alt, category, category_slug, series, series_slug, date_label, published_at, content_type, is_featured, is_popular, views_count, media_payload, media_project, seo_title, seo_description, seo_keywords, focus_keyword, canonical_url, robots_index, robots_follow, og_image, og_image_alt, faq, show_title_on_page, show_image_on_page, show_excerpt_on_page, show_date_on_page, show_category_on_page, show_series_on_page, show_intro_card_on_page, show_faq_on_page, show_faq_title_on_page";

/** Exact projection for sitemap generation. It avoids loading card, body, and rich-media data. */
export const PUBLIC_CONTENT_SITEMAP_SELECT =
  "id, slug, content_type, published_at, updated_at, is_featured, canonical_url, robots_index";

export class PublicContentReadError extends Error {
  readonly code: "query_failed" | "contract_failed";

  constructor(code: PublicContentReadError["code"], message: string) {
    super(message);
    this.name = "PublicContentReadError";
    this.code = code;
  }
}

type PublicContentReadFailure = {
  context: string;
  error: unknown;
  details?: Record<string, unknown>;
};

function failPublicContentRead(
  code: PublicContentReadError["code"],
  ...failures: PublicContentReadFailure[]
): never {
  for (const failure of failures) {
    logError(failure.context, failure.error, failure.details ?? {});
  }

  throw new PublicContentReadError(
    code,
    code === "query_failed"
      ? "تعذر تحميل المحتوى العام حاليًا."
      : "تعذر تجهيز المحتوى العام للعرض.",
  );
}

type PublicContentRow = {
  id: number | string;
  slug: string | null;
  title: string | null;
  excerpt: string | null;
  content?: string | null;
  image: string | null;
  image_alt: string | null;
  category: string | null;
  category_slug: string | null;
  series: string | null;
  series_slug: string | null;
  date_label: string | null;
  published_at: string | null;
  updated_at?: string | null;
  content_type: string | null;
  is_featured: boolean | null;
  is_popular: boolean | null;
  views_count: number | null;
  media_payload?: Json | null;
  media_kind?: string | null;
  media_duration?: string | null;
  media_thumbnail?: string | null;
  media_gallery_cover?: string | null;
  media_gallery_cover_alt?: string | null;
  media_project: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string[] | null;
  focus_keyword?: string | null;
  canonical_url?: string | null;
  robots_index?: boolean | null;
  robots_follow?: boolean | null;
  og_image?: string | null;
  og_image_alt?: string | null;
  faq?: Json;
  show_title_on_page?: boolean | null;
  show_image_on_page?: boolean | null;
  show_excerpt_on_page?: boolean | null;
  show_date_on_page?: boolean | null;
  show_category_on_page?: boolean | null;
  show_series_on_page?: boolean | null;
  show_intro_card_on_page?: boolean | null;
  show_faq_on_page?: boolean | null;
  show_faq_title_on_page?: boolean | null;
};

export type PublicContentDetail = PublicContentSummary & {
  content: string;
  metadataImage: string;
  ogImage: string;
  ogImageAlt: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  focusKeyword: string;
  canonicalUrl: string;
  robotsIndex: boolean | null;
  robotsFollow: boolean | null;
  faq: Array<{ question: string; answer: string }>;
  showFaqOnPage: boolean;
  showFaqTitleOnPage: boolean;
  readingTime: string;
  videoUrl: string;
  videoDuration: string;
  galleryImages: Array<{ url: string; alt?: string | null; caption?: string | null }>;
};

export type PublicContentSitemapRow = {
  id: number;
  contentType: ContentType;
  slug: string;
  href: string;
  publishedAt: string;
  updatedAt: string;
  isFeatured: boolean;
  canonicalUrl: string;
  robotsIndex: boolean | null;
};

export type PublicContentFilterOption = {
  slug: string;
  name: string;
};

export type PublicContentFilterOptions = {
  categories: PublicContentFilterOption[];
  series: PublicContentFilterOption[];
};

export async function loadPublicContentFilterOptions(): Promise<PublicContentFilterOptions> {
  return unstable_cache(async () => {
    const supabase = getSupabaseAdmin();
    const [categoriesResult, seriesResult] = await Promise.all([
      supabase
        .from("topic_categories")
        .select("slug,name")
        .eq("status", "published")
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("topic_series")
        .select("slug,name")
        .eq("status", "published")
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
    ]);

    const queryFailures: PublicContentReadFailure[] = [];
    if (categoriesResult.error) {
      queryFailures.push({
        context: "Public Content category filter options query failed",
        error: categoriesResult.error,
      });
    }
    if (seriesResult.error) {
      queryFailures.push({
        context: "Public Content series filter options query failed",
        error: seriesResult.error,
      });
    }
    if (queryFailures.length) {
      failPublicContentRead("query_failed", ...queryFailures);
    }

    const normalizeOptions = (
      rows: readonly { slug: string | null; name: string | null }[] | null,
      source: "category" | "series",
    ) => {
      if (rows === null) {
        failPublicContentRead("contract_failed", {
          context: `Public Content ${source} filter options returned null data`,
          error: new Error(
            "Public Content filter options do not satisfy the read contract.",
          ),
        });
      }

      return rows.map((row) => {
        const slug = row.slug?.trim() ?? "";
        const name = row.name?.trim() ?? "";
        if (!slug || !name) {
          failPublicContentRead("contract_failed", {
            context: `Public Content ${source} filter option is invalid`,
            error: new Error(
              "Public Content filter option does not satisfy the read contract.",
            ),
            details: { slug: row.slug, name: row.name },
          });
        }
        return { slug, name };
      });
    };

    return {
      categories: normalizeOptions(categoriesResult.data, "category"),
      series: normalizeOptions(seriesResult.data, "series"),
    };
  }, ["public-content-filter-options"], {
    revalidate: 300,
    tags: [PUBLIC_CONTENT_CACHE_TAG],
  })();
}

function mapCollectionRow(row: PublicContentRow): PublicContentSummary {
  if (!isContentType(row.content_type)) {
    failPublicContentRead("contract_failed", {
      context: "Public Content collection row has an invalid content type",
      error: new Error("Public Content row does not satisfy the collection contract."),
      details: { rowId: row.id, contentType: row.content_type },
    });
  }
  const id = Number(row.id);
  const slug = row.slug?.trim() ?? "";
  if (!Number.isInteger(id) || !slug) {
    failPublicContentRead("contract_failed", {
      context: "Public Content collection row has an invalid identity",
      error: new Error("Public Content row does not satisfy the collection contract."),
      details: { rowId: row.id, contentType: row.content_type, slug: row.slug },
    });
  }

  const mediaPayload = parseMediaTopicPayload(row.media_payload);
  const projectedMediaKind = row.media_kind?.trim() ?? "";
  if (
    projectedMediaKind &&
    projectedMediaKind !== "video" &&
    projectedMediaKind !== "gallery"
  ) {
    failPublicContentRead("contract_failed", {
      context: "Public Content row has an invalid Rich Media kind",
      error: new Error("Public Content Rich Media does not satisfy the read contract."),
      details: { rowId: row.id, contentType: row.content_type },
    });
  }
  const mediaKind = row.media_kind === "video" || row.media_kind === "gallery"
    ? row.media_kind
    : mediaPayload?.kind ?? null;
  const explicitImage = row.image?.trim() ?? "";
  const galleryCover = row.media_gallery_cover?.trim() || (
    mediaPayload?.kind === "gallery" ? mediaPayload.images[0]?.url?.trim() : ""
  );
  const galleryCoverAlt = row.media_gallery_cover_alt?.trim() || (
    mediaPayload?.kind === "gallery" ? mediaPayload.images[0]?.alt?.trim() : ""
  );
  const videoThumbnail = row.media_thumbnail?.trim() || (
    mediaPayload?.kind === "video" ? mediaPayload.thumbnail?.trim() : ""
  );
  const payloadImage = mediaKind === "gallery"
    ? galleryCover
    : mediaKind === "video"
      ? videoThumbnail
      : "";

  const expectedMediaKind = row.content_type === "video" || row.content_type === "gallery"
    ? row.content_type
    : null;
  if (mediaKind !== expectedMediaKind) {
    failPublicContentRead("contract_failed", {
      context: "Public Content row has mismatched Rich Media data",
      error: new Error("Public Content Rich Media does not satisfy the read contract."),
      details: {
        rowId: row.id,
        contentType: row.content_type,
        mediaKind,
      },
    });
  }
  if (mediaKind === "gallery" && !galleryCover) {
    failPublicContentRead("contract_failed", {
      context: "Public Content Gallery has no valid cover contract",
      error: new Error("Public Content Gallery does not satisfy the read contract."),
      details: { rowId: row.id, contentType: row.content_type },
    });
  }

  const resolvedImage = payloadImage || explicitImage;
  const mediaDuration = row.media_duration ?? (
    mediaPayload?.kind === "video" ? mediaPayload.duration : ""
  );
  const fallback = row.content_type === "article"
    ? ARTICLE_IMAGE_FALLBACK
    : MEDIA_IMAGE_FALLBACK;
  const authoredImageAlt = row.image_alt?.trim() ?? "";
  const title = row.title ?? "";
  const imageAlt = resolvedImage === galleryCover && mediaKind === "gallery" && galleryCover
    ? galleryCoverAlt || authoredImageAlt || title
    : authoredImageAlt || title;

  return {
    id,
    contentType: row.content_type,
    slug,
    href: resolvePublicContentPath(row.content_type, slug),
    title,
    excerpt: row.excerpt ?? "",
    image: resolveLocalPublicImage(resolvedImage, fallback),
    imageAlt,
    category: row.category ?? "",
    categorySlug: row.category_slug ?? "",
    series: row.series ?? "",
    seriesSlug: row.series_slug ?? "",
    date: row.date_label || formatArabicContentDate(row.published_at ?? "") || "",
    publishedAt: row.published_at ?? "",
    isFeatured: Boolean(row.is_featured),
    isPopular: Boolean(row.is_popular),
    viewsCount: Math.max(0, Number(row.views_count) || 0),
    mediaProject: row.media_project?.trim() ?? "",
    mediaKind,
    mediaDuration: mediaDuration?.trim() ?? "",
    display: {
      title: row.show_title_on_page !== false,
      image: row.show_image_on_page !== false,
      excerpt: row.show_excerpt_on_page !== false,
      date: row.show_date_on_page !== false,
      category: row.show_category_on_page !== false,
      series: row.show_series_on_page !== false,
      introCard: row.show_intro_card_on_page !== false,
    },
  };
}

function mapCollectionRows(
  value: readonly PublicContentRow[] | null,
): PublicContentSummary[] {
  if (value === null) {
    failPublicContentRead("contract_failed", {
      context: "Public Content collection query returned null data without an error",
      error: new Error("Public Content collection data does not satisfy the read contract."),
    });
  }

  return value.map(mapCollectionRow);
}

interface PublicContentFilterQuery extends PublicContentTextSearchQuery {
  in(column: "content_type", values: readonly ContentType[]): this;
  in(column: "id", values: readonly number[]): this;
  in(column: "category_slug" | "series_slug", values: readonly string[]): this;
  eq(column: "status" | "series_slug", value: string): this;
  eq(column: "is_featured" | "is_popular", value: boolean): this;
  is(column: "deleted_at", value: null): this;
  not(column: "slug", operator: "like", value: string): this;
  neq(column: "id", value: number): this;
}

function applyPublicFilters<Query extends PublicContentFilterQuery>(
  query: Query,
  input: ReturnType<typeof normalizePublicContentCollectionInput>,
): Query {
  let next = query
    .in("content_type", input.contentTypes)
    .eq("status", "published")
    .is("deleted_at", null)
    .not("slug", "like", "e2e-test%");

  if (input.categorySlugs.length) next = next.in("category_slug", input.categorySlugs);
  if (input.includeIds.length) next = next.in("id", input.includeIds);
  if (input.seriesSlug) next = next.eq("series_slug", input.seriesSlug);
  if (input.seriesSlugs.length) next = next.in("series_slug", input.seriesSlugs);
  if (input.featured === "only") next = next.eq("is_featured", true);
  if (input.popularOnly) next = next.eq("is_popular", true);
  for (const id of input.excludeIds) next = next.neq("id", id);

  const related = [
    input.relatedTo.categorySlug ? `category_slug.eq.${input.relatedTo.categorySlug}` : "",
    input.relatedTo.seriesSlug ? `series_slug.eq.${input.relatedTo.seriesSlug}` : "",
  ].filter(Boolean);
  if (related.length) next = next.or(related.join(","));

  return applyPublicContentTextSearch(next, input.search);
}

async function queryPublishedPublicCategories() {
  const { data, error } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id,name,slug,parent_id,sort_order,is_active,status")
    .eq("status", "published")
    .is("deleted_at", null);

  if (error) {
    failPublicContentRead("query_failed", {
      context: "Public Content category hierarchy query failed",
      error,
    });
  }
  if (data === null) {
    failPublicContentRead("contract_failed", {
      context: "Public Content category hierarchy query returned null data",
      error: new Error("Public Content category hierarchy data does not satisfy the read contract."),
    });
  }

  return data as AdminContentCategory[];
}

const loadPublishedPublicCategories = cache(
  async function loadPublishedPublicCategories() {
    return unstable_cache(
      queryPublishedPublicCategories,
      ["public-content-category-hierarchy"],
      { revalidate: 300, tags: [PUBLIC_CONTENT_CACHE_TAG] },
    )();
  },
);

async function expandPublicCategoryHierarchy(categorySlugs: readonly string[]) {
  if (!categorySlugs.length) return [];

  const categories = await loadPublishedPublicCategories();
  const selectedIds = new Set(
    categories
      .filter((category) => categorySlugs.includes(category.slug))
      .map((category) => category.id),
  );
  const scopedIds = new Set(
    [...selectedIds].flatMap((categoryId) =>
      getCategoryAndDescendantIds(categories, categoryId),
    ),
  );
  const resolved = categories
    .filter((category) => scopedIds.has(category.id))
    .map((category) => category.slug);

  return [...new Set([...categorySlugs, ...resolved])];
}

function normalizeFeedTaxonomyInput(input: PublicContentFeedTaxonomyInput) {
  const normalized = normalizePublicContentCollectionInput({
    contentTypes: ["article"],
    page: 1,
    pageSize: input.limit,
    categorySlugs: input.categorySlugs,
    seriesSlugs: input.seriesSlugs,
  });

  return {
    limit: Math.min(normalized.pageSize, PUBLIC_CONTENT_COLLECTION_MAX_PAGE_SIZE),
    categorySlugs: normalized.categorySlugs,
    seriesSlugs: normalized.seriesSlugs,
  };
}

async function countPublicArticlesForCategory(
  categories: readonly AdminContentCategory[],
  categoryId: number,
  seriesSlugs: readonly string[],
) {
  const descendantIds = new Set(
    getCategoryAndDescendantIds([...categories], categoryId),
  );
  const categorySlugs = categories
    .filter((category) => descendantIds.has(category.id))
    .map((category) => category.slug);

  let query = getSupabaseAdmin()
    .from("topics")
    .select("id", { count: "exact", head: true })
    .eq("content_type", "article")
    .eq("status", "published")
    .is("deleted_at", null)
    .not("slug", "like", "e2e-test%")
    .in("category_slug", categorySlugs);

  if (seriesSlugs.length) query = query.in("series_slug", seriesSlugs);

  const { count, error } = await query;
  if (error) {
    failPublicContentRead("query_failed", {
      context: "Public Content Feed category count query failed",
      error,
      details: { categoryId, categorySlugs, seriesSlugs },
    });
  }
  if (!Number.isInteger(count) || Number(count) < 0) {
    failPublicContentRead("contract_failed", {
      context: "Public Content Feed category count is invalid",
      error: new Error("Public Content Feed category count does not satisfy the read contract."),
      details: { categoryId, count },
    });
  }

  return Number(count);
}

async function queryPublicContentFeedCategories(
  input: ReturnType<typeof normalizeFeedTaxonomyInput>,
): Promise<PublicContentFeedCategory[]> {
  const categories = await loadPublishedPublicCategories();
  const ordered = flattenAdminCategoryTree(
    buildAdminCategoryTree([...categories]),
  );
  const requestedSlugs = new Set(input.categorySlugs);
  let selectedSeriesCategoryIds = new Set<number>();
  if (input.seriesSlugs.length) {
    const { data, error } = await getSupabaseAdmin()
      .from("topic_series")
      .select("category_id")
      .in("slug", input.seriesSlugs)
      .eq("status", "published")
      .is("deleted_at", null);
    if (error) {
      failPublicContentRead("query_failed", {
        context: "Public Content Feed category series scope query failed",
        error,
        details: { seriesSlugs: input.seriesSlugs },
      });
    }
    if (data === null) {
      failPublicContentRead("contract_failed", {
        context: "Public Content Feed category series scope returned null data",
        error: new Error("Public Content Feed series scope does not satisfy the read contract."),
        details: { seriesSlugs: input.seriesSlugs },
      });
    }
    selectedSeriesCategoryIds = new Set(
      data.flatMap((row) => row.category_id === null ? [] : [row.category_id]),
    );
  }

  const selected = ordered.filter((category) => {
    if (requestedSlugs.size && !requestedSlugs.has(category.slug)) return false;
    if (!input.seriesSlugs.length) return true;
    const descendantIds = getCategoryAndDescendantIds(categories, category.id);
    return descendantIds.some((id) => selectedSeriesCategoryIds.has(id));
  }).slice(0, input.limit);

  return Promise.all(selected.map(async (category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    count: await countPublicArticlesForCategory(
      categories,
      category.id,
      input.seriesSlugs,
    ),
  })));
}

export async function loadPublicContentFeedCategories(
  rawInput: PublicContentFeedTaxonomyInput,
): Promise<PublicContentFeedCategory[]> {
  const input = normalizeFeedTaxonomyInput(rawInput);
  return unstable_cache(
    () => queryPublicContentFeedCategories(input),
    ["public-content-feed-categories", JSON.stringify(input)],
    { revalidate: 300, tags: [PUBLIC_CONTENT_CACHE_TAG] },
  )();
}

async function queryPublicContentFeedSeries(
  input: ReturnType<typeof normalizeFeedTaxonomyInput>,
): Promise<PublicContentFeedSeries[]> {
  const categories = await loadPublishedPublicCategories();
  const categoryIdsBySlug = new Map(
    categories.map((category) => [category.slug, category.id] as const),
  );
  const scopedCategoryIds = new Set(
    input.categorySlugs.flatMap((slug) => {
      const categoryId = categoryIdsBySlug.get(slug);
      return categoryId === undefined
        ? []
        : getCategoryAndDescendantIds(categories, categoryId);
    }),
  );

  let query = getSupabaseAdmin()
    .from("topic_series")
    .select("id,name,slug,description,category_id")
    .eq("status", "published")
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (input.categorySlugs.length) {
    if (!scopedCategoryIds.size) return [];
    query = query.in("category_id", [...scopedCategoryIds]);
  }
  if (input.seriesSlugs.length) query = query.in("slug", input.seriesSlugs);

  const { data, error } = await query.limit(input.limit);
  if (error) {
    failPublicContentRead("query_failed", {
      context: "Public Content Feed series query failed",
      error,
      details: input,
    });
  }
  if (data === null) {
    failPublicContentRead("contract_failed", {
      context: "Public Content Feed series query returned null data",
      error: new Error("Public Content Feed series data does not satisfy the read contract."),
      details: input,
    });
  }

  return Promise.all(data.map(async (row) => {
    const representative = await loadPublicContentCollection({
      contentTypes: ["article"],
      seriesSlug: row.slug,
      page: 1,
      pageSize: 1,
      sort: "newest",
    });

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? "",
      categoryId: row.category_id,
      representative: representative.items[0] ?? null,
    };
  }));
}

export async function loadPublicContentFeedSeries(
  rawInput: PublicContentFeedTaxonomyInput,
): Promise<PublicContentFeedSeries[]> {
  const input = normalizeFeedTaxonomyInput(rawInput);
  return unstable_cache(
    () => queryPublicContentFeedSeries(input),
    ["public-content-feed-series", JSON.stringify(input)],
    { revalidate: 300, tags: [PUBLIC_CONTENT_CACHE_TAG] },
  )();
}

function buildCollectionQuery(
  input: ReturnType<typeof normalizePublicContentCollectionInput>,
  includeCount = false,
) {
  const selected = getSupabaseAdmin()
    .from("topics")
    .select(PUBLIC_CONTENT_COLLECTION_SELECT, includeCount ? { count: "exact" } : undefined);

  const filtered = applyPublicFilters(selected, input);
  if (input.sort === "most-viewed") {
    return filtered
      .order("views_count", { ascending: false })
      .order("published_at", { ascending: false })
      .order("id", { ascending: false });
  }

  return filtered
    .order("published_at", { ascending: input.sort === "oldest" })
    .order("id", { ascending: input.sort === "oldest" });
}

async function resolveFeaturedSelection(
  input: ReturnType<typeof normalizePublicContentCollectionInput>,
) {
  const selection = input.featuredSelection;
  if (!selection) return null;

  if (selection.mode === "manual") {
    const manualResult = await buildCollectionQuery({
      ...input,
      featured: "none",
      excludeIds: [],
    })
      .eq("id", selection.topicId)
      .limit(1);
    if (manualResult.error) {
      failPublicContentRead("query_failed", {
        context: "Public Content manual featured query failed",
        error: manualResult.error,
        details: {
          contentTypes: input.contentTypes,
          featuredTopicId: selection.topicId,
        },
      });
    }
    return mapCollectionRows(manualResult.data)[0] ?? null;
  }

  const featuredInput = { ...input, featured: "only" as const, excludeIds: [] };
  const featuredResult = await buildCollectionQuery(featuredInput).limit(1);
  if (featuredResult.error) {
    failPublicContentRead("query_failed", {
      context: "Public Content featured query failed",
      error: featuredResult.error,
      details: { contentTypes: input.contentTypes },
    });
  }

  return mapCollectionRows(featuredResult.data)[0] ?? null;
}

function emptyCollection(
  input: ReturnType<typeof normalizePublicContentCollectionInput>,
  featured: PublicContentSummary | null = null,
): PublicContentCollectionResult {
  return {
    featured,
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: input.pageSize,
    totalPages: 1,
    startIndex: 0,
    endIndex: 0,
  };
}

async function queryPublicContentCollection(
  rawInput: PublicContentCollectionInput,
): Promise<PublicContentCollectionResult> {
  const normalizedInput = normalizePublicContentCollectionInput(rawInput);
  const input = {
    ...normalizedInput,
    categorySlugs: await expandPublicCategoryHierarchy(
      normalizedInput.categorySlugs,
    ),
  };
  if (!input.contentTypes.length) return emptyCollection(input);

  const featured = input.featuredSelection
    ? await resolveFeaturedSelection(input)
    : null;
  const listInput = featured
    ? { ...input, featured: "none" as const, excludeIds: [...input.excludeIds, featured.id] }
    : input;
  const requestedFrom = (listInput.page - 1) * listInput.pageSize;

  let result = await buildCollectionQuery(listInput, true)
    .range(requestedFrom, requestedFrom + listInput.pageSize - 1);
  if (result.error) {
    failPublicContentRead("query_failed", {
      context: "Public Content collection query failed",
      error: result.error,
      details: {
        contentTypes: input.contentTypes,
        page: input.page,
      },
    });
  }

  if (!Number.isInteger(result.count) || Number(result.count) < 0) {
    failPublicContentRead("contract_failed", {
      context: "Public Content collection query returned an invalid count",
      error: new Error("Public Content collection count does not satisfy the read contract."),
      details: { contentTypes: input.contentTypes, count: result.count },
    });
  }
  const totalCount = Number(result.count);
  const totalPages = Math.max(1, Math.ceil(totalCount / listInput.pageSize));
  const page = Math.min(listInput.page, totalPages);
  const startIndex = totalCount === 0 ? 0 : (page - 1) * listInput.pageSize;

  if (page !== listInput.page && totalCount > 0) {
    result = await buildCollectionQuery(listInput)
      .range(startIndex, startIndex + listInput.pageSize - 1);
    if (result.error) {
      failPublicContentRead("query_failed", {
        context: "Public Content normalized-page query failed",
        error: result.error,
        details: { contentTypes: input.contentTypes, page },
      });
    }
  }

  const items = mapCollectionRows(result.data);
  return {
    featured,
    items,
    totalCount,
    page,
    pageSize: listInput.pageSize,
    totalPages,
    startIndex,
    endIndex: Math.min(startIndex + items.length, totalCount),
  };
}

function collectionCacheKey(input: PublicContentCollectionInput) {
  const normalized = normalizePublicContentCollectionInput(input);
  return JSON.stringify(normalized);
}

export async function loadPublicContentCollection(
  input: PublicContentCollectionInput,
): Promise<PublicContentCollectionResult> {
  const normalized = normalizePublicContentCollectionInput(input);
  if (normalized.search) return queryPublicContentCollection(normalized);

  return unstable_cache(
    () => queryPublicContentCollection(normalized),
    ["public-content-collection", collectionCacheKey(normalized)],
    { revalidate: 300, tags: [PUBLIC_CONTENT_CACHE_TAG] },
  )();
}

function normalizeFaq(value: Json | undefined): Array<{ question: string; answer: string }> {
  if (!Array.isArray(value)) return [];

  const faq: Array<{ question: string; answer: string }> = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    if (typeof item.question !== "string" || typeof item.answer !== "string") {
      return [];
    }
    const question = item.question.trim();
    const answer = item.answer.trim();
    if (!question || !answer) return [];
    faq.push({ question, answer });
  }
  return faq;
}

function mapDetailRow(row: PublicContentRow): PublicContentDetail {
  const summary = mapCollectionRow(row);
  const payload = parseMediaTopicPayload(row.media_payload);
  const video = payload?.kind === "video" ? payload : null;
  const gallery = payload?.kind === "gallery" ? payload : null;
  const videoError = video
    ? validateVideoPayload(video, { published: true })
    : summary.contentType === "video"
      ? "بيانات الفيديو المنشورة غير صالحة."
      : null;
  const galleryError = gallery
    ? validateGalleryPayload(gallery, { published: true }) ||
      (gallery.images.some((image) => !image.url.trim())
        ? "بيانات صور المعرض المنشور غير مكتملة."
        : null)
    : summary.contentType === "gallery"
      ? "بيانات معرض الصور المنشور غير صالحة."
      : null;

  if (videoError || galleryError) {
    failPublicContentRead("contract_failed", {
      context: "Public Content detail has invalid published Rich Media",
      error: new Error(videoError ?? galleryError ?? "Invalid Rich Media."),
      details: { rowId: row.id, contentType: row.content_type },
    });
  }
  const normalizedVideoUrl = normalizeYouTubeUrl(video?.video_url ?? "");

  return {
    ...summary,
    content: row.content ?? "",
    metadataImage: resolveLocalPublicImage(row.image, ""),
    ogImage: resolveLocalPublicImage(row.og_image, ""),
    ogImageAlt: row.og_image_alt ?? "",
    seoTitle: row.seo_title ?? "",
    seoDescription: row.seo_description ?? "",
    seoKeywords: Array.isArray(row.seo_keywords) ? row.seo_keywords : [],
    focusKeyword: row.focus_keyword ?? "",
    canonicalUrl: row.canonical_url ?? "",
    robotsIndex: row.robots_index ?? null,
    robotsFollow: row.robots_follow ?? null,
    faq: normalizeFaq(row.faq),
    showFaqOnPage: row.show_faq_on_page !== false,
    showFaqTitleOnPage: row.show_faq_title_on_page !== false,
    readingTime: estimateReadingTimeLabel(row.content),
    videoUrl: normalizedVideoUrl ?? "",
    videoDuration: video?.duration?.trim() ?? "",
    galleryImages: gallery?.images ?? [],
  };
}

async function queryPublicContentDetail(contentType: ContentType, slug: string) {
  if (!slug || slug.startsWith("e2e-test")) return null;
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select(PUBLIC_CONTENT_DETAIL_SELECT)
    .eq("content_type", contentType)
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    failPublicContentRead("query_failed", {
      context: "Public Content detail query failed",
      error,
      details: { contentType, slug },
    });
  }
  return data ? mapDetailRow(data) : null;
}

export const loadPublicContentDetail = cache(async function loadPublicContentDetail(
  contentType: ContentType,
  slug: string,
) {
  const normalizedSlug = slug.trim();
  return unstable_cache(
    () => queryPublicContentDetail(contentType, normalizedSlug),
    ["public-content-detail", contentType, normalizedSlug],
    { revalidate: 300, tags: [PUBLIC_CONTENT_CACHE_TAG] },
  )();
});

export async function loadPublicContentSitemapRows(): Promise<PublicContentSitemapRow[]> {
  return unstable_cache(async () => {
    const { data, error } = await getSupabaseAdmin()
      .from("topics")
      .select(PUBLIC_CONTENT_SITEMAP_SELECT)
      .in("content_type", [...CONTENT_TYPES])
      .eq("status", "published")
      .is("deleted_at", null)
      .not("slug", "like", "e2e-test%");

    if (error) {
      failPublicContentRead("query_failed", {
        context: "Public Content sitemap query failed",
        error,
      });
    }
    if (data === null) {
      failPublicContentRead("contract_failed", {
        context: "Public Content sitemap query returned null data",
        error: new Error("Public Content sitemap data does not satisfy the read contract."),
      });
    }

    return data.map((row) => {
      if (!isContentType(row.content_type)) {
        failPublicContentRead("contract_failed", {
          context: "Public Content sitemap row has an invalid content type",
          error: new Error("Public Content sitemap row does not satisfy the read contract."),
          details: { rowId: row.id, contentType: row.content_type },
        });
      }
      const id = Number(row.id);
      const slug = row.slug?.trim() ?? "";
      if (!Number.isInteger(id) || !slug) {
        failPublicContentRead("contract_failed", {
          context: "Public Content sitemap row has an invalid identity",
          error: new Error("Public Content sitemap row does not satisfy the read contract."),
          details: { rowId: row.id, contentType: row.content_type, slug: row.slug },
        });
      }
      return {
        id,
        contentType: row.content_type,
        slug,
        href: resolvePublicContentPath(row.content_type, slug),
        publishedAt: row.published_at ?? "",
        updatedAt: row.updated_at ?? "",
        isFeatured: Boolean(row.is_featured),
        canonicalUrl: row.canonical_url ?? "",
        robotsIndex: row.robots_index ?? null,
      };
    });
  }, ["public-content-sitemap"], {
    revalidate: 300,
    tags: [PUBLIC_CONTENT_CACHE_TAG],
  })();
}
