"use client";

import HeroVisibilityAlignRow from "../../../../app/admin/pages-blocks/blocks/hero/[id]/HeroVisibilityAlignRow";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import {
  PROJECTS_HUB_HERO_PROJECT_TYPES,
  type ProjectsHubHeroModuleConfig,
} from "../../../../lib/page-blocks/projects-hub-config";
import { AdminFormListboxSelect } from "../../ui";
import {
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorSection,
  ModuleEditorSectionHeading,
} from "../ModuleEditorPresentation";

export default function ProjectsHubHeroModuleEditor({
  config,
}: {
  config: ProjectsHubHeroModuleConfig;
}) {
  return (
    <div className="space-y-6">
      <ModuleEditorSection>
        <input type="hidden" name="selection_mode" value="domain_projects" />
        <ModuleEditorSectionHeading intent="domain">مصدر الشرائح</ModuleEditorSectionHeading>
        <p className="mb-5 text-xs leading-6 text-white/45">
          النصوص والصور والروابط وترتيب المشروعات تُقرأ من Projects Domain. يملك الهيرو التصفية والعرض فقط.
        </p>

        <ModuleEditorFieldGrid className="lg:grid-cols-3 xl:grid-cols-12">
          <ModuleEditorField nature="standard" span={4}>
            <AdminFormListboxSelect
              name="project_type"
              label="نوع المشروعات"
              defaultValue={config.projectType}
              options={PROJECTS_HUB_HERO_PROJECT_TYPES.map((type) => ({
                value: type,
                label: type === "residential" ? "سكنية" : type === "commercial" ? "تجارية" : "سكنية وتجارية",
              }))}
            />
          </ModuleEditorField>

          <ModuleEditorField nature="technical" span={4}>
            <label className="block space-y-2">
              <span className="text-xs font-semibold text-white/55">الحد الأقصى للشرائح</span>
              <input
                name="limit"
                type="number"
                min={1}
                max={12}
                defaultValue={config.limit}
                dir="ltr"
                className={fieldClassName()}
              />
            </label>
          </ModuleEditorField>

          <ModuleEditorField nature="technical" span={4}>
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
          </ModuleEditorField>
        </ModuleEditorFieldGrid>

        <ModuleEditorFieldGrid className="mt-5">
          <ModuleEditorField nature="short-description" span={12}>
            <label className="block space-y-2">
              <span className="text-xs font-semibold text-white/55">رسالة عدم وجود مشروعات</span>
              <textarea
                name="empty_state"
                defaultValue={config.emptyState ?? ""}
                rows={3}
                placeholder="اتركه فارغًا لعدم عرض رسالة"
                className={fieldClassName("resize-y leading-7")}
              />
            </label>
          </ModuleEditorField>
        </ModuleEditorFieldGrid>
      </ModuleEditorSection>

      <ModuleEditorSection>
        <ModuleEditorSectionHeading intent="settings">ظهور محتوى الهيرو</ModuleEditorSectionHeading>
        <ModuleEditorFieldGrid className="lg:grid-cols-2 xl:grid-cols-12">
          <ModuleEditorField nature="binary-state" span={6}>
            <HeroVisibilityAlignRow
              label="موقع المشروع"
              alignmentName="eyebrow_alignment"
              showName="show_eyebrow"
              boldName="eyebrow_bold"
              alignmentDefault={config.eyebrowAlignment}
              showDefault={config.showEyebrow}
              boldDefault={config.eyebrowBold}
            />
          </ModuleEditorField>
          <ModuleEditorField nature="binary-state" span={6}>
            <HeroVisibilityAlignRow
              label="الاسم الإنجليزي"
              alignmentName="title_alignment"
              showName="show_title"
              boldName="title_bold"
              alignmentDefault={config.titleAlignment}
              showDefault={config.showTitle}
              boldDefault={config.titleBold}
            />
          </ModuleEditorField>
          <ModuleEditorField nature="binary-state" span={6}>
            <HeroVisibilityAlignRow
              label="الاسم العربي"
              alignmentName="subtitle_alignment"
              showName="show_subtitle"
              boldName="subtitle_bold"
              alignmentDefault={config.subtitleAlignment}
              showDefault={config.showSubtitle}
              boldDefault={config.subtitleBold}
            />
          </ModuleEditorField>
          <ModuleEditorField nature="binary-state" span={6}>
            <HeroVisibilityAlignRow
              label="وصف المشروع"
              alignmentName="description_alignment"
              showName="show_description"
              alignmentDefault={
                config.descriptionAlignment === "justify" ? "right" : config.descriptionAlignment
              }
              showDefault={config.showDescription}
            />
          </ModuleEditorField>
        </ModuleEditorFieldGrid>

        <input type="hidden" name="show_highlight" value="false" />
        <input type="hidden" name="highlight_bold" value="false" />
        <input type="hidden" name="highlight_alignment" value="right" />
      </ModuleEditorSection>
    </div>
  );
}
