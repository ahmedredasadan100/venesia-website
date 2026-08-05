import { AdminInfoBar, AdminPageContextHeader, AdminPageHeader } from "../../../components/admin/ui";
import { countProjectsByType } from "../../../lib/projects/queries";
import ProjectsHubCard from "./projects-table/ProjectsHubCard";

export const dynamic = "force-dynamic";

export default async function ProjectsHubPage() {
  const counts = await countProjectsByType();
  const countError = counts.residentialError ?? counts.commercialError;
  if (countError) {
    return (
      <main className="space-y-7">
        <AdminPageHeader
          eyebrow="PROJECTS CONTROL"
          title="المشاريع"
          description="مركز إدخال وتعديل المشاريع السكنية والتجارية."
        />
        <div
          className="rounded-2xl border border-red-300/20 bg-red-400/8 p-5 text-sm text-red-100"
        >تعذر قراءة مالك المشاريع في قاعدة البيانات: {countError}</div>
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
        meta={`${counts.residential} Residential / ${counts.commercial} Commercial / ${counts.total} Total`}
      />

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
