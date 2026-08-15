import "server-only";

import type { Json } from "../../database.types";
import { logError } from "../../logging";
import { getSupabaseAdmin } from "../../supabase-admin";
import type { AuditEventInput } from "./audit-types";
import { sanitizeAuditMetadata } from "./sanitize-audit-metadata";

function auditJsonValue(value: unknown): Json | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) {
    return value.map((item) => auditJsonValue(item) ?? null);
  }
  if (!value || typeof value !== "object") return undefined;
  const result: { [key: string]: Json | undefined } = {};
  for (const [key, item] of Object.entries(value)) {
    const mapped = auditJsonValue(item);
    if (mapped !== undefined) result[key] = mapped;
  }
  return result;
}

function auditMetadata(input: Record<string, unknown> | undefined): Json {
  return auditJsonValue(sanitizeAuditMetadata(input)) ?? {};
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
        metadata: auditMetadata(input.metadata),
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
