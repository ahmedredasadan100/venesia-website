"use client";

import Link from "next/link";

import { AdminActionButton, AdminCard, AdminPageHeader, AdminStatusPill } from "../../../../components/admin/ui";
import type {
  ConstructionProjectRow,
  ConstructionSiteUpdateRow,
} from "../../../../lib/admin/projects/construction-updates-query";

const STATUS_LABELS: Record<string, string> = {
  "under-construction": "تحت الإنشاء",
  excavation: "حفر وأساسات",
  "near-delivery": "قرب التسليم",
  delivered: "تم التسليم",
};

function publicationTone(status: string | null) {
  if (status === "published") return "green" as const;
  if (status === "archived") return "muted" as const;
  return "gold" as const;
}

type ConstructionUpdatesClientProps = {
  projects: ConstructionProjectRow[];
  siteUpdates: ConstructionSiteUpdateRow[];
};

export default function ConstructionUpdatesClient({ projects, siteUpdates }: ConstructionUpdatesClientProps) {
  const activeProjects = projects.filter((row) => row.publication_status !== "archived");
  const withProgress = projects.filter((row) => row.progress > 0);
  const publishedUpdates = siteUpdates.filter((row) => row.status === "published");

  return (
    <main className="space-y-7">
      <AdminPageHeader
        variant="context"
        eyebrow="PROJECTS INTELLIGENCE"
        title="تحديثات التنفيذ"
        description="لوحة تخطيط للقراءة فقط — تربط حالة المشاريع السكنية بمحتوى «من أرض التنفيذ» الحالي."
        contextLine="لا توجد جداول جديدة — البيانات من projects و topics (site_update)."
        actions={
          <>
            <AdminActionButton href="/admin/projects/residential" variant="dark">
              المشاريع السكنية
            </AdminActionButton>
            <AdminActionButton href="/admin/content/media?content_type=site_update" variant="dark">
              محتوى من أرض التنفيذ
            </AdminActionButton>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <AdminCard className="p-5">
          <p className="text-xs text-white/45">مشاريع سكنية نشطة</p>
          <p className="mt-2 text-3xl font-semibold text-white">{activeProjects.length}</p>
        </AdminCard>
        <AdminCard className="p-5">
          <p className="text-xs text-white/45">مشاريع بنسبة تقدم</p>
          <p className="mt-2 text-3xl font-semibold text-[#D8B87A]">{withProgress.length}</p>
        </AdminCard>
        <AdminCard className="p-5">
          <p className="text-xs text-white/45">تحديثات مواقع منشورة</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-200">{publishedUpdates.length}</p>
        </AdminCard>
      </div>

      <AdminCard className="p-6">
        <h2 className="text-lg font-semibold text-white">حالة المشاريع السكنية</h2>
        <p className="mt-2 text-sm text-white/45">
          قراءة من الحقول الحالية: status · progress · publication_status
        </p>

        <div className="mt-5 space-y-2">
          {projects.length ? (
            projects.map((project) => (
              <div
                key={project.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-white/8 bg-black/20 px-4 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/admin/projects/${project.id}`}
                    className="font-semibold text-white hover:text-[#D8B87A]"
                  >
                    {project.arabic_name}
                  </Link>
                  <p className="mt-1 font-en text-xs text-white/35" dir="ltr">
                    {project.code} · {STATUS_LABELS[project.status] ?? project.status}
                    {project.progress > 0 ? ` · ${project.progress}%` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <AdminStatusPill tone={publicationTone(project.publication_status)}>
                    {project.publication_status}
                  </AdminStatusPill>
                  <Link
                    href={`/track-your-project/${project.slug}`}
                    target="_blank"
                    className="text-xs text-white/40 hover:text-[#D8B87A]"
                  >
                    مسار المتابعة
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-white/45">لا توجد مشاريع سكنية بعد.</p>
          )}
        </div>
      </AdminCard>

      <AdminCard className="p-6">
        <h2 className="text-lg font-semibold text-white">محتوى «من أرض التنفيذ»</h2>
        <p className="mt-2 text-sm text-white/45">
          أحدث عناصر site_update من جدول topics — يمكن ربطها بالمشاريع لاحقًا عبر migration مقترح.
        </p>

        <div className="mt-5 space-y-2">
          {siteUpdates.length ? (
            siteUpdates.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-white/8 bg-black/20 px-4 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/admin/content/media/${item.id}`}
                    className="font-semibold text-white hover:text-[#D8B87A]"
                  >
                    {item.title}
                  </Link>
                  <p className="mt-1 font-en text-xs text-white/35" dir="ltr">
                    /media-center/site-updates/{item.slug}
                  </p>
                </div>
                <AdminStatusPill tone={publicationTone(item.status)}>
                  {item.status ?? "draft"}
                </AdminStatusPill>
              </div>
            ))
          ) : (
            <p className="text-sm text-white/45">لا يوجد محتوى site_update بعد.</p>
          )}
        </div>
      </AdminCard>

      <div className="rounded-[20px] border border-amber-400/15 bg-amber-500/8 px-5 py-4 text-sm leading-7 text-amber-100/85">
        المرحلة التالية (تتطلب موافقة migration): جدول project_construction_updates وربطه بالمشاريع
        وعرض ديناميكي في Track Your Project.
      </div>
    </main>
  );
}
