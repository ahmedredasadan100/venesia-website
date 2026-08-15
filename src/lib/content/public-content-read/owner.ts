import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import {
  CONTENT_TYPES,
  isContentType,
  type ContentType,
} from "../../admin/content/content-types";
import {
  normalizeYouTubeUrl,
  parseMediaTopicPayload,
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
  type PublicContentCollectionInput,
  type PublicContentCollectionResult,
  type PublicContentSummary,
  type PublicContentTextSearchQuery,
} from "./contract";

const PUBLIC_CONTENT_CACHE_TAG = "public-content";
const ARTICLE_IMAGE_FALLBACK = "/images/topics/default.jpg";
const MEDIA_IMAGE_FALLBACK = "/images/venesia-5.png";

/** Exact projection for every Public Collection read. Body and SEO fields are excluded. */
export const PUBLIC_CONTENT_COLLECTION_SELECT =
  "id, slug, title, excerpt, image, image_alt, category, category_slug, series, series_slug, date_label, published_at, content_type, is_featured, is_popular, media_kind:media_payload->>kind, media_duration:media_payload->>duration, media_gallery_cover:media_payload->images->0->>url, media_project, show_title_on_page, show_image_on_page, show_excerpt_on_page, show_date_on_page, show_category_on_page, show_series_on_page, show_intro_card_on_page";

/** Exact projection for one public detail. Collection consumers never receive these fields. */
export const PUBLIC_CONTENT_DETAIL_SELECT =
  "id, slug, title, excerpt, content, image, image_alt, category, category_slug, series, series_slug, date_label, published_at, content_type, is_featured, is_popular, media_payload, media_project, seo_title, seo_description, seo_keywords, focus_keyword, canonical_url, robots_index, robots_follow, og_image, og_image_alt, faq, show_title_on_page, show_image_on_page, show_excerpt_on_page, show_date_on_page, show_category_on_page, show_series_on_page, show_intro_card_on_page, show_faq_on_page, show_faq_title_on_page";

/** Exact projection for sitemap generation. It avoids loading card, body, and rich-media data. */
export const PUBLIC_CONTENT_SITEMAP_SELECT =
  "id, slug, content_type, published_at, updated_at, is_featured, canonical_url, robots_index";

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
  media_payload?: Json | null;
  media_kind?: string | null;
  media_duration?: string | null;
  media_gallery_cover?: string | null;
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

function mapCollectionRow(row: PublicContentRow): PublicContentSummary | null {
  if (!isContentType(row.content_type)) return null;
  const id = Number(row.id);
  const slug = row.slug?.trim() ?? "";
  if (!Number.isInteger(id) || !slug) return null;

  const mediaPayload = parseMediaTopicPayload(row.media_payload);
  const mediaKind = row.media_kind === "video" || row.media_kind === "gallery"
    ? row.media_kind
    : mediaPayload?.kind ?? null;
  const galleryCover = row.media_gallery_cover ?? (
    mediaPayload?.kind === "gallery" ? mediaPayload.images[0]?.url : undefined
  );
  const mediaDuration = row.media_duration ?? (
    mediaPayload?.kind === "video" ? mediaPayload.duration : ""
  );
  const fallback = row.content_type === "article"
    ? ARTICLE_IMAGE_FALLBACK
    : MEDIA_IMAGE_FALLBACK;

  return {
    id,
    contentType: row.content_type,
    slug,
    href: resolvePublicContentPath(row.content_type, slug),
    title: row.title ?? "",
    excerpt: row.excerpt ?? "",
    image: resolveLocalPublicImage(row.image?.trim() || galleryCover, fallback),
    imageAlt: row.image_alt ?? row.title ?? "",
    category: row.category ?? "",
    categorySlug: row.category_slug ?? "",
    series: row.series ?? "",
    seriesSlug: row.series_slug ?? "",
    date: row.date_label || formatArabicContentDate(row.published_at ?? "") || "",
    publishedAt: row.published_at ?? "",
    isFeatured: Boolean(row.is_featured),
    isPopular: Boolean(row.is_popular),
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
  return (value ?? []).flatMap((row) => {
    const item = mapCollectionRow(row);
    return item ? [item] : [];
  });
}

interface PublicContentFilterQuery extends PublicContentTextSearchQuery {
  in(column: "content_type", values: readonly ContentType[]): this;
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

function buildCollectionQuery(
  input: ReturnType<typeof normalizePublicContentCollectionInput>,
  includeCount = false,
) {
  const selected = getSupabaseAdmin()
    .from("topics")
    .select(PUBLIC_CONTENT_COLLECTION_SELECT, includeCount ? { count: "exact" } : undefined);

  return applyPublicFilters(selected, input)
    .order("published_at", { ascending: input.sort === "oldest" })
    .order("id", { ascending: input.sort === "oldest" });
}

async function resolveSeparateFeatured(
  input: ReturnType<typeof normalizePublicContentCollectionInput>,
) {
  if (input.featuredId) {
    const manualResult = await buildCollectionQuery({
      ...input,
      featured: "none",
      excludeIds: [],
    })
      .eq("id", input.featuredId)
      .limit(1);
    if (manualResult.error) {
      logError("Public Content manual featured query failed", manualResult.error, {
        contentTypes: input.contentTypes,
        featuredId: input.featuredId,
      });
      return null;
    }
    return mapCollectionRows(manualResult.data)[0] ?? null;
  }

  const featuredInput = { ...input, featured: "only" as const, excludeIds: [] };
  const featuredResult = await buildCollectionQuery(featuredInput).limit(1);
  if (featuredResult.error) {
    logError("Public Content featured query failed", featuredResult.error, {
      contentTypes: input.contentTypes,
    });
    return null;
  }

  const featured = mapCollectionRows(featuredResult.data)[0];
  if (featured) return featured;

  const fallbackResult = await buildCollectionQuery({
    ...input,
    featured: "none",
    excludeIds: [],
  }).limit(1);
  if (fallbackResult.error) {
    logError("Public Content featured fallback query failed", fallbackResult.error, {
      contentTypes: input.contentTypes,
    });
    return null;
  }
  return mapCollectionRows(fallbackResult.data)[0] ?? null;
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
  const input = normalizePublicContentCollectionInput(rawInput);
  if (!input.contentTypes.length) return emptyCollection(input);

  const featured = input.featured === "separate"
    ? await resolveSeparateFeatured(input)
    : null;
  const listInput = featured
    ? { ...input, featured: "none" as const, excludeIds: [...input.excludeIds, featured.id] }
    : input;
  const requestedFrom = (listInput.page - 1) * listInput.pageSize;

  let result = await buildCollectionQuery(listInput, true)
    .range(requestedFrom, requestedFrom + listInput.pageSize - 1);
  if (result.error) {
    logError("Public Content collection query failed", result.error, {
      contentTypes: input.contentTypes,
      page: input.page,
    });
    return emptyCollection(input, featured);
  }

  const totalCount = result.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / listInput.pageSize));
  const page = Math.min(listInput.page, totalPages);
  const startIndex = totalCount === 0 ? 0 : (page - 1) * listInput.pageSize;

  if (page !== listInput.page && totalCount > 0) {
    result = await buildCollectionQuery(listInput)
      .range(startIndex, startIndex + listInput.pageSize - 1);
    if (result.error) {
      logError("Public Content normalized-page query failed", result.error, {
        contentTypes: input.contentTypes,
        page,
      });
      return emptyCollection(input, featured);
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

function mapDetailRow(row: PublicContentRow): PublicContentDetail | null {
  const summary = mapCollectionRow(row);
  if (!summary) return null;
  const payload = parseMediaTopicPayload(row.media_payload);
  const video = payload?.kind === "video" ? payload : null;
  const gallery = payload?.kind === "gallery" ? payload : null;

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
    videoUrl: normalizeYouTubeUrl(video?.video_url ?? "") ?? "",
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
    logError("Public Content detail query failed", error, { contentType, slug });
    return null;
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

    if (error) throw new Error(error.message);
    return (data ?? []).flatMap((row) => {
      if (!isContentType(row.content_type)) return [];
      const id = Number(row.id);
      const slug = row.slug?.trim() ?? "";
      if (!Number.isInteger(id) || !slug) return [];
      return [{
        id,
        contentType: row.content_type,
        slug,
        href: resolvePublicContentPath(row.content_type, slug),
        publishedAt: row.published_at ?? "",
        updatedAt: row.updated_at ?? "",
        isFeatured: Boolean(row.is_featured),
        canonicalUrl: row.canonical_url ?? "",
        robotsIndex: row.robots_index ?? null,
      }];
    });
  }, ["public-content-sitemap"], {
    revalidate: 300,
    tags: [PUBLIC_CONTENT_CACHE_TAG],
  })();
}
