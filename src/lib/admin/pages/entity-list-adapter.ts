import "server-only";

import type { AdminEntityListAdapter } from "../entity-list/data-engine/adapter";
import { type AdminEntityListQuery } from "../entity-list/data-engine/contracts";
import { getSupabaseAdmin } from "../../supabase-admin";
import {
  legacyPageSortFields,
  pageSortFields,
  pagesQueryContract,
  pagesEntityListResultSchema,
  type PageEntityListRow,
  type PageEntityListMetrics,
  type PageFilters,
  type PageSortField,
} from "./entity-list-contract";
import {
  adaptPagesReadModel,
  type AdaptedPagesReadModel,
} from "./entity-list-read-model-boundary";

export class PagesEntityListDatabaseError extends Error {
  readonly code: string;
  readonly details: string;
  readonly hint: string;

  constructor(error: { message: string; code: string; details: string; hint: string }) {
    super(error.message);
    this.name = "PagesEntityListDatabaseError";
    this.code = error.code;
    this.details = error.details;
    this.hint = error.hint;
  }
}

type PagesReadModelRequest = {
  page: number;
  pageSize: number;
  sortField: PageSortField;
  sortDirection: "asc" | "desc";
  search: string;
};

async function loadPagesReadModelPage(
  query: PagesReadModelRequest,
): Promise<AdaptedPagesReadModel> {
  const { data, error } = await getSupabaseAdmin().rpc("admin_list_pages", {
    p_page: query.page,
    p_page_size: query.pageSize,
    p_sort_field: query.sortField,
    p_sort_direction: query.sortDirection,
    p_search: query.search,
  });
  if (error) throw new PagesEntityListDatabaseError(error);

  return adaptPagesReadModel(data, {
    legacySortFields: legacyPageSortFields,
    extendedSortFields: pageSortFields,
  });
}

export async function loadPagesEntityListResult(
  query: AdminEntityListQuery<PageFilters, PageSortField>,
) {
  const readModel = await loadPagesReadModelPage({
    page: query.page,
    pageSize: query.pageSize,
    sortField: query.sort.field,
    sortDirection: query.sort.direction,
    search: query.search,
  });
  const totalRows = readModel.totalRows;
  const totalPages = Math.max(1, Math.ceil(totalRows / query.pageSize));
  const page = readModel.page;

  return pagesEntityListResultSchema.parse({
    rows: readModel.rows,
    pagination: { page, pageSize: query.pageSize, totalRows, totalPages },
    metrics: readModel.metrics,
    meta: { generatedAt: new Date().toISOString(), mode: query.mode },
  });
}

export const pagesEntityListAdapter: AdminEntityListAdapter<
  "pages",
  PageFilters,
  PageSortField,
  PageEntityListRow,
  PageEntityListMetrics
> = {
  entity: "pages",
  queryContract: pagesQueryContract,
  resultSchema: pagesEntityListResultSchema,
  staleTimeMs: 30_000,
  mutationInvalidation: "entity",
  load: loadPagesEntityListResult,
};
