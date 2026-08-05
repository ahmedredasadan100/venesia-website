import type { AuditLogRecord } from "./audit-types";

export type AuditReportEvent = {
  id: number;
  actor: string;
  action: string;
  entityType: string | null;
  entityId: number | null;
  entityLabel: string | null;
  createdAt: string;
};

export type AdminAuditReport = {
  total: number;
  sampled: number;
  sampleLimit: number;
  recentActivity: AuditReportEvent[];
  entityActivity: Array<{ entityType: string; count: number }>;
  userActivity: Array<{ actor: string; count: number }>;
  publishingHistory: AuditReportEvent[];
};

function projectEvent(item: AuditLogRecord): AuditReportEvent {
  return {
    id: item.id,
    actor: item.actor_username,
    action: item.action,
    entityType: item.entity_type,
    entityId: item.entity_id,
    entityLabel: item.entity_label,
    createdAt: item.created_at,
  };
}

function countBy<T>(items: readonly T[], key: (item: T) => string) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = key(item);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

export function buildAdminAuditReport(input: {
  items: readonly AuditLogRecord[];
  total: number;
  sampleLimit: number;
}): AdminAuditReport {
  return {
    total: input.total,
    sampled: input.items.length,
    sampleLimit: input.sampleLimit,
    recentActivity: input.items.slice(0, 10).map(projectEvent),
    entityActivity: countBy(input.items, (item) => item.entity_type ?? "system")
      .map((item) => ({ entityType: item.label, count: item.count })),
    userActivity: countBy(input.items, (item) => item.actor_username)
      .map((item) => ({ actor: item.label, count: item.count })),
    publishingHistory: input.items
      .filter((item) => /(?:^|\.)(?:publish|unpublish)$/.test(item.action))
      .slice(0, 10)
      .map(projectEvent),
  };
}
