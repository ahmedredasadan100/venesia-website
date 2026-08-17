"use client";

import {
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorHeadingVisibilityRow,
  ModuleEditorSection,
  ModuleEditorSectionHeading,
} from "../ModuleEditorPresentation";
import { AdminFormGrid, AdminFormListboxSelect, AdminFormSwitch } from "../../ui";

import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import {
  PROJECTS_HUB_FILTER_IDS,
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
      <input type="hidden" name="sort" value={config.sort || "homepage_order"} />

      <ModuleEditorSection>
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
        <ModuleEditorSectionHeading intent="domain">فلاتر المشروعات</ModuleEditorSectionHeading>
        <p className="text-xs leading-6 text-white/45">
          لا تظهر شريحة لنوع لا توجد له مشروعات منشورة، حتى لو كانت مفعلة هنا.
        </p>

        <ModuleEditorFieldGrid>
          <ModuleEditorField nature="standard" span={4}>
            <AdminFormListboxSelect
              name="default_filter"
              label="الفلتر الافتراضي"
              defaultValue={config.defaultFilter}
              options={PROJECTS_HUB_FILTER_IDS.map((filter) => ({
                value: filter,
                label: filter === "all" ? "كل المشروعات" : filter === "residential" ? "سكني" : "تجاري",
              }))}
            />
          </ModuleEditorField>
          <ModuleEditorField nature="standard" span={8}>
            <div className="grid gap-3 sm:grid-cols-3">
              {PROJECTS_HUB_FILTER_IDS.map((filter) => (
                <AdminFormSwitch
                  key={filter}
                  name="visible_filters"
                  label={filter === "all" ? "كل المشروعات" : filter === "residential" ? "سكني" : "تجاري"}
                  value={filter}
                  defaultChecked={config.visibleFilters.includes(filter)}
                  surface
                />
              ))}
            </div>
          </ModuleEditorField>
        </ModuleEditorFieldGrid>

        <VisibilityToggle
          name="show_filter_bar"
          label="إظهار شريط الفلاتر"
          defaultChecked={config.showFilterBar !== false}
        />
      </ModuleEditorSection>

      <ModuleEditorSection>
        <ModuleEditorSectionHeading intent="domain">البيانات الظاهرة داخل بطاقة المشروع</ModuleEditorSectionHeading>
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
            name="show_project_name"
            label="إظهار اسم المشروع"
            defaultChecked={config.showProjectName !== false}
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
        <ModuleEditorSectionHeading intent="settings">إعدادات عرض القائمة</ModuleEditorSectionHeading>

        <ModuleEditorFieldGrid>
        <ModuleEditorField nature="technical" span={4}><label className="block space-y-2">
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
        </label></ModuleEditorField>

        <ModuleEditorField nature="standard" span={8}><AdminFormListboxSelect
          name="default_view"
          label="وضع العرض الافتراضي"
          defaultValue={config.defaultView}
          options={PROJECTS_HUB_VIEW_MODES.map((mode) => ({
            value: mode,
            label: mode === "list" ? "قائمة" : "بطاقات",
          }))}
        /></ModuleEditorField>
        </ModuleEditorFieldGrid>

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
