import { notFound } from "next/navigation";

import AdminReportDetailView, {
  AdminReportInvalidQuery,
} from "../../../../components/admin/reports/AdminReportDetailView";
import { loadAdminReports } from "../../../../lib/admin/reports/load-admin-reports";
import {
  isAdminReportId,
  getAdminReportAnalyticsQuery,
  resolveAdminReportQuery,
  type AdminReportQueryInput,
} from "../../../../lib/admin/reports/reports-information-architecture";
import { buildAdminReportPresentation } from "../../../../lib/admin/reports/reports-presentation";

export const dynamic = "force-dynamic";

export default async function AdminReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ report: string }>;
  searchParams?: Promise<AdminReportQueryInput>;
}) {
  const { report } = await params;
  if (!isAdminReportId(report)) notFound();

  const query = resolveAdminReportQuery(report, (await searchParams) ?? {});
  if (query.state === "invalid") {
    await loadAdminReports();
    return <AdminReportInvalidQuery reportId={report} message={query.message} />;
  }
  const model = await loadAdminReports({
    analytics: getAdminReportAnalyticsQuery(report, query.context),
  });
  const presentation = buildAdminReportPresentation(model, report, query.context);
  return (
    <AdminReportDetailView
      model={model}
      presentation={presentation}
      context={query.context}
    />
  );
}
