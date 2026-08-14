import AdminNotice from "../../../../components/admin/AdminNotice";
import { AdminEntityListPageLayout } from "../../../../components/admin/entity-list";
import { AdminPageHeader } from "../../../../components/admin/ui";
import { normalizeAdminEntityListQuery } from "../../../../lib/admin/entity-list/data-engine/contracts";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { loadProjectLocationManagementResult } from "../../../../lib/admin/projects/location-management-adapter";
import {
  PROJECT_LOCATION_LEVEL_CONFIG,
  projectLocationsQueryContract,
  type ProjectLocationLevel,
} from "../../../../lib/admin/projects/location-management-contract";
import ProjectLocationsManagementClient from "./ProjectLocationsManagementClient";

type LocationManagementSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ProjectLocationManagementPage({
  level,
  searchParams,
}: {
  level: ProjectLocationLevel;
  searchParams?: LocationManagementSearchParams;
}) {
  await requireAdminSession();
  const resolved = searchParams ? await searchParams : {};
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === "string") params.set(key, value);
  }
  const initialQuery = normalizeAdminEntityListQuery(
    projectLocationsQueryContract,
    params,
  );
  let initialResult: Awaited<
    ReturnType<typeof loadProjectLocationManagementResult>
  > | null = null;
  let loadError: Error | null = null;
  try {
    initialResult = await loadProjectLocationManagementResult(
      level,
      initialQuery,
    );
  } catch (error) {
    loadError =
      error instanceof Error
        ? error
        : new Error("تعذر قراءة بيانات مواقع المشاريع.");
  }

  if (!initialResult) {
    return (
      <AdminEntityListPageLayout>
        <AdminPageHeader
          eyebrow="PROJECT LOCATION DOMAIN"
          title={PROJECT_LOCATION_LEVEL_CONFIG[level].label}
          description="إدارة التسلسل المعتمد لمواقع المشاريع."
        />
        <AdminNotice
          variant="danger"
          title="تعذر تحميل مواقع المشاريع"
          message={loadError?.message ?? "تعذر قراءة بيانات مواقع المشاريع."}
        />
      </AdminEntityListPageLayout>
    );
  }

  return (
    <ProjectLocationsManagementClient
      level={level}
      initialQuery={initialQuery}
      initialResult={initialResult}
    />
  );
}
