import "server-only";

import { buildAdminAuditReport, type AdminAuditReport } from "./audit-report";
import { listAdminAuditLogs } from "./list-admin-audit-logs";

const AUDIT_REPORT_SAMPLE_LIMIT = 50;

export async function loadAdminAuditReport(): Promise<AdminAuditReport> {
  const result = await listAdminAuditLogs({
    page: 1,
    pageSize: AUDIT_REPORT_SAMPLE_LIMIT,
    sortDirection: "desc",
  });
  return buildAdminAuditReport({
    items: result.items,
    total: result.total,
    sampleLimit: AUDIT_REPORT_SAMPLE_LIMIT,
  });
}
