import IntegrationsServerConfiguration from "../../../../../components/admin/integrations/IntegrationsServerConfiguration";
import { loadIntegrationsServerConfigurationSnapshot } from "../../../../../lib/admin/integrations/load-integrations-server-configuration";

export const dynamic = "force-dynamic";

export default async function IntegrationsServerConfigurationPage() {
  const snapshot = await loadIntegrationsServerConfigurationSnapshot();
  return <IntegrationsServerConfiguration snapshot={snapshot} />;
}
