import { AdminActionButton, AdminPageHeader } from "../../../../components/admin/ui";
import AdminNotice from "../../../../components/admin/AdminNotice";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { normalizeAdminEntityListQuery } from "../../../../lib/admin/entity-list/data-engine/contracts";
import { loadProjectsEntityListResult } from "../../../../lib/admin/projects/entity-list-adapter";
import {
  projectsQueryContract,
  withLockedProjectType,
} from "../../../../lib/admin/projects/entity-list-contract";
import {
  getProjectsDefaultColumnKeys,
  PROJECTS_RESIDENTIAL_LIST_VIEW_KEY,
} from "../../../../lib/admin/projects/projects-list-config";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import AddProjectPanelClient from "../AddProjectPanelClient";
import ProjectsTableClient from "../ProjectsTableClient";

export const dynamic = "force-dynamic";

const BASE_PATH = "/admin/projects/residential";

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

export default async function ResidentialProjectsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdminSession();
  const resolved = searchParams ? await searchParams : {};
  const notice = getNoticeText(
    typeof resolved.notice === "string" ? resolved.notice : undefined,
  );
  const errorMessage =
    typeof resolved.error === "string"
      ? decodeURIComponent(resolved.error)
      : null;

  const params = new URLSearchParams();
  Object.entries(resolved).forEach(([key, value]) => {
    if (typeof value === "string") params.set(key, value);
  });
  params.set("type", "residential");
  const normalized = normalizeAdminEntityListQuery(projectsQueryContract, params);
  const initialQuery = {
    ...normalized,
    filters: withLockedProjectType(normalized.filters, "residential"),
  };

  const [{ data: preference, error: preferenceError }, listResult] =
    await Promise.all([
      getSupabaseAdmin()
        .from("admin_user_preferences")
        .select("preferences")
        .eq("admin_user_id", actor.id)
        .eq("view_key", PROJECTS_RESIDENTIAL_LIST_VIEW_KEY)
        .maybeSingle<{ preferences: { visibleColumns?: string[] } }>(),
      loadProjectsEntityListResult(initialQuery)
        .then((data) => ({ data, error: null as Error | null }))
        .catch((error: unknown) => ({
          data: null,
          error:
            error instanceof Error
              ? error
              : new Error("تعذر تحميل قائمة المشاريع السكنية."),
        })),
    ]);

  if (listResult.error) {
    return (
      <main className="space-y-7">
        <AdminPageHeader title="المشاريع السكنية" description="مدير المشاريع السكنية." />
        <AdminNotice
          variant="danger"
          title="تعذر تحميل قائمة المشاريع"
          message={listResult.error.message}
        />
      </main>
    );
  }

  const visibleColumns = Array.isArray(preference?.preferences?.visibleColumns)
    ? preference.preferences.visibleColumns
    : [...getProjectsDefaultColumnKeys()];

  return (
    <main className="space-y-7">
      <AdminPageHeader
        variant="context"
        title="المشاريع السكنية"
        description="جميع المشاريع السكنية في شبكة إدارية واحدة — بدون تعديل الواجهة العامة."
        contextLine="أنت الآن تدير: المشروعات السكنية"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <AddProjectPanelClient type="residential" />
            <AdminActionButton href="/admin/projects/commercial" variant="dark">
              المشاريع التجارية
            </AdminActionButton>
            <AdminActionButton href="/admin/projects" variant="dark">
              مركز المشروعات
            </AdminActionButton>
          </div>
        }
      />

      {preferenceError ? (
        <AdminNotice
          variant="danger"
          title="تعذر تحميل تفضيلات الأعمدة"
          message={preferenceError.message}
        />
      ) : null}

      {listResult.data ? (
        <ProjectsTableClient
          type="residential"
          basePath={BASE_PATH}
          initialQuery={initialQuery}
          initialResult={listResult.data}
          initialVisibleColumns={visibleColumns}
          notice={notice}
          errorMessage={errorMessage}
        />
      ) : null}
    </main>
  );
}
