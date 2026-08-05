import AdminDashboardView from "../../components/admin/dashboard/AdminDashboardView";
import { loadAdminDashboard } from "../../lib/admin/dashboard/load-admin-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const model = await loadAdminDashboard();
  return <AdminDashboardView model={model} />;
}
