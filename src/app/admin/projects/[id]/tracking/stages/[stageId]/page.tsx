import { notFound } from "next/navigation";

import { TrackingItemsCollection } from "../../../../../../../components/admin/projects/tracking/TrackingCollections";
import TrackingSchemaUnavailable from "../../../../../../../components/admin/projects/tracking/TrackingSchemaUnavailable";
import { requireAdminSession } from "../../../../../../../lib/admin/auth/require-admin-session";
import { normalizeAdminEntityListQuery } from "../../../../../../../lib/admin/entity-list/data-engine/contracts";
import { readAdminColumnPreferences } from "../../../../../../../lib/admin/preferences/admin-column-preferences";
import { loadTrackingItemsResult } from "../../../../../../../lib/admin/projects/tracking-adapter";
import {
  PROJECT_TRACKING_COLUMN_CONTRACT_VERSION,
  getProjectTrackingColumnKeys,
  getProjectTrackingColumnViewKey,
} from "../../../../../../../lib/admin/projects/tracking-column-preferences";
import { trackingItemsQueryContract } from "../../../../../../../lib/admin/projects/tracking-contract";

export const dynamic = "force-dynamic";

export default async function TrackingStageItemsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; stageId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminSession();
  const { id, stageId } = await params;
  if (!/^\d+$/.test(id) || !/^\d+$/.test(stageId)) notFound();
  const raw = await searchParams;
  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(raw))
    if (typeof value === "string") queryParams.set(key, value);
  queryParams.set("project_id", id);
  queryParams.set("stage_id", stageId);
  const query = normalizeAdminEntityListQuery(
    trackingItemsQueryContract,
    queryParams,
  );
  const columnPreferences = await readAdminColumnPreferences(
    getProjectTrackingColumnViewKey("items"),
    { contractVersion: PROJECT_TRACKING_COLUMN_CONTRACT_VERSION },
  );
  const listResult = await loadTrackingItemsResult(query)
    .then((data) => ({ data, error: null as Error | null }))
    .catch((error: unknown) => ({
      data: null,
      error:
        error instanceof Error ? error : new Error("تعذر تحميل بنود المرحلة."),
    }));
  if (!listResult.data) {
    return (
      <TrackingSchemaUnavailable
        projectId={Number(id)}
        message={listResult.error?.message ?? "تعذر تحميل بنود المرحلة."}
      />
    );
  }
  return (
    <TrackingItemsCollection
      initialQuery={query}
      initialResult={listResult.data}
      initialVisibleColumns={
        columnPreferences.visibleColumns ?? [
          ...getProjectTrackingColumnKeys("items"),
        ]
      }
    />
  );
}
