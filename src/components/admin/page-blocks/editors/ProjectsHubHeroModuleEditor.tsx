"use client";

import { ModuleEditorField, ModuleEditorFieldGrid, ModuleEditorSection, ModuleEditorSectionHeading } from "../ModuleEditorPresentation";
import { AdminFormGrid, AdminFormListboxSelect, AdminFormSwitch } from "../../ui";

import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import {
  PROJECTS_HUB_HERO_SELECTION_MODES,
  PROJECTS_HUB_HERO_PROJECT_TYPES,
  PROJECTS_HUB_HERO_VARIANTS,
  type ProjectsHubHeroModuleConfig,
} from "../../../../lib/page-blocks/projects-hub-config";

type ProjectsHubHeroModuleEditorProps = {
  config: ProjectsHubHeroModuleConfig;
};

export default function ProjectsHubHeroModuleEditor({ config }: ProjectsHubHeroModuleEditorProps) {
  const orderedReferences = [...config.projectReferences]
    .filter((reference) => reference.visible)
    .sort((left, right) => left.order - right.order)
    .map((reference) => reference.projectId)
    .join(", ");
  const hiddenReferences = config.projectReferences
    .filter((reference) => !reference.visible)
    .map((reference) => reference.projectId)
    .join(", ");

  return (
    <div className="space-y-6">
      <input type="hidden" name="config_schema" value="projects-hub-hero" />

      <ModuleEditorSection>
        <ModuleEditorFieldGrid>
        <ModuleEditorField nature="standard" span={4}><AdminFormListboxSelect
          name="selection_mode"
          label="طريقة اختيار الشرائح"
          defaultValue={config.selectionMode}
          options={PROJECTS_HUB_HERO_SELECTION_MODES.map((mode) => ({
            value: mode,
            label: mode === "domain_projects" ? "بيانات المشروعات — عبر Project Adapter" : mode,
          }))}
          dir="ltr"
        /></ModuleEditorField>

        <ModuleEditorField nature="standard" span={4}><AdminFormListboxSelect
          name="project_type"
          label="نوع المشروعات"
          defaultValue={config.projectType}
          options={PROJECTS_HUB_HERO_PROJECT_TYPES.map((type) => ({
            value: type,
            label: type === "residential" ? "سكني" : type === "commercial" ? "تجاري" : "سكني وتجاري",
          }))}
        /></ModuleEditorField>

        <ModuleEditorField nature="standard" span={4}><AdminFormListboxSelect
          name="hero_variant"
          label="نسخة عرض الهيرو"
          defaultValue={config.variant}
          options={PROJECTS_HUB_HERO_VARIANTS.map((variant) => ({
            value: variant,
            label: variant === "home-cinematic" ? "سينمائي متعدد الشرائح" : "صفحة داخلية",
          }))}
          dir="ltr"
        /></ModuleEditorField>

        <ModuleEditorField nature="technical" span={3}><label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">الحد الأقصى للشرائح</span>
          <input name="limit" type="number" min={1} max={12} defaultValue={config.limit} dir="ltr" className={fieldClassName()} />
        </label></ModuleEditorField>

        <ModuleEditorField nature="technical" span={3}><label className="block space-y-2">
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
        </label></ModuleEditorField>

        <ModuleEditorField nature="short-description" span={5}><label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">نص الحالة الفارغة (اختياري)</span>
          <textarea
            name="empty_state"
            defaultValue={config.emptyState ?? ""}
            rows={3}
            placeholder="اتركه فارغًا لعدم عرض رسالة"
            className={fieldClassName("resize-y leading-7")}
          />
        </label></ModuleEditorField>
        </ModuleEditorFieldGrid>
      </ModuleEditorSection>

      <ModuleEditorSection>
        <ModuleEditorSectionHeading intent="domain">مراجع المشروعات وترتيبها</ModuleEditorSectionHeading>
        <p className="text-xs leading-6 text-white/45">
          تُحفظ أرقام المشروعات والترتيب/الإخفاء فقط. الاسم والصور والوصف تظل مقروءة مباشرة من بيانات المشروع.
        </p>
        <ModuleEditorFieldGrid>
          <ModuleEditorField nature="long-content" span={6}><label className="block space-y-2">
            <span className="text-xs font-semibold text-white/55">ترتيب IDs (مفصولة بفاصلة)</span>
            <textarea name="project_order" rows={3} defaultValue={orderedReferences} dir="ltr" className={fieldClassName("resize-y")} />
          </label></ModuleEditorField>
          <ModuleEditorField nature="long-content" span={6}><label className="block space-y-2">
            <span className="text-xs font-semibold text-white/55">IDs المخفية</span>
            <textarea name="hidden_project_ids" rows={3} defaultValue={hiddenReferences} dir="ltr" className={fieldClassName("resize-y")} />
          </label></ModuleEditorField>
        </ModuleEditorFieldGrid>
      </ModuleEditorSection>

      <ModuleEditorSection>
        <ModuleEditorSectionHeading intent="settings">ظهور محتوى الهيرو وترتيبه</ModuleEditorSectionHeading>
        <AdminFormGrid columns={3}>
          {[
            ["show_eyebrow", "إظهار الموقع", config.showEyebrow],
            ["show_title", "إظهار الاسم الإنجليزي", config.showTitle],
            ["show_subtitle", "إظهار الاسم العربي", config.showSubtitle],
            ["show_description", "إظهار الوصف", config.showDescription],
            ["show_cta", "إظهار زر المشروع", config.showCta],
          ].map(([name, label, checked]) => (
            <AdminFormSwitch key={String(name)} name={String(name)} label={String(label)} value="true" defaultChecked={Boolean(checked)} surface />
          ))}
        </AdminFormGrid>
        <input type="hidden" name="show_highlight" value="false" />
        <input type="hidden" name="eyebrow_bold" value={String(config.eyebrowBold)} />
        <input type="hidden" name="title_bold" value={String(config.titleBold)} />
        <input type="hidden" name="highlight_bold" value={String(config.highlightBold)} />
        <input type="hidden" name="subtitle_bold" value={String(config.subtitleBold)} />
        <input type="hidden" name="eyebrow_alignment" value={config.eyebrowAlignment} />
        <input type="hidden" name="title_alignment" value={config.titleAlignment} />
        <input type="hidden" name="highlight_alignment" value={config.highlightAlignment} />
        <input type="hidden" name="subtitle_alignment" value={config.subtitleAlignment} />
        <input type="hidden" name="description_alignment" value={config.descriptionAlignment} />
        <input type="hidden" name="cta_alignment" value={config.ctaAlignment} />
        <label className="mt-5 block space-y-2">
          <span className="text-xs font-semibold text-white/55">ترتيب العناصر</span>
          <input
            name="hero_element_order"
            defaultValue={config.heroElementOrder.join(",")}
            dir="ltr"
            className={fieldClassName()}
          />
          <span className="block text-xs leading-5 text-white/40">eyebrow, title, subtitle, description, cta</span>
        </label>
      </ModuleEditorSection>
    </div>
  );
}
