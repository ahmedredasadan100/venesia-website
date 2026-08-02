import {
  AdminActionButton,
  AdminPageContextHeader,
  AdminPageExperience,
} from "../../../../components/admin/ui";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { loadEmptyProjectEntry } from "../../../../lib/admin/projects/project-entry-data";
import type { ProjectType } from "../../../../lib/admin/projects/project-entry-contract";
import ProjectEditForm from "../ProjectEditForm";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams?: Promise<{ type?: string }>;
}) {
  await requireAdminSession();
  const query = await searchParams;
  const type: ProjectType = query?.type === "commercial" ? "commercial" : "residential";
  const bundle = await loadEmptyProjectEntry(type);
  const listPath = type === "commercial" ? "/admin/projects/commercial" : "/admin/projects/residential";

  return (
    <AdminPageExperience dir="rtl">
      <AdminPageContextHeader
        eyebrow="إدارة المشاريع"
        title="إضافة مشروع جديد"
        description="المشاريع / إضافة مشروع جديد — نموذج واحد لإنشاء بيانات المشروع والموقع والنظرة العامة والمخططات والتسليم والوسائط وتحسين محركات البحث."
        actions={<AdminActionButton href={listPath} variant="dark">عرض المشروعات</AdminActionButton>}
      />
      <ProjectEditForm key={`${type}-new`} bundle={bundle} />
    </AdminPageExperience>
  );
}
