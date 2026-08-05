import AdminIntegrationsPlatform from "../../../../components/admin/integrations/AdminIntegrationsPlatform";
import { loadAdminIntegrationsSnapshot } from "../../../../lib/admin/integrations/load-admin-integrations";

export const dynamic = "force-dynamic";

export default async function Page() {
  const snapshot = await loadAdminIntegrationsSnapshot();
  return <AdminIntegrationsPlatform snapshot={snapshot} />;
}
