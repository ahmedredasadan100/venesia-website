import "server-only";

import { getSupabaseAdmin } from "../../supabase-admin";
import { loadPageModuleCounts } from "./load-page-module-counts";

export const PAGES_LIST_LIMIT_OPTIONS = ["10", "20", "30"] as const;
export const PAGES_LIST_DEFAULT_LIMIT = "10";

export type PagesListLimit = (typeof PAGES_LIST_LIMIT_OPTIONS)[number];

export type PagesListSort =
  | "id_asc"
  | "title_asc"
  | "title_desc"
  | "status_asc"
  | "status_desc";

export type PagesListQuery = {
  page?: string | number | null;
  limit?: string | null;
  sort?: string | null;
};

export type PagesTableRow = {
  id: number;
  title: string;
  slug: string;
  path: string;
  page_type: string;
  status: string;
  block_count: number;
};

export type PagesTableLoadResult = {
  rows: PagesTableRow[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  sort: PagesListSort;
};

const SORT_VALUES = new Set<PagesListSort>([
  "id_asc",
  "title_asc",
  "title_desc",
  "status_asc",
  "status_desc",
]);

function normalizeLimit(raw?: string | null): PagesListLimit {
  const value = raw?.trim() || PAGES_LIST_DEFAULT_LIMIT;
  return PAGES_LIST_LIMIT_OPTIONS.includes(value as PagesListLimit)
    ? (value as PagesListLimit)
    : PAGES_LIST_DEFAULT_LIMIT;
}

function normalizeSort(raw?: string | null): PagesListSort {
  const value = raw?.trim() as PagesListSort | undefined;
  if (value && SORT_VALUES.has(value)) return value;
  return "id_asc";
}

function normalizePage(raw?: string | number | null): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyPagesListSort(query: any, sort: PagesListSort) {
  switch (sort) {
    case "title_asc":
      return query.order("title", { ascending: true }).order("id", { ascending: true });
    case "title_desc":
      return query.order("title", { ascending: false }).order("id", { ascending: true });
    case "status_asc":
      return query.order("status", { ascending: true }).order("id", { ascending: true });
    case "status_desc":
      return query.order("status", { ascending: false }).order("id", { ascending: true });
  }

  return query.order("id", { ascending: true });
}

export async function loadPagesTableRowsPaginated(
  query: PagesListQuery = {},
): Promise<PagesTableLoadResult> {
  const limit = Number(normalizeLimit(query.limit));
  const requestedPage = normalizePage(query.page);
  const sort = normalizeSort(query.sort);

  const countQuery = applyPagesListSort(
    getSupabaseAdmin().from("pages").select("id", { count: "exact", head: true }),
    sort,
  );

  const { count: rawTotalCount, error: countError } = await countQuery;
  if (countError) throw new Error(countError.message);

  const totalCount = rawTotalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const page = Math.min(requestedPage, totalPages);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const rangeStart = totalCount === 0 ? 0 : from + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min(page * limit, totalCount);

  const dataQuery = applyPagesListSort(
    getSupabaseAdmin().from("pages").select("id,title,slug,path,page_type,status"),
    sort,
  ).range(from, to);

  const { data: pages, error: loadError } = await dataQuery;
  if (loadError) throw new Error(loadError.message);

  type PageRow = Pick<PagesTableRow, "id" | "title" | "slug" | "path" | "page_type" | "status">;
  const pageRows = (pages ?? []) as PageRow[];
  const pageIds = pageRows.map((row) => row.id);
  const blockCounts = await loadPageModuleCounts(pageIds);

  const rows = pageRows.map((row) => ({
    ...row,
    block_count: blockCounts.get(row.id) ?? 0,
  }));

  return {
    rows,
    totalCount,
    page,
    limit,
    totalPages,
    rangeStart,
    rangeEnd,
    sort,
  };
}

/** Returns the current paginated slice (used by page-actions refresh compat). */
export async function loadPagesTableRows(query?: PagesListQuery): Promise<PagesTableRow[]> {
  return (await loadPagesTableRowsPaginated(query ?? {})).rows;
}
