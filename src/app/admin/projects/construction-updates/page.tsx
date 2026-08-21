import Link from "next/link";

import AdminNotice from "../../../../components/admin/AdminNotice";
import {
  AdminActionButton,
  AdminCard,
  AdminListEmptyState,
  AdminMetricCardsGrid,
  AdminPageContextHeader,
  AdminPageExperience,
  AdminStatusPill,
  type AdminMetricCardsGridItem,
} from "../../../../components/admin/ui";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { loadProjectTrackingHub } from "../../../../lib/admin/projects/tracking-hub";

export const dynamic = "force-dynamic";

export default async function ConstructionUpdatesPage() {
  await requireAdminSession();
  const { projects, schemaAvailable } = await loadProjectTrackingHub();
  const metricItems: AdminMetricCardsGridItem[] = [
    {
      label: "المشروعات المتاحة",
      value: projects.length,
      tone: "blue",
      align: "start",
    },
    {
      label: "مراحل المتابعة",
      value: projects.reduce(
        (total, project) => total + project.stageCount,
        0,
      ),
      tone: "gold",
      align: "start",
    },
    {
      label: "التحديثات التاريخية",
      value: projects.reduce(
        (total, project) => total + project.updateCount,
        0,
      ),
      tone: "green",
      align: "start",
    },
  ];

  return (
    <AdminPageExperience
      dir="rtl"
      state={projects.length > 0 ? "ready" : "empty"}
    >
      <AdminPageContextHeader
        eyebrow="PROJECT TRACKING DOMAIN"
        title="متابعة تنفيذ المشروعات"
        description="اختر مشروعًا للدخول إلى ملف المتابعة المستقل، ومراحله وبنوده وتحديثاته التاريخية."
        meta={`${projects.length} مشروع`}
        actions={
          <AdminActionButton href="/admin/projects" variant="dark">
            العودة إلى مركز المشروعات
          </AdminActionButton>
        }
      />

      {!schemaAvailable ? (
        <AdminNotice
          variant="warning"
          title="Migration مطلوبة"
          message="واجهة Tracking مكتملة في التطبيق، لكن جداول Tracking غير مطبقة على قاعدة البيانات الحالية. لم يتم تنفيذ أي Production mutation."
        />
      ) : null}

      <AdminMetricCardsGrid items={metricItems} />

      <section aria-labelledby="construction-updates-projects-title">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="construction-updates-projects-title"
              className="text-xl font-semibold text-white"
            >
              ملفات متابعة المشروعات
            </h2>
            <p className="mt-2 text-sm leading-7 text-white/52">
              اختر المشروع المطلوب لعرض حالة التنفيذ وإدارة مراحله وبنوده
              وتحديثاته.
            </p>
          </div>
          <AdminStatusPill tone={schemaAvailable ? "green" : "gold"}>
            {schemaAvailable ? "نظام المتابعة متاح" : "نظام المتابعة قيد التجهيز"}
          </AdminStatusPill>
        </div>

        {projects.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/admin/projects/${project.id}/tracking`}
                aria-label={`فتح ملف متابعة مشروع ${project.arabicName}`}
                className="group block h-full rounded-[28px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070A]"
              >
                <AdminCard
                  interactive
                  className="flex h-full min-h-[220px] flex-col p-5 md:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D8B87A]/65">
                        Project Tracking
                      </p>
                      <h3 className="mt-3 break-words text-xl font-semibold text-white">
                        {project.arabicName}
                      </h3>
                    </div>
                    <AdminStatusPill
                      tone={
                        project.publicationStatus === "published"
                          ? "green"
                          : "gold"
                      }
                    >
                      {project.publicationStatus === "published"
                        ? "منشور"
                        : "غير منشور"}
                    </AdminStatusPill>
                  </div>

                  <dl className="mt-6 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                      <dt className="text-xs text-white/42">المراحل</dt>
                      <dd className="mt-2 text-2xl font-semibold text-[#D8B87A]">
                        {project.stageCount}
                      </dd>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                      <dt className="text-xs text-white/42">التحديثات</dt>
                      <dd className="mt-2 text-2xl font-semibold text-emerald-200">
                        {project.updateCount}
                      </dd>
                    </div>
                  </dl>

                  <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold text-[#D8B87A]">
                    فتح ملف المتابعة
                    <span aria-hidden="true">←</span>
                  </span>
                </AdminCard>
              </Link>
            ))}
          </div>
        ) : (
          <AdminCard>
            <AdminListEmptyState
              title="لا توجد مشروعات متاحة للمتابعة"
              description="أنشئ مشروعًا أو راجع مركز المشروعات قبل بدء متابعة التنفيذ."
              action={{
                href: "/admin/projects",
                label: "فتح مركز المشروعات",
              }}
            />
          </AdminCard>
        )}
      </section>
    </AdminPageExperience>
  );
}
