import "server-only";

import { z } from "zod";

import type { AdminEntityListAdapter } from "../entity-list/data-engine/adapter";
import {
  createAdminEntityListResultSchema,
  type AdminEntityListQuery,
} from "../entity-list/data-engine/contracts";
import type { AuditLogRecord } from "./audit-types";
import {
  activityLogQueryContract,
  type ActivityLogFilters,
  type ActivityLogSortField,
} from "./entity-list-contract";
import { listAdminAuditLogs } from "./list-admin-audit-logs";

const auditLogRecordSchema = z.strictObject({
  id: z.number().int().positive(),
  actor_admin_user_id: z.number().int().positive().nullable(),
  actor_username: z.string(),
  action: z.string(),
  entity_type: z.string().nullable(),
  entity_id: z.number().int().nullable(),
  entity_label: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
  created_at: z.string(),
});

export const activityLogEntityListResultSchema =
  createAdminEntityListResultSchema(auditLogRecordSchema);

export async function loadActivityLogEntityListResult(
  query: AdminEntityListQuery<ActivityLogFilters, ActivityLogSortField>,
) {
  const loaded = await listAdminAuditLogs({
    actorUsername: query.filters.actorUsername || undefined,
    action: query.filters.action || undefined,
    entityType: query.filters.entityType || undefined,
    dateFrom: query.filters.dateFrom
      ? `${query.filters.dateFrom}T00:00:00.000Z`
      : undefined,
    dateTo: query.filters.dateTo
      ? `${query.filters.dateTo}T23:59:59.999Z`
      : undefined,
    query: query.search || undefined,
    page: query.page,
    pageSize: query.pageSize,
    sortDirection: query.sort.direction,
  });

  return activityLogEntityListResultSchema.parse({
    rows: loaded.items,
    pagination: {
      page: loaded.page,
      pageSize: loaded.pageSize,
      totalRows: loaded.total,
      totalPages: loaded.totalPages,
    },
    meta: {
      generatedAt: new Date().toISOString(),
      mode: query.mode,
    },
  });
}

export const activityLogEntityListAdapter: AdminEntityListAdapter<
  "activity_log",
  ActivityLogFilters,
  ActivityLogSortField,
  AuditLogRecord
> = {
  entity: "activity_log",
  queryContract: activityLogQueryContract,
  resultSchema: activityLogEntityListResultSchema,
  staleTimeMs: 15_000,
  mutationInvalidation: "query",
  load: loadActivityLogEntityListResult,
};
