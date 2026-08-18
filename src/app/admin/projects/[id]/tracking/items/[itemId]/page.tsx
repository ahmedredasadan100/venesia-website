import { notFound } from "next/navigation";

import { TrackingUpdatesCollection } from "../../../../../../../components/admin/projects/tracking/TrackingCollections";
import TrackingSchemaUnavailable from "../../../../../../../components/admin/projects/tracking/TrackingSchemaUnavailable";
import { requireAdminSession } from "../../../../../../../lib/admin/auth/require-admin-session";
import { normalizeAdminEntityListQuery } from "../../../../../../../lib/admin/entity-list/data-engine/contracts";
import { readAdminColumnPreferences } from "../../../../../../../lib/admin/preferences/admin-column-preferences";
import { loadTrackingUpdatesResult } from "../../../../../../../lib/admin/projects/tracking-adapter";
import {
  PROJECT_TRACKING_COLUMN_CONTRACT_VERSION,
  getProjectTrackingColumnKeys,
  getProjectTrackingColumnViewKey,
} from "../../../../../../../lib/admin/projects/tracking-column-preferences";
import { trackingUpdatesQueryContract } from "../../../../../../../lib/admin/projects/tracking-contract";

export const dynamic = "force-dynamic";

export default async function TrackingItemUpdatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; itemId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminSession();
  const { id, itemId } = await params;
  if (!/^\d+$/.test(id) || !/^\d+$/.test(itemId)) notFound();
  const raw = await searchParams;
  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(raw))
    if (typeof value === "string") queryParams.set(key, value);
  queryParams.set("project_id", id);
  queryParams.set("item_id", itemId);
  const query = normalizeAdminEntityListQuery(
    trackingUpdatesQueryContract,
    queryParams,
  );
  const columnPreferences = await readAdminColumnPreferences(
    getProjectTrackingColumnViewKey("updates"),
    { contractVersion: PROJECT_TRACKING_COLUMN_CONTRACT_VERSION },
  );
  const listResult = await loadTrackingUpdatesResult(query)
    .then((data) => ({ data, error: null as Error | null }))
    .catch((error: unknown) => ({
      data: null,
      error:
        error instanceof Error ? error : new Error("تعذر تحميل سجل التحديثات."),
    }));
  if (!listResult.data) {
    return (
      <TrackingSchemaUnavailable
        projectId={Number(id)}
        message={listResult.error?.message ?? "تعذر تحميل سجل التحديثات."}
      />
    );
  }
  return (
    <TrackingUpdatesCollection
      initialQuery={query}
      initialResult={listResult.data}
      initialVisibleColumns={
        columnPreferences.visibleColumns ?? [
          ...getProjectTrackingColumnKeys("updates"),
        ]
      }
    />
  );
}
