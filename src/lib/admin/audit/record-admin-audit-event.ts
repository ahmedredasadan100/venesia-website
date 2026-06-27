import "server-only";

import { logError } from "../../logging";
import { getSupabaseAdmin } from "../../supabase-admin";
import type { AuditEventInput } from "./audit-types";
import { sanitizeAuditMetadata } from "./sanitize-audit-metadata";

function mapAuditRow(row: Record<string, unknown>) {
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

export async function recordAdminAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("admin_audit_logs")
      .insert({
        actor_admin_user_id: input.actorAdminUserId ?? null,
        actor_username: input.actorUsername,
        action: input.action,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        entity_label: input.entityLabel ?? null,
        metadata: sanitizeAuditMetadata(input.metadata),
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
      })
      .select("id")
      .single();

    if (error) throw error;
    void data;
  } catch (error) {
    logError("audit log write failed", error, { action: input.action });
  }
}

export async function getLatestAuditLogs(limit = 20) {
  const { data, error } = await getSupabaseAdmin()
    .from("admin_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapAuditRow(row as Record<string, unknown>));
}
