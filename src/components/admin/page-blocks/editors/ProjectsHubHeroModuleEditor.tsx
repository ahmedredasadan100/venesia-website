"use client";

import { adminFormFieldClassName, adminFormTextareaClassName } from "../../../../lib/admin/admin-ui-styles";
import HeroVisibilityAlignRow from "../../../../app/admin/pages-blocks/blocks/hero/[id]/HeroVisibilityAlignRow";
import {
  PROJECTS_HUB_HERO_PROJECT_TYPES,
  type ProjectsHubHeroModuleConfig,
} from "../../../../lib/page-blocks/projects-hub-config";
import { ADMIN_FORM_STACK_CLASS_NAME, AdminFormField, AdminFormGrid, AdminFormListboxSelect } from "../../ui";
import {
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorSection,
} from "../ModuleEditorPresentation";

export default function ProjectsHubHeroModuleEditor({
  config,
}: {
  config: ProjectsHubHeroModuleConfig;
}) {
  return (
    <div className={ADMIN_FORM_STACK_CLASS_NAME}>
      <ModuleEditorSection presentation="panel" title="مصدر الشرائح">
        <input type="hidden" name="selection_mode" value="domain_projects" />


        <ModuleEditorFieldGrid>
          <ModuleEditorField nature="standard" span={4}>
            <AdminFormListboxSelect
              presentation="panel"
              name="project_type"
              label="نوع المشروعات"
              defaultValue={config.projectType}
              sizing="full"
              options={PROJECTS_HUB_HERO_PROJECT_TYPES.map((type) => ({
                value: type,
                label:
                  type === "residential"
                    ? "سكنية"
                    : type === "commercial"
                      ? "تجارية"
                      : "سكنية وتجارية",
              }))}
            />
          </ModuleEditorField>

          <ModuleEditorField
            nature="technical"
            span={4}
          >
            <AdminFormField label="الحد الأقصى للشرائح">
              <input
                name="limit"
                type="number"
                min={1}
                max={12}
                defaultValue={config.limit}
                dir="ltr"
                className={adminFormFieldClassName()}
              />
            </AdminFormField>
          </ModuleEditorField>

          <ModuleEditorField
            nature="technical"
            span={4}
          >
            <AdminFormField label="التشغيل التلقائي (مللي ثانية)">
              <input
                name="autoplay_ms"
                type="number"
                min={1000}
                max={60000}
                step={500}
                defaultValue={config.autoplayMs}
                dir="ltr"
                className={adminFormFieldClassName()}
              />
            </AdminFormField>
          </ModuleEditorField>
          <ModuleEditorField nature="short-description" span={12}>
            <AdminFormField label="رسالة عدم وجود مشروعات">
              <textarea
                name="empty_state"
                defaultValue={config.emptyState ?? ""}
                rows={3}
                placeholder="اتركه فارغًا لعدم عرض رسالة"
                className={adminFormTextareaClassName("resize-y leading-7")}
              />
            </AdminFormField>
          </ModuleEditorField>
        </ModuleEditorFieldGrid>
      </ModuleEditorSection>

      <ModuleEditorSection presentation="panel" title="ظهور محتوى الهيرو">

        <AdminFormGrid columns={2}>
          <HeroVisibilityAlignRow
            label="موقع المشروع"
            alignmentName="eyebrow_alignment"
            showName="show_eyebrow"
            boldName="eyebrow_bold"
            alignmentDefault={config.eyebrowAlignment}
            showDefault={config.showEyebrow}
            boldDefault={config.eyebrowBold}
          />
          <HeroVisibilityAlignRow
            label="الاسم الإنجليزي"
            alignmentName="title_alignment"
            showName="show_title"
            boldName="title_bold"
            alignmentDefault={config.titleAlignment}
            showDefault={config.showTitle}
            boldDefault={config.titleBold}
          />
          <HeroVisibilityAlignRow
            label="الاسم العربي"
            alignmentName="subtitle_alignment"
            showName="show_subtitle"
            boldName="subtitle_bold"
            alignmentDefault={config.subtitleAlignment}
            showDefault={config.showSubtitle}
            boldDefault={config.subtitleBold}
          />
          <HeroVisibilityAlignRow
            label="وصف المشروع"
            alignmentName="description_alignment"
            showName="show_description"
            alignmentDefault={config.descriptionAlignment}
            showDefault={config.showDescription}
          />
        </AdminFormGrid>

        <input type="hidden" name="show_highlight" value="false" />
        <input type="hidden" name="highlight_bold" value="false" />
        <input type="hidden" name="highlight_alignment" value="right" />
      </ModuleEditorSection>
    </div>
  );
}
