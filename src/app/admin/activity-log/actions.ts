"use server";

import { requireAdminSession } from "../../../lib/admin/auth/require-admin-session";
import {
  listAdminAuditLogs,
  listAuditActorUsernames,
  listAuditEntityTypes,
} from "../../../lib/admin/audit/list-admin-audit-logs";
import type { AuditLogFilters, AuditLogListResult } from "../../../lib/admin/audit/audit-types";

export async function listAuditLogsAction(filters: AuditLogFilters = {}): Promise<AuditLogListResult> {
  await requireAdminSession();
  return listAdminAuditLogs(filters);
}

export async function listAuditFilterOptionsAction() {
  await requireAdminSession();
  const [actors, entityTypes] = await Promise.all([listAuditActorUsernames(), listAuditEntityTypes()]);
  return { actors, entityTypes };
}
