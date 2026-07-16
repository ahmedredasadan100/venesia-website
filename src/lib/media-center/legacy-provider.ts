import "server-only";

import { logError } from "../logging";
import { getSupabaseAdmin } from "../supabase-admin";
import { formatDateLabel } from "./format-date-label";
import type { MediaContentItem, MediaContentType } from "./types";
import { isMediaContentType } from "./types";
import type {
  UnifiedMediaLimitedQuery,
  UnifiedMediaListingPageParams,
  UnifiedMediaListingPageResult,
} from "./unified-provider";

type LegacyMediaItemRow = {
  id: number | string;
  slug: string | null;
  title: string | null;
  excerpt: string | null;
  category: string | null;
  category_slug: string | null;
  date_label: string | null;
  published_at: string | null;
  image: string | null;
  type: MediaContentType | string | null;
  is_featured: boolean | null;
  is_popular: boolean | null;
  project: string | null;
  duration: string | null;
  content?: string[] | string | null;
};

const LEGACY_LISTING_SELECT =
  "id, slug, title, excerpt, category, category_slug, date_label, published_at, image, type, is_featured, is_popular, project, duration";

const LEGACY_DETAIL_SELECT = `${LEGACY_LISTING_SELECT}, content`;

function normalizeContent(value: LegacyMediaItemRow["content"]) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function mapLegacyMediaRow(row: LegacyMediaItemRow): MediaContentItem | null {
  const type = typeof row.type === "string" ? row.type : null;
  if (!isMediaContentType(type)) return null;

  const publishedAt = row.published_at ?? "";

  return {
    id: String(row.id),
    slug: row.slug ?? "",
    title: row.title ?? "",
    excerpt: row.excerpt ?? "",
    category: row.category ?? "المركز الإعلامي",
    categorySlug: row.category_slug ?? undefined,
    date: row.date_label || formatDateLabel(publishedAt),
    publishedAt,
    image: row.image || "/images/venesia-5.png",
    type,
    featured: Boolean(row.is_featured),
    isPopular: Boolean(row.is_popular),
    project: row.project || undefined,
    duration: row.duration || undefined,
    content: "content" in row ? normalizeContent(row.content) : undefined,
  };
}

function mapRows(data: unknown) {
  return ((data ?? []) as LegacyMediaItemRow[])
    .map(mapLegacyMediaRow)
    .filter(Boolean) as MediaContentItem[];
}

function buildLegacyQuery(select: string, type?: MediaContentType, ascending = false) {
  let query = getSupabaseAdmin()
    .from("media_items")
    .select(select)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("published_at", { ascending })
    .order("id", { ascending });

  if (type) query = query.eq("type", type);
  return query;
}

export async function legacyGetMediaItems(type?: MediaContentType) {
  const { data, error } = await buildLegacyQuery(LEGACY_LISTING_SELECT, type);

  if (error) {
    logError("Legacy media items fetch failed", error, { type });
    return [];
  }

  return mapRows(data);
}

export async function legacyGetMediaItemBySlug(type: MediaContentType, slug: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("media_items")
    .select(LEGACY_DETAIL_SELECT)
    .eq("type", type)
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    logError("Legacy media item fetch failed", error, { type, slug });
    return null;
  }

  return data ? mapLegacyMediaRow(data as LegacyMediaItemRow) : null;
}

export async function legacyGetMediaStaticParams(type: MediaContentType) {
  const { data, error } = await getSupabaseAdmin()
    .from("media_items")
    .select("slug")
    .eq("type", type)
    .eq("status", "published")
    .is("deleted_at", null);

  if (error) {
    logError("Legacy media static params fetch failed", error, { type });
    return [];
  }

  return (data ?? [])
    .map((item) => ({ slug: item.slug }))
    .filter((item): item is { slug: string } => Boolean(item.slug));
}

async function resolveLegacyFeatured(
  type: MediaContentType,
  sort: "newest" | "oldest",
): Promise<MediaContentItem | null> {
  const ascending = sort === "oldest";
  const { data: featuredRows, error: featuredError } = await buildLegacyQuery(
    LEGACY_LISTING_SELECT,
    type,
    ascending,
  )
    .eq("is_featured", true)
    .limit(1);

  if (featuredError) {
    logError("Legacy media featured fetch failed", featuredError, { type });
  } else {
    const featured = mapRows(featuredRows)[0];
    if (featured) return featured;
  }

  const { data: firstRows, error: firstError } = await buildLegacyQuery(
    LEGACY_LISTING_SELECT,
    type,
    ascending,
  ).limit(1);

  if (firstError) {
    logError("Legacy media first-item featured fallback failed", firstError, { type });
    return null;
  }

  return mapRows(firstRows)[0] ?? null;
}

export async function legacyGetMediaListingPage(
  params: UnifiedMediaListingPageParams,
): Promise<UnifiedMediaListingPageResult> {
  const pageSize = Math.max(1, params.pageSize);
  const ascending = params.sort === "oldest";

  const featured = params.pickFeatured
    ? await resolveLegacyFeatured(params.type, params.sort)
    : null;
  const excludeId = featured?.id ?? null;

  let countQuery = getSupabaseAdmin()
    .from("media_items")
    .select("id", { count: "exact", head: true })
    .eq("status", "published")
    .is("deleted_at", null)
    .eq("type", params.type);

  if (excludeId) countQuery = countQuery.neq("id", excludeId);

  const { count, error: countError } = await countQuery;
  if (countError) {
    logError("Legacy media listing count failed", countError, { type: params.type });
  }

  const totalRegular = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRegular / pageSize) || 1);
  const currentPage = Math.min(Math.max(params.page, 1), totalPages);

  if (totalRegular === 0) {
    return { featured, items: [], totalRegular: 0, totalPages: 1, currentPage: 1 };
  }

  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  let pageQuery = buildLegacyQuery(LEGACY_LISTING_SELECT, params.type, ascending);
  if (excludeId) pageQuery = pageQuery.neq("id", excludeId);

  const { data, error } = await pageQuery.range(from, to);
  if (error) {
    logError("Legacy media listing page fetch failed", error, {
      type: params.type,
      page: currentPage,
    });
    return { featured, items: [], totalRegular, totalPages, currentPage };
  }

  return {
    featured,
    items: mapRows(data),
    totalRegular,
    totalPages,
    currentPage,
  };
}

export async function legacyGetMediaItemsLimited(
  options: UnifiedMediaLimitedQuery,
): Promise<MediaContentItem[]> {
  const limit = Math.max(1, options.limit);
  const ascending = options.sort === "oldest";

  let query = buildLegacyQuery(LEGACY_LISTING_SELECT, options.type, ascending).limit(limit);
  if (options.popularOnly) {
    query = query.eq("is_popular", true);
  }

  const { data, error } = await query;
  if (error) {
    logError("Legacy media limited fetch failed", error, {
      type: options.type,
      popularOnly: options.popularOnly,
      limit,
    });
    return [];
  }

  return mapRows(data);
}
