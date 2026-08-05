import { notFound } from "next/navigation";

import IntegrationConnectionWizard from "../../../../../components/admin/integrations/IntegrationConnectionWizard";
import { loadAdminIntegrationsSnapshot } from "../../../../../lib/admin/integrations/load-admin-integrations";
import { isIntegrationKey } from "../../../../../lib/admin/integrations/integrations-contract";

export const dynamic = "force-dynamic";

export default async function IntegrationConnectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ integration: string }>;
  searchParams: Promise<{ action?: string; error?: string }>;
}) {
  const { integration } = await params;
  if (!isIntegrationKey(integration)) notFound();
  const snapshot = await loadAdminIntegrationsSnapshot();
  const item = snapshot.integrations.find((candidate) => candidate.key === integration);
  if (!item) notFound();
  const query = await searchParams;
  return (
    <IntegrationConnectionWizard
      key={`${item.connectionId ?? "none"}:${item.status}:${item.availableAssets.length}`}
      item={item}
      requestedAction={query.action ?? null}
      callbackError={query.error ?? null}
    />
  );
}
