import "server-only";

import type { Json, Tables } from "../../database.types";
import { getSupabaseAdmin } from "../../supabase-admin";
import { buildAdminListSearchOrFilter } from "../admin-list-search";
import { loadNormalizedAdminEntityListPage } from "../entity-list/data-engine/adapter";
import type { AuditLogFilters, AuditLogListResult, AuditLogRecord } from "./audit-types";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;

function auditMetadata(value: Json): AuditLogRecord["metadata"] {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function mapAuditRow(row: Tables<"admin_audit_logs">): AuditLogRecord {
  return {
    id: Number(row.id),
    actor_admin_user_id: row.actor_admin_user_id == null ? null : Number(row.actor_admin_user_id),
    actor_username: String(row.actor_username),
    action: String(row.action),
    entity_type: row.entity_type ? String(row.entity_type) : null,
    entity_id: row.entity_id == null ? null : Number(row.entity_id),
    entity_label: row.entity_label ? String(row.entity_label) : null,
    metadata: auditMetadata(row.metadata),
    ip_address: row.ip_address ? String(row.ip_address) : null,
    user_agent: row.user_agent ? String(row.user_agent) : null,
    created_at: String(row.created_at),
  };
}

async function loadAdminAuditLogPage(
  filters: AuditLogFilters,
  page: number,
  pageSize: number,
) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = getSupabaseAdmin().from("admin_audit_logs").select("*", { count: "exact" });

  if (filters.actorUsername?.trim()) {
    query = query.eq("actor_username", filters.actorUsername.trim());
  }

  if (filters.action?.trim()) {
    query = query.eq("action", filters.action.trim());
  }

  if (filters.entityType?.trim()) {
    query = query.eq("entity_type", filters.entityType.trim());
  }

  if (filters.dateFrom) {
    query = query.gte("created_at", filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte("created_at", filters.dateTo);
  }

  const searchFilter = buildAdminListSearchOrFilter(
    ["actor_username", "entity_label"],
    filters.query ?? "",
  );
  if (searchFilter) query = query.or(searchFilter);

  const { data, error, count } = await query
    .order("created_at", { ascending: filters.sortDirection === "asc" })
    .order("id", { ascending: filters.sortDirection === "asc" })
    .range(from, to);

  if (error) throw new Error(error.message);

  return {
    rows: (data ?? []).map(mapAuditRow),
    totalRows: count ?? 0,
  };
}

export async function listAdminAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogListResult> {
  const page = Math.max(1, Math.trunc(filters.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.trunc(filters.pageSize ?? DEFAULT_PAGE_SIZE)),
  );
  const loaded = await loadNormalizedAdminEntityListPage({
    requestedPage: page,
    pageSize,
    loadPage: (nextPage) =>
      loadAdminAuditLogPage(filters, nextPage, pageSize),
  });

  return {
    items: loaded.rows,
    total: loaded.totalRows,
    page: loaded.page,
    pageSize,
    totalPages: loaded.totalPages,
  };
}

export async function listAuditActorUsernames() {
  const { data, error } = await getSupabaseAdmin()
    .from("admin_audit_logs")
    .select("actor_username")
    .order("actor_username", { ascending: true });

  if (error) throw new Error(error.message);

  const unique = [...new Set((data ?? []).map((row) => String(row.actor_username)).filter(Boolean))];
  return unique;
}

export async function listAuditEntityTypes() {
  const { data, error } = await getSupabaseAdmin()
    .from("admin_audit_logs")
    .select("entity_type")
    .not("entity_type", "is", null)
    .order("entity_type", { ascending: true });

  if (error) throw new Error(error.message);

  const unique = [...new Set((data ?? []).map((row) => String(row.entity_type)).filter(Boolean))];
  return unique;
}
