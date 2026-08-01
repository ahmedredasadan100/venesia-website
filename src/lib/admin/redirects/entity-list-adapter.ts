import "server-only";

import { z } from "zod";

import { REDIRECT_STATUSES, REDIRECT_TYPES } from "../../redirects/redirect-types";
import { getSupabaseAdmin } from "../../supabase-admin";
import { buildAdminListSearchOrFilter } from "../admin-list-search";
import {
  loadNormalizedAdminEntityListPage,
  type AdminEntityListAdapter,
} from "../entity-list/data-engine/adapter";
import {
  createAdminEntityListResultSchema,
  type AdminEntityListQuery,
} from "../entity-list/data-engine/contracts";
import {
  redirectsQueryContract,
  type RedirectFilters,
  type RedirectSortField,
} from "./entity-list-contract";

export const redirectEntityListRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  source_path: z.string().min(1),
  destination_path: z.string().min(1),
  redirect_type: z.enum(REDIRECT_TYPES),
  status: z.enum(REDIRECT_STATUSES),
  note: z.string().nullable(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});
export type RedirectEntityListRow = z.infer<
  typeof redirectEntityListRowSchema
>;

export const redirectsEntityListResultSchema =
  createAdminEntityListResultSchema(redirectEntityListRowSchema);

export class RedirectsEntityListDatabaseError extends Error {
  readonly code: string;
  readonly details: string;
  readonly hint: string;

  constructor(error: {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
  }) {
    super(error.message);
    this.name = "RedirectsEntityListDatabaseError";
    this.code = error.code ?? "redirects_list_failed";
    this.details = error.details ?? "";
    this.hint = error.hint ?? "";
  }
}

async function loadRedirectsPage(
  query: AdminEntityListQuery<RedirectFilters, RedirectSortField>,
  page: number,
) {
  const from = (page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;
  const searchFilter = buildAdminListSearchOrFilter(
    ["source_path", "destination_path", "note"],
    query.search,
  );
  const ascending = query.sort.direction === "asc";

  let request = getSupabaseAdmin()
    .from("url_redirects")
    .select(
      "id, source_path, destination_path, redirect_type, status, note, created_at, updated_at",
      { count: "exact" },
    );

  if (query.filters.status !== "all") {
    request = request.eq("status", query.filters.status);
  }
  if (query.filters.redirectType !== "all") {
    request = request.eq("redirect_type", query.filters.redirectType);
  }
  if (searchFilter) request = request.or(searchFilter);

  const { data, error, count } = await request
    .order(query.sort.field, { ascending, nullsFirst: false })
    .order("id", { ascending })
    .range(from, to);

  if (error) throw new RedirectsEntityListDatabaseError(error);

  return {
    rows: z.array(redirectEntityListRowSchema).parse(data ?? []),
    totalRows: count ?? 0,
  };
}

export async function loadRedirectsEntityListResult(
  query: AdminEntityListQuery<RedirectFilters, RedirectSortField>,
) {
  const loaded = await loadNormalizedAdminEntityListPage({
    requestedPage: query.page,
    pageSize: query.pageSize,
    loadPage: (page) => loadRedirectsPage(query, page),
  });

  return redirectsEntityListResultSchema.parse({
    rows: loaded.rows,
    pagination: {
      page: loaded.page,
      pageSize: query.pageSize,
      totalRows: loaded.totalRows,
      totalPages: loaded.totalPages,
    },
    meta: {
      generatedAt: new Date().toISOString(),
      mode: query.mode,
    },
  });
}

export const redirectsEntityListAdapter: AdminEntityListAdapter<
  "redirects",
  RedirectFilters,
  RedirectSortField,
  RedirectEntityListRow
> = {
  entity: "redirects",
  queryContract: redirectsQueryContract,
  resultSchema: redirectsEntityListResultSchema,
  staleTimeMs: 30_000,
  mutationInvalidation: "entity",
  load: loadRedirectsEntityListResult,
};
