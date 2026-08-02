import { notFound } from "next/navigation";

import AdminNotice from "../../../../components/admin/AdminNotice";
import {
  AdminActionButton,
  AdminEntityPreviewActions,
  AdminPageContextHeader,
  AdminPageExperience,
} from "../../../../components/admin/ui";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import {
  loadProjectEntry,
  ProjectEntrySchemaUnavailableError,
} from "../../../../lib/admin/projects/project-entry-data";
import { getProjectPreviewCapability } from "../../../../lib/admin/projects/project-publishing-capability";
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
      <AdminPageExperience dir="rtl" state="error">
        <AdminPageContextHeader
          eyebrow="إدارة المشاريع"
          title="تعذر فتح محرر المشروع"
          description="المشاريع / تعديل المشروع"
          actions={<AdminActionButton href="/admin/projects/residential" variant="dark">عرض المشروعات</AdminActionButton>}
        />
        <AdminNotice
          variant="warning"
          title="ترحيل قاعدة البيانات الجديد غير مطبق"
          message={error.message}
        />
      </AdminPageExperience>
    );
  }

  if (!bundle) notFound();
  const project = bundle.project;
  const listPath = project.type === "commercial" ? "/admin/projects/commercial" : "/admin/projects/residential";

  return (
    <AdminPageExperience dir="rtl">
      <AdminPageContextHeader
        eyebrow="إدارة المشاريع"
        title={project.arabic_name || project.english_name || "تعديل المشروع"}
        description={`المشاريع / تعديل المشروع — ${project.english_name || "اسم المشروع بالإنجليزية"} — ${project.slug}`}
        actions={
          <>
            <AdminActionButton href={listPath} variant="dark">عرض المشروعات</AdminActionButton>
            <AdminEntityPreviewActions
              capability={getProjectPreviewCapability({
                id: project.id!,
                slug: project.slug,
                publicationStatus: project.publication_status,
              })}
            />
          </>
        }
      />
      <ProjectEditForm key={bundle.project.id ?? `project-${id}`} bundle={bundle} />
    </AdminPageExperience>
  );
}
