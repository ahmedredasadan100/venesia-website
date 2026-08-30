import {
  CONTENT_TYPES,
  MEDIA_EDITABLE_CONTENT_TYPES,
  isContentType,
  type ContentType,
  type MediaEditableContentType,
} from "../../admin/content/content-types";

export const PUBLIC_CONTENT_SOURCE_KINDS = [
  "categories",
  "media-center",
] as const;
export type PublicContentSourceKind =
  (typeof PUBLIC_CONTENT_SOURCE_KINDS)[number];

export type PublicContentSource<
  MediaType extends MediaEditableContentType | "all" = MediaEditableContentType,
> =
  | { kind: "categories"; categorySlug: string }
  | { kind: "media-center"; contentType: MediaType };

export function publicContentSourceContentTypes(
  source: PublicContentSource<MediaEditableContentType | "all">,
): readonly ContentType[] {
  if (source.kind === "categories") return ["article"];
  return source.contentType === "all"
    ? MEDIA_EDITABLE_CONTENT_TYPES
    : [source.contentType];
}

export const PUBLIC_CONTENT_SEARCH_MAX_LENGTH = 120;
export const PUBLIC_CONTENT_SEARCH_DEBOUNCE_MS = 350;
export const PUBLIC_CONTENT_SEARCH_RESULT_LIMIT = 60;
export const PUBLIC_CONTENT_COLLECTION_MAX_PAGE_SIZE = 60;

export const PUBLIC_CONTENT_SEARCH_FIELDS = [
  "title",
  "excerpt",
  "seo_description",
  "slug",
  "category",
  "category_slug",
  "series",
  "series_slug",
  "date_label",
  "media_project",
] as const;

/**
 * Canonical featured-content selection intent for public content consumers.
 * Automatic means `is_featured = true` only; absence never falls back to latest.
 */
export type PublicContentFeaturedSelection =
  | { mode: "automatic" }
  | { mode: "manual"; topicId: number };

export type PublicContentCollectionInput = {
  contentTypes: readonly ContentType[];
  sort?: "newest" | "oldest";
  page?: number;
  pageSize?: number;
  search?: string;
  categorySlugs?: readonly string[];
  seriesSlug?: string;
  seriesSlugs?: readonly string[];
  featured?: "none" | "only";
  featuredSelection?: PublicContentFeaturedSelection;
  popularOnly?: boolean;
  /** Restrict a collection read to explicit persisted identities. */
  includeIds?: readonly number[];
  excludeIds?: readonly number[];
  relatedTo?: {
    categorySlug?: string;
    seriesSlug?: string;
  };
};

export type PublicContentSummary = {
  id: number;
  contentType: ContentType;
  slug: string;
  href: string;
  title: string;
  excerpt: string;
  image: string;
  imageAlt: string;
  category: string;
  categorySlug: string;
  series: string;
  seriesSlug: string;
  date: string;
  publishedAt: string;
  isFeatured: boolean;
  isPopular: boolean;
  mediaProject: string;
  mediaKind: "video" | "gallery" | null;
  mediaDuration: string;
  display: {
    title: boolean;
    image: boolean;
    excerpt: boolean;
    date: boolean;
    category: boolean;
    series: boolean;
    introCard: boolean;
  };
};

export type PublicContentCollectionResult = {
  featured: PublicContentSummary | null;
  items: PublicContentSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
};

export type PublicContentSearchSuggestion = {
  id: string;
  title: string;
  href: string;
  meta?: string;
};

export function normalizePublicContentSearchQuery(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/gu, "")
    .trim()
    .replace(/\s+/gu, " ")
    .slice(0, PUBLIC_CONTENT_SEARCH_MAX_LENGTH);
}

export function escapePublicContentSearchTerm(term: string) {
  return normalizePublicContentSearchQuery(term)
    .replace(/\\/gu, "\\\\")
    .replace(/"/gu, '\\"')
    .replace(/[%_*]/gu, "\\$&");
}

export function buildPublicContentSearchOrFilter(term: string) {
  const escaped = escapePublicContentSearchTerm(term);
  if (!escaped) return "";

  const pattern = `"%${escaped}%"`;
  return PUBLIC_CONTENT_SEARCH_FIELDS.map(
    (field) => `${field}.ilike.${pattern}`,
  ).join(",");
}

export interface PublicContentTextSearchQuery {
  or(filter: string): this;
}

// Supabase changes the query-builder type after each filter. This function owns
// the single allowlisted text predicate used by the Public Collection owner.
export function applyPublicContentTextSearch<
  Query extends PublicContentTextSearchQuery,
>(query: Query, term: string | null | undefined): Query {
  const filter = buildPublicContentSearchOrFilter(term ?? "");
  return filter ? query.or(filter) : query;
}

export function normalizePublicContentCollectionInput(
  input: PublicContentCollectionInput,
): Required<Pick<PublicContentCollectionInput, "sort" | "page" | "pageSize" | "featured" | "popularOnly">> &
  Omit<PublicContentCollectionInput, "sort" | "page" | "pageSize" | "featured" | "featuredSelection" | "popularOnly"> & {
    contentTypes: ContentType[];
    search: string;
    categorySlugs: string[];
    seriesSlug: string;
    seriesSlugs: string[];
    includeIds: number[];
    excludeIds: number[];
    featuredSelection: PublicContentFeaturedSelection | undefined;
    relatedTo: { categorySlug: string; seriesSlug: string };
  } {
  const contentTypes = CONTENT_TYPES.filter((contentType) =>
    input.contentTypes.some((candidate) => candidate === contentType && isContentType(candidate)),
  );
  const search = normalizePublicContentSearchQuery(input.search);
  const requestedPageSize = search
    ? PUBLIC_CONTENT_SEARCH_RESULT_LIMIT
    : Math.floor(Number(input.pageSize ?? 12));
  const manualTopicId = input.featuredSelection?.mode === "manual"
    ? Number(input.featuredSelection.topicId)
    : Number.NaN;
  const featuredSelection: PublicContentFeaturedSelection | undefined = search
    ? undefined
    : input.featuredSelection?.mode === "automatic"
      ? { mode: "automatic" }
      : input.featuredSelection?.mode === "manual" &&
          Number.isSafeInteger(manualTopicId) && manualTopicId > 0
        ? { mode: "manual", topicId: manualTopicId }
        : undefined;

  return {
    ...input,
    contentTypes,
    sort: input.sort === "oldest" ? "oldest" : "newest",
    page: search ? 1 : Math.max(1, Math.floor(Number(input.page ?? 1)) || 1),
    pageSize: Math.max(1, Math.min(
      Number.isFinite(requestedPageSize) ? requestedPageSize : 12,
      PUBLIC_CONTENT_COLLECTION_MAX_PAGE_SIZE,
    )),
    search,
    categorySlugs: normalizeSlugList(input.categorySlugs),
    seriesSlug: normalizeSlug(input.seriesSlug),
    seriesSlugs: normalizeSlugList(input.seriesSlugs),
    featured: search ? "none" : input.featured ?? "none",
    featuredSelection,
    popularOnly: Boolean(input.popularOnly),
    includeIds: normalizePositiveIdList(input.includeIds),
    excludeIds: [...new Set((input.excludeIds ?? []).filter(Number.isInteger))],
    relatedTo: {
      categorySlug: normalizeSlug(input.relatedTo?.categorySlug),
      seriesSlug: normalizeSlug(input.relatedTo?.seriesSlug),
    },
  };
}

function normalizeSlug(value: unknown) {
  return String(value ?? "").trim().replace(/[^a-zA-Z0-9_-]/gu, "");
}

function normalizeSlugList(values: readonly string[] | undefined) {
  return [...new Set((values ?? []).map(normalizeSlug).filter(Boolean))];
}

function normalizePositiveIdList(values: readonly number[] | undefined) {
  return [...new Set((values ?? []).filter(
    (value) => Number.isSafeInteger(value) && value > 0,
  ))];
}
