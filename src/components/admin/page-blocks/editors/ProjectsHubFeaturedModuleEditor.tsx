"use client";

import {
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorSection,
  ModuleEditorSectionHeading,
  ModuleEditorVisibilityAlignRow,
} from "../ModuleEditorPresentation";

import {
  AdminFormGrid,
  AdminFormListboxSelect,
  AdminFormSwitch,
} from "../../ui";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import { resolvePageBlockTextFormat } from "../../../../lib/page-blocks/configs";
import {
  PROJECTS_HUB_FEATURED_SELECTION_MODES,
  type ProjectsHubFeaturedModuleConfig,
} from "../../../../lib/page-blocks/projects-hub-config";

type ProjectsHubFeaturedModuleEditorProps = {
  config: ProjectsHubFeaturedModuleConfig;
};

const FEATURED_SELECTION_MODE_OPTIONS =
  PROJECTS_HUB_FEATURED_SELECTION_MODES.map((mode) => ({
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

export default function ProjectsHubFeaturedModuleEditor({
  config,
}: ProjectsHubFeaturedModuleEditorProps) {
  const titleFormat = resolvePageBlockTextFormat(config, "title", {
    bold: true,
  });
  const subtitleFormat = resolvePageBlockTextFormat(config, "subtitle");
  return (
    <div className="space-y-6">
      <input type="hidden" name="config_schema" value="projects-hub-featured" />

      <ModuleEditorSection>
        <p className="text-xs leading-6 text-white/45">
          يتحكّم في عنوان القسم فقط، وليس في بيانات المشروعات.
        </p>

        <ModuleEditorFieldGrid>
          <ModuleEditorField nature="short-text" span={6}>
            <ModuleEditorVisibilityAlignRow
              label="العنوان"
              showName="show_title"
              boldName="title_bold"
              alignmentName="title_alignment"
              showDefault={config.showTitle !== false && titleFormat.visible}
              boldDefault={titleFormat.bold}
              alignmentDefault={titleFormat.alignment}
            >
              <input
                name="title"
                aria-label="العنوان"
                defaultValue={config.title}
                className={fieldClassName("h-11 min-w-0")}
              />
            </ModuleEditorVisibilityAlignRow>
          </ModuleEditorField>
          <ModuleEditorField nature="short-text" span={6}>
            <ModuleEditorVisibilityAlignRow
              label="العنوان الفرعي"
              showName="show_subtitle"
              boldName="subtitle_bold"
              alignmentName="subtitle_alignment"
              showDefault={
                config.showSubtitle !== false && subtitleFormat.visible
              }
              boldDefault={subtitleFormat.bold}
              alignmentDefault={subtitleFormat.alignment}
            >
              <input
                name="subtitle"
                aria-label="العنوان الفرعي"
                defaultValue={config.subtitle}
                className={fieldClassName("h-11 min-w-0")}
              />
            </ModuleEditorVisibilityAlignRow>
          </ModuleEditorField>
        </ModuleEditorFieldGrid>
      </ModuleEditorSection>

      <ModuleEditorSection>
        <ModuleEditorSectionHeading intent="domain">
          البيانات الظاهرة داخل المشروع المميز
        </ModuleEditorSectionHeading>
        <p className="text-xs leading-6 text-white/45">
          إظهار أو إخفاء الحقول المعروضة حالياً داخل البطاقة الرئيسية والبطاقات
          الجانبية. لا يغيّر قيم المشروع.
        </p>

        <AdminFormGrid columns={4}>
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
        <ModuleEditorSectionHeading
          intent="settings"
          actions={
            <VisibilityToggle
              name="show_slider_dots"
              label="إظهار مؤشر السلايد"
              defaultChecked={config.showSliderDots !== false}
            />
          }
        >
          إعدادات عرض المشروعات المميزة
        </ModuleEditorSectionHeading>

        <AdminFormGrid columns={3} className="mt-4">
          <AdminFormListboxSelect
            name="selection_mode"
            label="قاعدة الاختيار"
            defaultValue={config.selectionMode}
            options={FEATURED_SELECTION_MODE_OPTIONS}
            hint="الاختيار يعتمد على حقل featured في سجلات المشروعات — وليس اختياراً يدوياً من هذا المحرر."
          />

          <label className="block space-y-2">
            <span className="text-xs font-semibold text-white/55">
              الحد الأقصى (اختياري)
            </span>
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
            <span className="text-xs font-semibold text-white/55">
              التشغيل التلقائي (مللي ثانية)
            </span>
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
        </AdminFormGrid>
      </ModuleEditorSection>
    </div>
  );
}
