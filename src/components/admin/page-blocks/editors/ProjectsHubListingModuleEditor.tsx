"use client";

import Link from "next/link";

import AdminNotice from "../../AdminNotice";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import {
  PROJECTS_HUB_SORT_MODES,
  PROJECTS_HUB_VIEW_MODES,
  type ProjectsHubListingModuleConfig,
} from "../../../../lib/page-blocks/projects-hub-config";

type ProjectsHubListingModuleEditorProps = {
  config: ProjectsHubListingModuleConfig;
};

export default function ProjectsHubListingModuleEditor({ config }: ProjectsHubListingModuleEditorProps) {
  return (
    <div className="space-y-6">
      <input type="hidden" name="config_schema" value="projects-hub-listing" />
      {/* Filters are derived from loaded project types on the public page — not Admin-selected. */}
      <input type="hidden" name="default_filter" value="all" />
      <input type="hidden" name="visible_filters" value="all" />
      <input type="hidden" name="visible_filters" value="residential" />
      <input type="hidden" name="visible_filters" value="commercial" />

      <AdminNotice
        variant="info"
        title="بيانات المشروعات"
        message="بيانات المشروعات نفسها تُدار من قسم إدارة المشروعات. فلاتر القائمة (الكل / سكني / تجاري) تُشتق تلقائياً من أنواع المشروعات المنشورة، وليست اختياراً من هذا المحرر."
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
