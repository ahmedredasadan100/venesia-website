"use client";

import Link from "next/link";

import { AdminActionButton, AdminCard, AdminPageHeader, AdminStatusPill } from "../../../../components/admin/ui";
import { getContentStatusMetadata } from "../../../../lib/admin/content/content-status-metadata";
import type {
  ConstructionProjectRow,
  ConstructionSiteUpdateRow,
} from "../../../../lib/admin/projects/construction-updates-query";

type ConstructionUpdatesClientProps = {
  projects: ConstructionProjectRow[];
  siteUpdates: ConstructionSiteUpdateRow[];
};

export default function ConstructionUpdatesClient({ projects, siteUpdates }: ConstructionUpdatesClientProps) {
  const publishedUpdates = siteUpdates.filter((row) => row.status === "published");

  return (
    <main className="space-y-7">
      <AdminPageHeader
        eyebrow="PROJECT INSIGHTS"
        title="تحديثات التنفيذ"
        description="لوحة تخطيط للقراءة فقط — تجمع المشاريع السكنية مع محتوى «من أرض التنفيذ» الحالي. لا توجد جداول جديدة؛ القراءة من بيانات المشروعات ومحتوى تحديثات مواقع التنفيذ."
        actions={
          <>
            <AdminActionButton href="/admin/projects" variant="dark">
              العودة إلى مركز المشاريع
            </AdminActionButton>
            <AdminActionButton href="/admin/projects/residential" variant="dark">
              المشاريع السكنية
            </AdminActionButton>
            <AdminActionButton href="/admin/content/topics?content_type=site_update" variant="dark">
              محتوى من أرض التنفيذ
            </AdminActionButton>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <AdminCard className="p-5">
          <p className="text-xs text-white/45">المشاريع السكنية</p>
          <p className="mt-2 text-3xl font-semibold text-white">{projects.length}</p>
        </AdminCard>
        <AdminCard className="p-5">
          <p className="text-xs text-white/45">تحديثات المواقع المعروضة</p>
          <p className="mt-2 text-3xl font-semibold text-[#D8B87A]">{siteUpdates.length}</p>
        </AdminCard>
        <AdminCard className="p-5">
          <p className="text-xs text-white/45">التحديثات المنشورة ضمن المعروض</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-200">{publishedUpdates.length}</p>
        </AdminCard>
      </div>

      <AdminCard className="p-6">
        <h2 className="text-lg font-semibold text-white">المشاريع السكنية</h2>
        <p className="mt-2 text-sm text-white/45">
          قراءة متوافقة من بيانات المشروع الأساسية في المخطط الحالي.
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
                    /{project.slug}
                  </p>
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
          أحدث عناصر تحديثات مواقع التنفيذ من جدول المحتوى — ويمكن ربطها بالمشروعات لاحقًا عبر ترحيل معتمد.
        </p>

        <div className="mt-5 space-y-2">
          {siteUpdates.length ? (
            siteUpdates.map((item) => {
              const statusMetadata = getContentStatusMetadata(item.status);

              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-white/8 bg-black/20 px-4 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/admin/content/topics/${item.id}`}
                      className="font-semibold text-white hover:text-[#D8B87A]"
                    >
                      {item.title}
                    </Link>
                    <p className="mt-1 font-en text-xs text-white/35" dir="ltr">
                      /media-center/site-updates/{item.slug}
                    </p>
                  </div>
                  <AdminStatusPill tone={statusMetadata.tone}>
                    {statusMetadata.label}
                  </AdminStatusPill>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-white/45">لا يوجد محتوى لتحديثات مواقع التنفيذ بعد.</p>
          )}
        </div>
      </AdminCard>

      <div className="rounded-[20px] border border-amber-400/15 bg-amber-500/8 px-5 py-4 text-sm leading-7 text-amber-100/85">
        المرحلة التالية تتطلب موافقة على ترحيل مستقل: إنشاء جدول مخصص لتحديثات التنفيذ وربطه بالمشروعات
        ثم عرضه ديناميكيًا في مسار متابعة المشروع.
      </div>
    </main>
  );
}
