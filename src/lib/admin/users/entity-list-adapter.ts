import "server-only";

import { z } from "zod";

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
  adminUserEntityListMetricsSchema,
  adminUserEntityListRowSchema,
  adminUsersQueryContract,
  type AdminUserFilters,
  type AdminUserSortField,
} from "./entity-list-contract";

const ADMIN_USER_LIST_SELECT =
  "id, email, username, full_name, role, is_active, last_login_at, created_at, updated_at";

export const adminUsersEntityListResultSchema =
  createAdminEntityListResultSchema(
    adminUserEntityListRowSchema,
    adminUserEntityListMetricsSchema,
  );

export class AdminUsersEntityListDatabaseError extends Error {
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
    this.name = "AdminUsersEntityListDatabaseError";
    this.code = error.code ?? "admin_users_list_failed";
    this.details = error.details ?? "";
    this.hint = error.hint ?? "";
  }
}

async function loadAdminUsersPage(
  query: AdminEntityListQuery<AdminUserFilters, AdminUserSortField>,
  page: number,
) {
  const from = (page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;
  const searchFilter = buildAdminListSearchOrFilter(
    ["username", "email", "full_name"],
    query.search,
  );
  const ascending = query.sort.direction === "asc";

  let request = getSupabaseAdmin()
    .from("admin_users")
    .select(ADMIN_USER_LIST_SELECT, { count: "exact" });

  if (query.filters.status !== "all") {
    request = request.eq(
      "is_active",
      query.filters.status === "active",
    );
  }
  if (query.filters.role !== "all") {
    request = request.eq("role", query.filters.role);
  }
  if (searchFilter) request = request.or(searchFilter);

  const { data, error, count } = await request
    .order(query.sort.field, { ascending, nullsFirst: false })
    .order("id", { ascending })
    .range(from, to);

  if (error) throw new AdminUsersEntityListDatabaseError(error);

  return {
    rows: z.array(adminUserEntityListRowSchema).parse(data ?? []),
    totalRows: count ?? 0,
  };
}

async function loadAdminUserRoles() {
  const { data, error } = await getSupabaseAdmin()
    .from("admin_users")
    .select("role")
    .order("role", { ascending: true });

  if (error) throw new AdminUsersEntityListDatabaseError(error);
  return [...new Set((data ?? []).map((row) => String(row.role || "admin")))];
}

export async function loadAdminUsersEntityListResult(
  query: AdminEntityListQuery<AdminUserFilters, AdminUserSortField>,
) {
  const [loaded, roles] = await Promise.all([
    loadNormalizedAdminEntityListPage({
      requestedPage: query.page,
      pageSize: query.pageSize,
      loadPage: (page) => loadAdminUsersPage(query, page),
    }),
    loadAdminUserRoles(),
  ]);

  return adminUsersEntityListResultSchema.parse({
    rows: loaded.rows,
    pagination: {
      page: loaded.page,
      pageSize: query.pageSize,
      totalRows: loaded.totalRows,
      totalPages: loaded.totalPages,
    },
    metrics: { roles },
    meta: {
      generatedAt: new Date().toISOString(),
      mode: query.mode,
    },
  });
}

export const adminUsersEntityListAdapter: AdminEntityListAdapter<
  "admin_users",
  AdminUserFilters,
  AdminUserSortField,
  z.infer<typeof adminUserEntityListRowSchema>,
  z.infer<typeof adminUserEntityListMetricsSchema>
> = {
  entity: "admin_users",
  queryContract: adminUsersQueryContract,
  resultSchema: adminUsersEntityListResultSchema,
  staleTimeMs: 30_000,
  mutationInvalidation: "entity",
  load: loadAdminUsersEntityListResult,
};
