import "server-only";

import { getSupabaseAdmin } from "../../supabase-admin";
import type { AuditLogFilters, AuditLogListResult, AuditLogRecord } from "./audit-types";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;

function mapAuditRow(row: Record<string, unknown>): AuditLogRecord {
  return {
    id: Number(row.id),
    actor_admin_user_id: row.actor_admin_user_id == null ? null : Number(row.actor_admin_user_id),
    actor_username: String(row.actor_username),
    action: String(row.action),
    entity_type: row.entity_type ? String(row.entity_type) : null,
    entity_id: row.entity_id == null ? null : Number(row.entity_id),
    entity_label: row.entity_label ? String(row.entity_label) : null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
    ip_address: row.ip_address ? String(row.ip_address) : null,
    user_agent: row.user_agent ? String(row.user_agent) : null,
    created_at: String(row.created_at),
  };
}

export async function listAdminAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));
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

  const search = filters.query?.trim();
  if (search) {
    const escaped = search.replace(/[%_]/g, "");
    query = query.or(`actor_username.ilike.%${escaped}%,entity_label.ilike.%${escaped}%`);
  }

  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);

  if (error) throw new Error(error.message);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    items: (data ?? []).map((row) => mapAuditRow(row as Record<string, unknown>)),
    total,
    page,
    pageSize,
    totalPages,
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
