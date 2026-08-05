import { AUDIT_ACTIONS } from "../../../../lib/admin/audit/audit-actions";
import { recordAdminAuditEvent } from "../../../../lib/admin/audit/record-admin-audit-event";
import { resolveRequestAuditContext } from "../../../../lib/admin/audit/resolve-request-audit-context";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { loadAdminReports } from "../../../../lib/admin/reports/load-admin-reports";
import {
  isAdminReportId,
  getAdminReportAnalyticsQuery,
  resolveAdminReportQuery,
  type AdminReportQueryInput,
} from "../../../../lib/admin/reports/reports-information-architecture";
import {
  buildAdminReportExportRows,
  buildAdminReportPresentation,
} from "../../../../lib/admin/reports/reports-presentation";

export const dynamic = "force-dynamic";

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function queryInput(params: URLSearchParams): AdminReportQueryInput {
  const input: AdminReportQueryInput = {};
  for (const key of new Set([...params.keys()].filter((value) => value !== "report"))) {
    const values = params.getAll(key);
    input[key] = values.length > 1 ? values : values[0];
  }
  return input;
}

export async function GET(request: Request) {
  let actor;
  try {
    actor = await requireAdminSession();
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const reportValues = url.searchParams.getAll("report");
  const report = reportValues.length === 1 ? reportValues[0] : null;
  if (!report || !isAdminReportId(report)) {
    return Response.json({ error: "Invalid report identifier" }, { status: 400 });
  }
  const query = resolveAdminReportQuery(report, queryInput(url.searchParams));
  if (query.state === "invalid") {
    return Response.json({ error: query.message }, { status: 400 });
  }

  const model = await loadAdminReports({
    analytics: getAdminReportAnalyticsQuery(report, query.context),
  });
  const presentation = buildAdminReportPresentation(model, report, query.context);
  const rows = buildAdminReportExportRows(presentation);
  if (!rows.length) {
    return Response.json(
      { error: "No authoritative report data is available for this context." },
      { status: 503, headers: { "cache-control": "private, no-store" } },
    );
  }

  const csv = [
    ["section", "item", "value", "context"],
    ...rows.map((row) => [row.section, row.item, row.value, row.context]),
  ].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const auditContext = resolveRequestAuditContext(request);
  await recordAdminAuditEvent({
    actorAdminUserId: actor.id,
    actorUsername: actor.username,
    action: AUDIT_ACTIONS.reportsExport,
    entityType: "report",
    entityLabel: report,
    metadata: {
      report,
      filter: query.context.filter,
      period: query.context.period,
      compare: query.context.compare,
      rowCount: rows.length,
      format: "csv",
    },
    ...auditContext,
  });

  return new Response(`\uFEFF${csv}`, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="venesia-${report}-report.csv"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
