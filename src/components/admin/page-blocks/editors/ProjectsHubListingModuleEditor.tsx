"use client";

import {
  ModuleEditorHeadingVisibilityRow,
  ModuleEditorSection,
} from "../ModuleEditorPresentation";
import { AdminFormGrid, AdminFormListboxSelect, AdminFormSwitch } from "../../ui";

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
  return <AdminFormSwitch name={name} label={label} value="true" defaultChecked={defaultChecked} surface />;
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

      <ModuleEditorSection>
        <h2 className="text-sm font-semibold text-white">عنوان قسم قائمة المشروعات</h2>
        <p className="text-xs leading-6 text-white/45">
          يتحكّم في عنوان قسم القائمة فقط، وليس في بيانات المشروعات.
        </p>

        <ModuleEditorHeadingVisibilityRow
          name="show_eyebrow"
          label="إظهار النص التمهيدي"
          defaultChecked={config.showEyebrow !== false}
        >
          <label className="block min-w-0 space-y-2">
            <span className="text-xs font-semibold text-white/55">النص التمهيدي الحالي</span>
            <input name="eyebrow" defaultValue={config.eyebrow} className={fieldClassName()} dir="ltr" />
          </label>
        </ModuleEditorHeadingVisibilityRow>

        <ModuleEditorHeadingVisibilityRow
          name="show_title"
          label="إظهار عنوان القسم"
          defaultChecked={config.showTitle !== false}
        >
          <label className="block min-w-0 space-y-2">
            <span className="text-xs font-semibold text-white/55">عنوان القسم الحالي</span>
            <input name="title" defaultValue={config.title} className={fieldClassName()} />
          </label>
        </ModuleEditorHeadingVisibilityRow>
      </ModuleEditorSection>

      <ModuleEditorSection>
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
      </ModuleEditorSection>

      <ModuleEditorSection>
        <h2 className="text-sm font-semibold text-white">البيانات الظاهرة داخل بطاقة المشروع</h2>
        <p className="text-xs leading-6 text-white/45">
          إظهار أو إخفاء الحقول المعروضة حالياً داخل البطاقة فقط. لا يغيّر قيم المشروع في قاعدة البيانات.
        </p>

        <AdminFormGrid columns={3}>
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
        </AdminFormGrid>
      </ModuleEditorSection>

      <ModuleEditorSection>
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

        <AdminFormListboxSelect
          name="default_view"
          label="وضع العرض الافتراضي"
          defaultValue={config.defaultView}
          options={PROJECTS_HUB_VIEW_MODES.map((mode) => ({
            value: mode,
            label: mode === "list" ? "قائمة" : "بطاقات",
          }))}
        />

        <AdminFormGrid columns={3}>
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
        </AdminFormGrid>
      </ModuleEditorSection>
    </div>
  );
}
