import AdminReportsView from "../../../components/admin/reports/AdminReportsView";
import { loadAdminReports } from "../../../lib/admin/reports/load-admin-reports";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const model = await loadAdminReports();
  return <AdminReportsView model={model} />;
}
