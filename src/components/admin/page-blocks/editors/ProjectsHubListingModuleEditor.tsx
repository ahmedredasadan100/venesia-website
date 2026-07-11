"use client";

import Link from "next/link";

import AdminNotice from "../../AdminNotice";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import {
  PROJECTS_HUB_FILTER_IDS,
  PROJECTS_HUB_SORT_MODES,
  PROJECTS_HUB_VIEW_MODES,
  type ProjectsHubFilterId,
  type ProjectsHubListingModuleConfig,
} from "../../../../lib/page-blocks/projects-hub-config";

type ProjectsHubListingModuleEditorProps = {
  config: ProjectsHubListingModuleConfig;
};

const FILTER_LABELS: Record<ProjectsHubFilterId, string> = {
  all: "الكل",
  residential: "سكني",
  commercial: "تجاري",
};

export default function ProjectsHubListingModuleEditor({ config }: ProjectsHubListingModuleEditorProps) {
  return (
    <div className="space-y-6">
      <input type="hidden" name="config_schema" value="projects-hub-listing" />

      <AdminNotice
        variant="info"
        title="بيانات المشروعات"
        message="بيانات المشروعات نفسها تُدار من قسم إدارة المشروعات. هذا الموديول يضبط عنوان القائمة والفلاتر وطريقة العرض فقط."
      />

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/admin/projects" className="text-[#D8B87A] underline-offset-2 hover:underline">
          إدارة بيانات المشروعات
        </Link>
        <Link href="/projects" target="_blank" rel="noreferrer" className="text-white/55 underline-offset-2 hover:underline">
          معاينة صفحة المشروعات
        </Link>
      </div>

      <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
        <h2 className="text-sm font-semibold text-white">قائمة المشروعات</h2>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">Eyebrow</span>
          <input name="eyebrow" defaultValue={config.eyebrow} className={fieldClassName()} dir="ltr" />
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">العنوان</span>
          <input name="title" defaultValue={config.title} className={fieldClassName()} />
        </label>

        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold text-white/55">الفلاتر الظاهرة</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {PROJECTS_HUB_FILTER_IDS.map((filterId) => (
              <label
                key={filterId}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white/70"
              >
                <span>{FILTER_LABELS[filterId]}</span>
                <input
                  type="checkbox"
                  name="visible_filters"
                  value={filterId}
                  defaultChecked={config.visibleFilters.includes(filterId)}
                />
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">الفلتر الافتراضي</span>
          <select name="default_filter" defaultValue={config.defaultFilter} className={fieldClassName()}>
            {PROJECTS_HUB_FILTER_IDS.map((filterId) => (
              <option key={filterId} value={filterId}>
                {FILTER_LABELS[filterId]}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">وضع العرض الافتراضي</span>
          <select name="default_view" defaultValue={config.defaultView} className={fieldClassName()}>
            {PROJECTS_HUB_VIEW_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode === "list" ? "قائمة" : "بطاقات"}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">عدد العناصر في الصفحة</span>
          <input
            name="page_size"
            type="number"
            min={1}
            max={48}
            defaultValue={config.pageSize}
            dir="ltr"
            className={fieldClassName()}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">الترتيب</span>
          <select name="sort" defaultValue={config.sort} className={fieldClassName()} dir="ltr">
            {PROJECTS_HUB_SORT_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode === "homepage_order" ? "homepage_order" : mode}
              </option>
            ))}
          </select>
        </label>
      </section>
    </div>
  );
}
