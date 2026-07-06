import Link from "next/link";
import AdminNotice from "../../../components/admin/AdminNotice";
import { AdminInfoBar, AdminPageHeader } from "../../../components/admin/ui";
import { countProjectsByType } from "../../../lib/projects/queries";
import { getProjectsTableReady } from "../../../lib/projects/seed-from-static-data";
import { ProjectsHubCard } from "./ProjectsTableClient";

export const dynamic = "force-dynamic";

function getNoticeText(notice?: string) {
  if (!notice) return null;
  try {
    return decodeURIComponent(notice);
  } catch {
    return notice;
  }
}

export default async function ProjectsHubPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string; error?: string }>;
}) {
  const params = await searchParams;
  const notice = getNoticeText(params?.notice);
  const errorMessage = params?.error ? decodeURIComponent(params.error) : null;

  const tableStatus = await getProjectsTableReady();
  let counts = { residential: 0, commercial: 0, residentialError: null as string | null, commercialError: null as string | null };

  if (tableStatus.ready) {
    counts = await countProjectsByType();
  }

  if (!tableStatus.ready) {
    return (
      <main className="space-y-7">
        <AdminPageHeader
          title="المشاريع"
          description="مركز إدارة المشاريع السكنية والتجارية — Projects CMS Core."
        />
        <AdminNotice
          variant="danger"
          title="جداول المشاريع غير جاهزة"
          message={`نفّذ ملف SQL: sql/migrations/20250620000000_projects_cms_core.sql — ${tableStatus.error}`}
        />
      </main>
    );
  }

  return (
    <main className="space-y-7">
      <AdminPageHeader
        variant="context"
        title="المشاريع"
        contextLine="أنت الآن تدير: مركز المشروعات"
        description="اختر نوع المشاريع لإدارتها. الواجهة العامة تقرأ من Supabase — المصدر الوحيد بعد الإطلاق."
      />

      <AdminInfoBar
        label="Projects CMS Core"
        description="Phase 1 — بناء نواة CMS فقط. رحلة التنفيذ لم تُنقل بعد."
        meta={`${counts.residential} Residential / ${counts.commercial} Commercial / ${tableStatus.count} Total`}
      />

      {notice ? <AdminNotice variant="success" message={notice} /> : null}
      {errorMessage ? <AdminNotice variant="danger" title="تعذر تنفيذ العملية" message={errorMessage} /> : null}

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

      <div className="rounded-[22px] border border-white/10 bg-white/[0.02] px-5 py-4 text-sm text-white/45">
        <p>
          المصدر الوحيد للواجهة العامة:{" "}
          <Link href="/admin/projects/residential" className="text-[#D8B87A] hover:underline">
            Supabase projects
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
