"use client";

import AdminNotice from "../../../../components/admin/AdminNotice";
import { AdminActionButton, AdminCard, AdminPageContextHeader, AdminStatusPill } from "../../../../components/admin/ui";
import type { TrackingHubProject } from "../../../../lib/admin/projects/tracking-hub";

export default function ConstructionUpdatesClient({ projects, schemaAvailable }: { projects: TrackingHubProject[]; schemaAvailable: boolean }) {
  return <main className="space-y-7" dir="rtl"><AdminPageContextHeader eyebrow="PROJECT TRACKING DOMAIN" title="متابعة تنفيذ المشروعات" description="بوابة اختيار المشروع للدخول إلى ملف Tracking المستقل، ومراحله وبنوده وتحديثاته التاريخية." actions={<AdminActionButton href="/admin/projects" variant="dark">العودة إلى مركز المشروعات</AdminActionButton>} />
    {!schemaAvailable ? <AdminNotice variant="warning" title="Migration مطلوبة" message="واجهة Tracking مكتملة في التطبيق، لكن جداول Tracking غير مطبقة على قاعدة البيانات الحالية. لم يتم تنفيذ أي Production mutation." /> : null}
    <div className="grid gap-4 md:grid-cols-3"><AdminCard className="p-5"><p className="text-xs text-white/45">المشروعات</p><p className="mt-2 text-3xl font-semibold">{projects.length}</p></AdminCard><AdminCard className="p-5"><p className="text-xs text-white/45">مراحل المتابعة</p><p className="mt-2 text-3xl font-semibold text-[#D8B87A]">{projects.reduce((sum, project) => sum + project.stageCount, 0)}</p></AdminCard><AdminCard className="p-5"><p className="text-xs text-white/45">التحديثات التاريخية</p><p className="mt-2 text-3xl font-semibold text-emerald-200">{projects.reduce((sum, project) => sum + project.updateCount, 0)}</p></AdminCard></div>
    <AdminCard className="p-5"><div className="space-y-2">{projects.map((project) => <div key={project.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{project.arabicName}</h2><AdminStatusPill tone={project.publicationStatus === "published" ? "green" : "gold"}>{project.publicationStatus === "published" ? "منشور" : "غير منشور"}</AdminStatusPill></div><p className="mt-1 text-xs text-white/40">{project.stageCount} مرحلة / {project.updateCount} تحديث</p></div><AdminActionButton href={`/admin/projects/${project.id}/tracking`} variant="dark">إدارة المتابعة</AdminActionButton></div>)}{!projects.length ? <p className="py-8 text-center text-white/45">لا توجد مشروعات.</p> : null}</div></AdminCard>
  </main>;
}
