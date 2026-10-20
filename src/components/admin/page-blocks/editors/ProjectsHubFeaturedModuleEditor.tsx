"use client";

import {
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorSection,
  ModuleEditorSectionHeading,
  ModuleEditorVisibilityAlignRow,
} from "../ModuleEditorPresentation";

import {
  AdminCard,
  AdminFormControlHeader,
  AdminFormGrid,
  AdminFormListboxSelect,
  AdminFormSwitch,
} from "../../ui";
import { AdminModuleTabIcon } from "../../ui/AdminModuleTabs";
import { ADMIN_FORM } from "../../../../lib/admin/admin-ui-styles";
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
    <AdminCard presentation="premium" className="self-start p-3">
    <AdminFormSwitch
      name={name}
      label={<AdminFormControlHeader title={label} presentation="compact-inline" icon={<AdminModuleTabIcon name="publish" />} />}
      value="true"
      defaultChecked={defaultChecked}
      embedded
      embeddedLayout="inline"
    />
    </AdminCard>
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

      <>
        <p className="text-xs leading-6 text-white/45">
          يتحكّم في عنوان القسم فقط، وليس في بيانات المشروعات.
        </p>

        <ModuleEditorFieldGrid>
          <ModuleEditorField nature="short-text" span={6}>
            <ModuleEditorVisibilityAlignRow
              label="العنوان"
              presentation="premium"
              icon={<AdminModuleTabIcon name="content" />}
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
              presentation="premium"
              icon={<AdminModuleTabIcon name="content" />}
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
      </>

      <ModuleEditorSection>
        <ModuleEditorSectionHeading intent="domain">
          البيانات الظاهرة داخل المشروع المميز
        </ModuleEditorSectionHeading>
        <p className="text-xs leading-6 text-white/45">
          إظهار أو إخفاء الحقول المعروضة حالياً داخل البطاقة الرئيسية والبطاقات
          الجانبية. لا يغيّر قيم المشروع.
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
          <AdminCard presentation="premium" className="self-start p-3">
          <AdminFormListboxSelect
            name="selection_mode"
            label={<AdminFormControlHeader title="قاعدة الاختيار" presentation="compact-inline" icon={<AdminModuleTabIcon name="section" />} />}
            defaultValue={config.selectionMode}
            options={FEATURED_SELECTION_MODE_OPTIONS}
            hint="الاختيار يعتمد على حقل featured في سجلات المشروعات — وليس اختياراً يدوياً من هذا المحرر."
          />
          </AdminCard>

          <AdminCard presentation="premium" className="self-start p-3">
          <label className={ADMIN_FORM.labelStack}>
            <AdminFormControlHeader title="الحد الأقصى (اختياري)" presentation="compact-inline" icon={<AdminModuleTabIcon name="overview" />} />
            <input
              name="limit"
              type="number"
              min={1}
              max={48}
              defaultValue={config.limit ?? ""}
              placeholder="فارغ = بدون حد"
              dir="ltr"
              className={fieldClassName("h-11")}
            />
          </label>
          </AdminCard>

          <AdminCard presentation="premium" className="self-start p-3">
          <label className={ADMIN_FORM.labelStack}>
            <AdminFormControlHeader title="التشغيل التلقائي (مللي ثانية)" presentation="compact-inline" icon={<AdminModuleTabIcon name="settings" />} />
            <input
              name="autoplay_ms"
              type="number"
              min={1000}
              max={60000}
              step={500}
              defaultValue={config.autoplayMs}
              dir="ltr"
              className={fieldClassName("h-11")}
            />
          </label>
          </AdminCard>
        </AdminFormGrid>
      </ModuleEditorSection>
    </div>
  );
}
