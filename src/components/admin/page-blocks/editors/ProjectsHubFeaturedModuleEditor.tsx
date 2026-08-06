"use client";

import {
  ModuleEditorHeadingVisibilityRow,
  ModuleEditorSection,
} from "../ModuleEditorPresentation";

import {
  AdminFormGrid,
  AdminFormListboxSelect,
  AdminFormSwitch,
} from "../../ui";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import {
  PROJECTS_HUB_FEATURED_SELECTION_MODES,
  type ProjectsHubFeaturedModuleConfig,
} from "../../../../lib/page-blocks/projects-hub-config";

type ProjectsHubFeaturedModuleEditorProps = {
  config: ProjectsHubFeaturedModuleConfig;
};

const FEATURED_SELECTION_MODE_OPTIONS = PROJECTS_HUB_FEATURED_SELECTION_MODES.map((mode) => ({
  value: mode,
  label: mode === "featured_flag" ? "المشروعات ذات featured = true" : mode,
}));

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
    <AdminFormSwitch
      name={name}
      label={label}
      value="true"
      defaultChecked={defaultChecked}
      surface
    />
  );
}

function HeadingFieldRow({
  name,
  label,
  value,
  showName,
  showLabel,
  showDefault,
}: {
  name: string;
  label: string;
  value: string;
  showName: string;
  showLabel: string;
  showDefault: boolean;
}) {
  return (
    <ModuleEditorHeadingVisibilityRow
      name={showName}
      label={showLabel}
      defaultChecked={showDefault}
    >
      <label className="block min-w-0 space-y-2">
        <span className="text-xs font-semibold text-white/55">{label}</span>
        <input name={name} defaultValue={value} className={fieldClassName("h-11 min-w-0")} />
      </label>
    </ModuleEditorHeadingVisibilityRow>
  );
}

export default function ProjectsHubFeaturedModuleEditor({ config }: ProjectsHubFeaturedModuleEditorProps) {
  return (
    <div className="space-y-6">
      <input type="hidden" name="config_schema" value="projects-hub-featured" />

      <ModuleEditorSection>
        <h2 className="text-sm font-semibold text-white">عنوان قسم المشروعات المميزة</h2>
        <p className="text-xs leading-6 text-white/45">يتحكّم في عنوان القسم فقط، وليس في بيانات المشروعات.</p>

        <HeadingFieldRow
          name="title"
          label="العنوان"
          value={config.title}
          showName="show_title"
          showLabel="إظهار عنوان القسم"
          showDefault={config.showTitle !== false}
        />

        <HeadingFieldRow
          name="subtitle"
          label="العنوان الفرعي"
          value={config.subtitle}
          showName="show_subtitle"
          showLabel="إظهار العنوان الفرعي"
          showDefault={config.showSubtitle !== false}
        />
      </ModuleEditorSection>

      <ModuleEditorSection>
        <h2 className="text-sm font-semibold text-white">البيانات الظاهرة داخل المشروع المميز</h2>
        <p className="text-xs leading-6 text-white/45">
          إظهار أو إخفاء الحقول المعروضة حالياً داخل البطاقة الرئيسية والبطاقات الجانبية. لا يغيّر قيم المشروع.
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
            label="إظهار زر استكشف التفاصيل"
            defaultChecked={config.showExploreButton !== false}
          />
        </AdminFormGrid>
      </ModuleEditorSection>

      <ModuleEditorSection>
        <h2 className="text-sm font-semibold text-white">إعدادات عرض المشروعات المميزة</h2>

        <AdminFormListboxSelect
          name="selection_mode"
          label="قاعدة الاختيار"
          defaultValue={config.selectionMode}
          options={FEATURED_SELECTION_MODE_OPTIONS}
          hint="الاختيار يعتمد على حقل featured في سجلات المشروعات — وليس اختياراً يدوياً من هذا المحرر."
        />

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">الحد الأقصى (اختياري)</span>
          <input
            name="limit"
            type="number"
            min={1}
            max={48}
            defaultValue={config.limit ?? ""}
            placeholder="فارغ = بدون حد"
            dir="ltr"
            className={fieldClassName()}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">التشغيل التلقائي (مللي ثانية)</span>
          <input
            name="autoplay_ms"
            type="number"
            min={1000}
            max={60000}
            step={500}
            defaultValue={config.autoplayMs}
            dir="ltr"
            className={fieldClassName()}
          />
        </label>

        <VisibilityToggle
          name="show_slider_dots"
          label="إظهار مؤشرات السلايدر"
          defaultChecked={config.showSliderDots !== false}
        />
      </ModuleEditorSection>
    </div>
  );
}
