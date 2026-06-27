import type { AuditAction } from "./audit-actions";

export type AuditEventInput = {
  actorAdminUserId?: number | null;
  actorUsername: string;
  action: AuditAction;
  entityType?: string | null;
  entityId?: number | null;
  entityLabel?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type AuditLogRecord = {
  id: number;
  actor_admin_user_id: number | null;
  actor_username: string;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  entity_label: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type AuditLogFilters = {
  actorUsername?: string;
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  query?: string;
  page?: number;
  pageSize?: number;
};

export type AuditLogListResult = {
  items: AuditLogRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
