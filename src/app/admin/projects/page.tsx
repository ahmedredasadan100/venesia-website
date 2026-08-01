import AdminNotice from "../../../components/admin/AdminNotice";
import { AdminInfoBar, AdminPageContextHeader, AdminPageHeader } from "../../../components/admin/ui";
import { countProjectsByType } from "../../../lib/projects/queries";
import { getProjectsTableReady } from "../../../lib/projects/seed-from-static-data";
import ProjectsHubCard from "./projects-table/ProjectsHubCard";

export const dynamic = "force-dynamic";

export default async function ProjectsHubPage() {
  const tableStatus = await getProjectsTableReady();
  let counts = { residential: 0, commercial: 0, residentialError: null as string | null, commercialError: null as string | null };

  if (tableStatus.ready) {
    counts = await countProjectsByType();
  }

  if (!tableStatus.ready) {
    return (
      <main className="space-y-7">
        <AdminPageHeader
          eyebrow="PROJECTS CONTROL"
          title="المشاريع"
          description="مركز إدخال وتعديل المشاريع السكنية والتجارية."
        />
        <AdminNotice
          variant="danger"
          title="جداول المشاريع غير جاهزة"
          message={`المخطط النظيف غير متاح بعد. الهجرة المحلية المقترحة: sql/migrations/20260728090000_rebuild_project_admin_data_entry.sql — ${tableStatus.error}`}
        />
      </main>
    );
  }

  return (
    <main className="space-y-7">
      <AdminPageContextHeader
        eyebrow="PROJECTS CONTROL"
        title="إدارة المشاريع"
        description="اختر نوع المشاريع لإدارة بيانات الإدخال بالمخطط النظيف."
      />

      <AdminInfoBar
        label="Project Admin Data Entry"
        description="الإدخال والتعديل فقط؛ النشر والمراجعة والتحديثات التنفيذية خارج هذه المرحلة."
        meta={`${counts.residential} Residential / ${counts.commercial} Commercial / ${tableStatus.count} Total`}
      />

      {tableStatus.count === 0 ? (
        <AdminNotice
          variant="danger"
          title="لا توجد مشاريع في Supabase"
          message="أضف المشاريع من لوحة التحكم."
        />
      ) : null}

      <section className="grid gap-5 md:grid-cols-2">
        <ProjectsHubCard
          href="/admin/projects/residential"
          emoji="🏠"
          title="المشاريع السكنية"
          description="إدارة المشاريع السكنية: البيانات الأساسية، الموقع، المخططات، المواصفات، الوسائط، والسيو."
          count={counts.residential}
        />
        <ProjectsHubCard
          href="/admin/projects/commercial"
          emoji="🏢"
          title="المشاريع التجارية"
          description="إدارة المشاريع التجارية بنفس بنية CMS مع قائمة منفصلة."
          count={counts.commercial}
        />
      </section>
    </main>
  );
}
