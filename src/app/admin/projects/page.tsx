import Link from "next/link";
import AdminNotice from "../../../components/admin/AdminNotice";
import { AdminInfoBar, AdminPageHeader } from "../../../components/admin/ui";
import { countProjectsByType } from "../../../lib/projects/queries";
import { getProjectsTableReady, seedProjectsFromStaticData } from "../../../lib/projects/seed-from-static-data";
import { isProjectsStaticReimportAllowed } from "../../../lib/projects/static-reimport-policy";
import { seedProjectsAction } from "./actions";
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
  const reimportAllowed = isProjectsStaticReimportAllowed();

  const tableStatus = await getProjectsTableReady();
  let counts = { residential: 0, commercial: 0, residentialError: null as string | null, commercialError: null as string | null };

  if (tableStatus.ready && tableStatus.count === 0 && reimportAllowed) {
    await seedProjectsFromStaticData();
    counts = await countProjectsByType();
  } else if (tableStatus.ready) {
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
        title="المشاريع"
        description={
          reimportAllowed
            ? "اختر نوع المشاريع لإدارتها. الواجهة العامة تقرأ من Supabase. projects-data.ts للاستيراد/البذرة في التطوير فقط."
            : "اختر نوع المشاريع لإدارتها. الواجهة العامة تقرأ من Supabase — المصدر الوحيد بعد الإطلاق."
        }
        actions={
          reimportAllowed ? (
            <form action={seedProjectsAction}>
              <button
                type="submit"
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-2.5 text-sm font-semibold text-amber-100 transition hover:border-amber-300/40 hover:bg-amber-400/16"
              >
                إعادة استيراد من projects-data.ts (dev)
              </button>
            </form>
          ) : undefined
        }
      />

      <AdminInfoBar
        label="Projects CMS Core"
        description="Phase 1 — بناء نواة CMS فقط. رحلة التنفيذ لم تُنقل بعد."
        meta={`${counts.residential} Residential / ${counts.commercial} Commercial / ${tableStatus.count} Total`}
      />

      {notice ? <AdminNotice variant="success" message={notice} /> : null}
      {errorMessage ? <AdminNotice variant="danger" title="تعذر تنفيذ العملية" message={errorMessage} /> : null}

      {tableStatus.count === 0 && !reimportAllowed ? (
        <AdminNotice
          variant="danger"
          title="لا توجد مشاريع في Supabase"
          message="الاستيراد التلقائي من projects-data.ts معطّل في الإنتاج. أضف المشاريع من لوحة التحكم أو نفّذ الاستيراد في بيئة التطوير."
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

      {reimportAllowed ? (
        <div className="rounded-[22px] border border-amber-400/15 bg-amber-400/[0.04] px-5 py-4 text-sm text-white/45">
          <p>
            مصدر البذرة (تطوير فقط):{" "}
            <code className="font-en text-amber-100/80">config/projects-data.ts</code>
            {" — "}
            الاستيراد idempotent ويعتمد على slug. لا يُستخدم في الإنتاج بعد الإطلاق.
          </p>
        </div>
      ) : (
        <div className="rounded-[22px] border border-white/10 bg-white/[0.02] px-5 py-4 text-sm text-white/45">
          <p>
            المصدر الوحيد للواجهة العامة:{" "}
            <Link href="/admin/projects/residential" className="text-[#D8B87A] hover:underline">
              Supabase projects
            </Link>
            . استيراد الملف الثابت معطّل في هذه البيئة.
          </p>
        </div>
      )}
    </main>
  );
}
