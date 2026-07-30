import { notFound } from "next/navigation";

import AdminNotice from "../../../../components/admin/AdminNotice";
import { AdminActionButton, AdminPageContextHeader } from "../../../../components/admin/ui";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import {
  loadProjectEntry,
  ProjectEntrySchemaUnavailableError,
} from "../../../../lib/admin/projects/project-entry-data";
import ProjectEditForm from "../ProjectEditForm";

export const dynamic = "force-dynamic";

export default async function ProjectEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  let bundle;
  try {
    bundle = await loadProjectEntry(Number(id));
  } catch (error) {
    if (!(error instanceof ProjectEntrySchemaUnavailableError)) throw error;
    return (
      <main className="space-y-5" dir="rtl">
        <AdminPageContextHeader
          eyebrow="إدارة المشاريع"
          contextLine="المشاريع / تعديل المشروع"
          title="تعذر فتح محرر المشروع"
          actions={<AdminActionButton href="/admin/projects/residential" variant="dark">عرض المشروعات</AdminActionButton>}
        />
        <AdminNotice
          variant="warning"
          title="ترحيل قاعدة البيانات الجديد غير مطبق"
          message={error.message}
        />
      </main>
    );
  }

  if (!bundle) notFound();
  const project = bundle.project;
  const listPath = project.type === "commercial" ? "/admin/projects/commercial" : "/admin/projects/residential";

  return (
    <main className="space-y-5" dir="rtl">
      <AdminPageContextHeader
        eyebrow="إدارة المشاريع"
        contextLine="المشاريع / تعديل المشروع"
        title={project.arabic_name || project.english_name || "تعديل المشروع"}
        description={`${project.english_name || "اسم المشروع بالإنجليزية"} — ${project.slug}`}
        actions={<AdminActionButton href={listPath} variant="dark">عرض المشروعات</AdminActionButton>}
      />
      <ProjectEditForm key={bundle.project.id ?? `project-${id}`} bundle={bundle} />
    </main>
  );
}
