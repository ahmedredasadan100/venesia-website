import AdminNotice from "../../../../components/admin/AdminNotice";
import { AdminActionButton, AdminInfoBar, AdminPageHeader } from "../../../../components/admin/ui";
import { listProjectsByType } from "../../../../lib/projects/queries";
import { getProjectsTableReady } from "../../../../lib/projects/seed-from-static-data";
import AddProjectPanelClient from "../AddProjectPanelClient";
import ProjectsTableClient from "../ProjectsTableClient";

export const dynamic = "force-dynamic";

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
  searchParams?: Promise<{ notice?: string; error?: string }>;
}) {
  const params = await searchParams;
  const notice = getNoticeText(params?.notice);
  const errorMessage = params?.error ? decodeURIComponent(params.error) : null;
  const tableStatus = await getProjectsTableReady();

  if (!tableStatus.ready) {
    return (
      <main className="space-y-7">
        <AdminPageHeader title="المشاريع التجارية" description="مدير المشاريع التجارية." />
        <AdminNotice variant="danger" title="جداول المشاريع غير جاهزة" message={tableStatus.error ?? ""} />
      </main>
    );
  }

  const projects = await listProjectsByType("commercial");
  const publishedCount = projects.filter((item) => item.publication_status === "published").length;
  const featuredCount = projects.filter((item) => item.featured).length;

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

      <AdminInfoBar
        label="Commercial Projects Manager"
        description="المشاريع التجارية لا تحتوي تفاصيل سكنية كاملة — بعض التبويبات تظهر بشكل مبسّط."
        meta={`${projects.length} Projects / ${publishedCount} Published / ${featuredCount} Featured`}
      />

      {notice ? <AdminNotice variant="success" message={notice} /> : null}
      {errorMessage ? <AdminNotice variant="danger" title="تعذر تنفيذ العملية" message={errorMessage} /> : null}

      <ProjectsTableClient type="commercial" projects={projects} />
    </main>
  );
}
