import "server-only";

import { z } from "zod";

import type { AdminEntityListAdapter } from "../entity-list/data-engine/adapter";
import {
  type AdminEntityListQuery,
} from "../entity-list/data-engine/contracts";
import { getSupabaseAdmin } from "../../supabase-admin";
import {
  pagesQueryContract,
  pagesEntityListResultSchema,
  type PageEntityListRow,
  type PageFilters,
  type PageSortField,
} from "./entity-list-contract";

const pagesReadModelRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  slug: z.string(),
  path: z.string(),
  page_type: z.string(),
  status: z.string(),
  block_count: z.number().int().nonnegative(),
});

const pagesReadModelSchema = z.object({
  rows: z.array(pagesReadModelRowSchema),
  total_count: z.coerce.number().int().nonnegative().finite(),
  page: z.number().int().positive(),
});

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

export async function loadPagesEntityListResult(
  query: AdminEntityListQuery<PageFilters, PageSortField>,
) {
  // One database list operation: the read model owns count, sorting, paging,
  // and assignment aggregation as a single stable snapshot.
  const { data, error } = await getSupabaseAdmin().rpc("admin_list_pages", {
    p_page: query.page,
    p_page_size: query.pageSize,
    p_sort_field: query.sort.field,
    p_sort_direction: query.sort.direction,
    p_search: query.search,
  });
  if (error) throw new PagesEntityListDatabaseError(error);

  const readModel = pagesReadModelSchema.parse(data);
  const totalRows = readModel.total_count;
  const totalPages = Math.max(1, Math.ceil(totalRows / query.pageSize));
  const page = readModel.page;

  return pagesEntityListResultSchema.parse({
    rows: readModel.rows.map(({ block_count, ...row }) => ({
      ...row,
      moduleCount: block_count,
    })),
    pagination: { page, pageSize: query.pageSize, totalRows, totalPages },
    meta: { generatedAt: new Date().toISOString(), mode: query.mode },
  });
}

export const pagesEntityListAdapter: AdminEntityListAdapter<
  "pages", PageFilters, PageSortField, PageEntityListRow
> = {
  entity: "pages",
  queryContract: pagesQueryContract,
  resultSchema: pagesEntityListResultSchema,
  staleTimeMs: 30_000,
  mutationInvalidation: "entity",
  load: loadPagesEntityListResult,
};
