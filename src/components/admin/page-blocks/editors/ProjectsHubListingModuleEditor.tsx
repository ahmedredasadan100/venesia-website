"use client";

import Link from "next/link";

import AdminNotice from "../../AdminNotice";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import {
  PROJECTS_HUB_VIEW_MODES,
  type ProjectsHubListingModuleConfig,
} from "../../../../lib/page-blocks/projects-hub-config";

type ProjectsHubListingModuleEditorProps = {
  config: ProjectsHubListingModuleConfig;
};

function VisibilityToggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white/70">
      <span>{label}</span>
      <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} />
    </label>
  );
}

export default function ProjectsHubListingModuleEditor({ config }: ProjectsHubListingModuleEditorProps) {
  return (
    <div className="space-y-6">
      <input type="hidden" name="config_schema" value="projects-hub-listing" />
      {/* Filters are derived from loaded project types on the public page — not Admin-selected. */}
      <input type="hidden" name="default_filter" value="all" />
      <input type="hidden" name="visible_filters" value="all" />
      <input type="hidden" name="visible_filters" value="residential" />
      <input type="hidden" name="visible_filters" value="commercial" />
      <input type="hidden" name="sort" value={config.sort || "homepage_order"} />

      <AdminNotice
        variant="info"
        title="بيانات المشروعات"
        message="تحكّم في العناصر الظاهرة داخل قائمة المشروعات. بيانات كل مشروع نفسها تُدار من قسم إدارة المشروعات."
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
        <h2 className="text-sm font-semibold text-white">عنوان قسم قائمة المشروعات</h2>
        <p className="text-xs leading-6 text-white/45">
          يتحكّم في عنوان قسم القائمة فقط، وليس في بيانات المشروعات.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <VisibilityToggle
            name="show_eyebrow"
            label="إظهار النص التمهيدي"
            defaultChecked={config.showEyebrow !== false}
          />
          <VisibilityToggle
            name="show_title"
            label="إظهار عنوان القسم"
            defaultChecked={config.showTitle !== false}
          />
        </div>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">النص التمهيدي الحالي</span>
          <input name="eyebrow" defaultValue={config.eyebrow} className={fieldClassName()} dir="ltr" />
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">عنوان القسم الحالي</span>
          <input name="title" defaultValue={config.title} className={fieldClassName()} />
        </label>
      </section>

      <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
        <h2 className="text-sm font-semibold text-white">فلاتر المشروعات</h2>
        <p className="text-xs leading-6 text-white/45">
          خيارات الفلاتر (الكل / سكني / تجاري وأي نوع مدعوم مستقبلاً) تُشتق تلقائياً من أنواع المشروعات
          المحمّلة في صفحة المشروعات.
        </p>

        <VisibilityToggle
          name="show_filter_bar"
          label="إظهار شريط الفلاتر"
          defaultChecked={config.showFilterBar !== false}
        />
      </section>

      <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
        <h2 className="text-sm font-semibold text-white">البيانات الظاهرة داخل بطاقة المشروع</h2>
        <p className="text-xs leading-6 text-white/45">
          إظهار أو إخفاء الحقول المعروضة حالياً داخل البطاقة فقط. لا يغيّر قيم المشروع في قاعدة البيانات.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <VisibilityToggle
            name="show_project_image"
            label="إظهار صورة المشروع"
            defaultChecked={config.showProjectImage !== false}
          />
          <VisibilityToggle
            name="show_project_code"
            label="إظهار كود المشروع"
            defaultChecked={config.showProjectCode !== false}
          />
          <VisibilityToggle
            name="show_project_description"
            label="إظهار وصف المشروع"
            defaultChecked={config.showProjectDescription !== false}
          />
          <VisibilityToggle
            name="show_project_type"
            label="إظهار نوع المشروع"
            defaultChecked={config.showProjectType !== false}
          />
          <VisibilityToggle
            name="show_project_location"
            label="إظهار الموقع"
            defaultChecked={config.showProjectLocation !== false}
          />
          <VisibilityToggle
            name="show_explore_button"
            label="إظهار زر استكشف المشروع"
            defaultChecked={config.showExploreButton !== false}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
        <h2 className="text-sm font-semibold text-white">إعدادات عرض القائمة</h2>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">عدد المشروعات في الصفحة</span>
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
          <span className="text-xs font-semibold text-white/55">وضع العرض الافتراضي</span>
          <select name="default_view" defaultValue={config.defaultView} className={fieldClassName()}>
            {PROJECTS_HUB_VIEW_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode === "list" ? "قائمة" : "بطاقات"}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <VisibilityToggle
            name="show_view_toggle"
            label="إظهار زر تغيير طريقة العرض"
            defaultChecked={config.showViewToggle !== false}
          />
          <VisibilityToggle
            name="show_pagination"
            label="إظهار ترقيم الصفحات"
            defaultChecked={config.showPagination !== false}
          />
          <VisibilityToggle
            name="show_project_count"
            label="إظهار عدد المشروعات"
            defaultChecked={config.showProjectCount !== false}
          />
        </div>
      </section>
    </div>
  );
}
