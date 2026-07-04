import Link from "next/link";
import { notFound } from "next/navigation";
import AdminNotice from "../../../../components/admin/AdminNotice";
import AdminStatusBadge from "../../../../components/admin/AdminStatusBadge";
import { AdminActionButton, AdminInfoBar, AdminPageHeader } from "../../../../components/admin/ui";
import { getProjectEditBundle } from "../../../../lib/projects/queries";
import ProjectEditForm from "../ProjectEditForm";

export const dynamic = "force-dynamic";

function getNoticeText(notice?: string) {
  if (notice === "updated") return "تم حفظ التعديلات بنجاح.";
  if (notice === "created") return "تم إنشاء المشروع. أكمل تفاصيله من النموذج أدناه.";
  return null;
}

export default async function ProjectEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ notice?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;

  if (!/^\d+$/.test(id)) notFound();

  const bundle = await getProjectEditBundle(Number(id));
  if (!bundle) notFound();

  const { project } = bundle;
  const notice = getNoticeText(query?.notice);
  const errorMessage = query?.error ? decodeURIComponent(query.error) : null;
  const listPath = project.type === "residential" ? "/admin/projects/residential" : "/admin/projects/commercial";
  const contextLine =
    project.type === "residential"
      ? "أنت الآن تدير: المشروعات السكنية"
      : "أنت الآن تدير: المشروعات التجارية";

  return (
    <main className="space-y-7">
      <AdminPageHeader
        variant="context"
        eyebrow={project.type === "residential" ? "RESIDENTIAL PROJECT" : "COMMERCIAL PROJECT"}
        title={project.arabic_name}
        description={`${project.code} — ${project.slug}`}
        contextLine={contextLine}
        actions={
          <>
            <AdminStatusBadge status={project.publication_status} />
            <AdminActionButton href={listPath} variant="dark">
              رجوع للقائمة
            </AdminActionButton>
            <Link
              href={`/projects/${project.slug}`}
              target="_blank"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[#D8B87A]/35 px-4 py-2.5 text-sm font-semibold text-[#D8B87A] transition hover:bg-[#D8B87A]/10"
            >
              النسخة العامة
            </Link>
          </>
        }
      />

      <AdminInfoBar
        label="Projects CMS Editor"
        description="تحرير بيانات المشروع في CMS. الواجهة العامة تقرأ من جدول projects في Supabase."
        meta={`Type: ${project.type} / Featured: ${project.featured ? "Yes" : "No"}`}
      />

      {notice ? <AdminNotice variant="success" message={notice} /> : null}
      {errorMessage ? <AdminNotice variant="danger" title="تعذر حفظ التعديلات" message={errorMessage} /> : null}

      <ProjectEditForm bundle={bundle} />
    </main>
  );
}
