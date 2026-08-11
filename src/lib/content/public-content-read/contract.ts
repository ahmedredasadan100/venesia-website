import {
  CONTENT_TYPES,
  isContentType,
  type ContentType,
} from "../../admin/content/content-types";

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

export type PublicContentCollectionInput = {
  contentTypes: readonly ContentType[];
  sort?: "newest" | "oldest";
  page?: number;
  pageSize?: number;
  search?: string;
  categorySlugs?: readonly string[];
  seriesSlug?: string;
  seriesSlugs?: readonly string[];
  featured?: "none" | "separate" | "only";
  popularOnly?: boolean;
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

// Supabase changes the query-builder type after each filter. This function owns
// the single allowlisted text predicate used by the Public Collection owner.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyPublicContentTextSearch(query: any, term: string | null | undefined) {
  const filter = buildPublicContentSearchOrFilter(term ?? "");
  return filter ? query.or(filter) : query;
}

export function normalizePublicContentCollectionInput(
  input: PublicContentCollectionInput,
): Required<Pick<PublicContentCollectionInput, "sort" | "page" | "pageSize" | "featured" | "popularOnly">> &
  Omit<PublicContentCollectionInput, "sort" | "page" | "pageSize" | "featured" | "popularOnly"> & {
    contentTypes: ContentType[];
    search: string;
    categorySlugs: string[];
    seriesSlug: string;
    seriesSlugs: string[];
    excludeIds: number[];
    relatedTo: { categorySlug: string; seriesSlug: string };
  } {
  const contentTypes = CONTENT_TYPES.filter((contentType) =>
    input.contentTypes.some((candidate) => candidate === contentType && isContentType(candidate)),
  );
  const search = normalizePublicContentSearchQuery(input.search);
  const requestedPageSize = search
    ? PUBLIC_CONTENT_SEARCH_RESULT_LIMIT
    : Math.floor(Number(input.pageSize ?? 12));

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
    popularOnly: Boolean(input.popularOnly),
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
