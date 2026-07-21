import { AdminActionButton, AdminPageHeader } from "../../../../components/admin/ui";
import AdminNotice from "../../../../components/admin/AdminNotice";
import { normalizeAdminEntityListQuery } from "../../../../lib/admin/entity-list/data-engine/contracts";
import { loadProjectsEntityListResult } from "../../../../lib/admin/projects/entity-list-adapter";
import {
  projectsQueryContract,
  withLockedProjectType,
} from "../../../../lib/admin/projects/entity-list-contract";
import { getProjectsTableReady } from "../../../../lib/projects/seed-from-static-data";
import AddProjectPanelClient from "../AddProjectPanelClient";
import ProjectsTableClient from "../ProjectsTableClient";

export const dynamic = "force-dynamic";

const BASE_PATH = "/admin/projects/commercial";

function getNoticeText(notice?: string) {
  if (notice === "updated") return "تم تحديث المشروع بنجاح.";
  if (notice) {
    try {
      return decodeURIComponent(notice);
    } catch {
      return notice;
    }
  }
  return null;
}

export default async function CommercialProjectsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const notice = getNoticeText(
    typeof resolved.notice === "string" ? resolved.notice : undefined,
  );
  const errorMessage =
    typeof resolved.error === "string"
      ? decodeURIComponent(resolved.error)
      : null;
  const tableStatus = await getProjectsTableReady();

  if (!tableStatus.ready) {
    return (
      <main className="space-y-7">
        <AdminPageHeader title="المشاريع التجارية" description="مدير المشاريع التجارية." />
        <AdminNotice
          variant="danger"
          title="جداول المشاريع غير جاهزة"
          message={tableStatus.error ?? ""}
        />
      </main>
    );
  }

  const params = new URLSearchParams();
  Object.entries(resolved).forEach(([key, value]) => {
    if (typeof value === "string") params.set(key, value);
  });
  params.set("type", "commercial");
  const normalized = normalizeAdminEntityListQuery(projectsQueryContract, params);
  const initialQuery = {
    ...normalized,
    filters: withLockedProjectType(normalized.filters, "commercial"),
  };
  const initialResult = await loadProjectsEntityListResult(initialQuery);

  return (
    <main className="space-y-7">
      <AdminPageHeader
        title="المشاريع التجارية"
        description="قائمة منفصلة للمشاريع التجارية بنفس أنماط الإدارة."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <AddProjectPanelClient type="commercial" />
            <AdminActionButton href="/admin/projects" variant="dark">
              رجوع للمشاريع
            </AdminActionButton>
          </div>
        }
      />

      <ProjectsTableClient
        type="commercial"
        basePath={BASE_PATH}
        initialQuery={initialQuery}
        initialResult={initialResult}
        notice={notice}
        errorMessage={errorMessage}
      />
    </main>
  );
}
