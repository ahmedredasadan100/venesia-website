import { notFound } from "next/navigation";

import { TrackingStagesCollection } from "../../../../../components/admin/projects/tracking/TrackingCollections";
import TrackingSchemaUnavailable from "../../../../../components/admin/projects/tracking/TrackingSchemaUnavailable";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { normalizeAdminEntityListQuery } from "../../../../../lib/admin/entity-list/data-engine/contracts";
import { readAdminColumnPreferences } from "../../../../../lib/admin/preferences/admin-column-preferences";
import { loadTrackingStagesResult } from "../../../../../lib/admin/projects/tracking-adapter";
import {
  PROJECT_TRACKING_COLUMN_CONTRACT_VERSION,
  getProjectTrackingColumnKeys,
  getProjectTrackingColumnViewKey,
} from "../../../../../lib/admin/projects/tracking-column-preferences";
import { trackingStagesQueryContract } from "../../../../../lib/admin/projects/tracking-contract";

export const dynamic = "force-dynamic";

export default async function ProjectTrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminSession();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const projectId = Number(id);
  const raw = await searchParams;
  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(raw))
    if (typeof value === "string") queryParams.set(key, value);
  queryParams.set("project_id", id);
  const query = normalizeAdminEntityListQuery(
    trackingStagesQueryContract,
    queryParams,
  );
  const columnPreferences = await readAdminColumnPreferences(
    getProjectTrackingColumnViewKey("stages"),
    { contractVersion: PROJECT_TRACKING_COLUMN_CONTRACT_VERSION },
  );
  const listResult = await loadTrackingStagesResult(query)
    .then((data) => ({ data, error: null as Error | null }))
    .catch((error: unknown) => ({
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("تعذر تحميل بيانات المتابعة."),
    }));
  if (!listResult.data) {
    return (
      <TrackingSchemaUnavailable
        projectId={projectId}
        message={listResult.error?.message ?? "تعذر تحميل بيانات المتابعة."}
      />
    );
  }
  return (
    <TrackingStagesCollection
      initialQuery={query}
      initialResult={listResult.data}
      initialVisibleColumns={
        columnPreferences.visibleColumns ?? [
          ...getProjectTrackingColumnKeys("stages"),
        ]
      }
    />
  );
}
