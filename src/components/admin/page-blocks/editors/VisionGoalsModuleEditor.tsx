"use client";

import { useState } from "react";
import { contentModuleMediaSlot } from "../../../../lib/page-blocks/configs";

import {
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorRepeaterCard,
  ModuleEditorRepeaterGrid,
  ModuleEditorVisibilityAlignRow,
} from "../ModuleEditorPresentation";

import AdminRichTextEditor from "../../AdminRichTextEditor";
import { plainTextToMarkdown } from "../../../../lib/rich-text/html-utils";
import AdminMediaImageField from "../../media/AdminMediaImageField";
import { AdminCard, AdminFormControlHeader, AdminTextFormatControls, type AdminTextAlignment } from "../../ui";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import {
  resolvePageBlockTextFormat,
  type VisionGoalsItemConfig,
  type VisionGoalsModuleConfig,
} from "../../../../lib/page-blocks/configs";
import { MODULE_EDITOR_TERMINOLOGY } from "../../../../lib/page-blocks/module-editor-presentation-contract";

type VisionGoalsModuleEditorProps = {
  config: VisionGoalsModuleConfig;
  section?: "all" | "text" | "images" | "vision" | "goals";
};

function padItems(items: VisionGoalsItemConfig[] | undefined, size = 3) {
  const rows = [...(items ?? [])].slice(0, size);
  while (rows.length < size) rows.push({});
  return rows;
}

export default function VisionGoalsModuleEditor({ config, section = "all" }: VisionGoalsModuleEditorProps) {
  const visionItems = padItems(config.vision?.items);
  const goalsItems = padItems(config.goals?.items);
  const eyebrowFormat = resolvePageBlockTextFormat(config, "eyebrow");
  const titleFormat = resolvePageBlockTextFormat(config, "title", { bold: true });
  const introFormat = resolvePageBlockTextFormat(config, "intro");
  const [introBold, setIntroBold] = useState(introFormat.bold);
  const [introAlignment, setIntroAlignment] = useState<AdminTextAlignment>(introFormat.alignment);
  const showText = section === "all" || section === "text";
  const showImages = section === "all" || section === "images";
  const showVision = section === "all" || section === "vision";
  const showGoals = section === "all" || section === "goals";

  return (
    <div className="space-y-6">
      {showText ? (
      <div>
        <input type="hidden" name="config_schema" value="vision-goals" />
        <ModuleEditorFieldGrid>
        <ModuleEditorField nature="short-text" span={6}>
        <ModuleEditorVisibilityAlignRow presentation="premium" label={MODULE_EDITOR_TERMINOLOGY.eyebrow.labelAr} showName="show_eyebrow" boldName="eyebrow_bold" alignmentName="eyebrow_alignment" showDefault={eyebrowFormat.visible} boldDefault={eyebrowFormat.bold} alignmentDefault={eyebrowFormat.alignment}>
          <input name="eyebrow" aria-label={MODULE_EDITOR_TERMINOLOGY.eyebrow.labelAr} defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
        </ModuleEditorVisibilityAlignRow>
        </ModuleEditorField>
        <ModuleEditorField nature="short-text" span={6}>
        <ModuleEditorVisibilityAlignRow presentation="premium" label="العنوان" showName="show_title" boldName="title_bold" alignmentName="title_alignment" showDefault={titleFormat.visible} boldDefault={titleFormat.bold} alignmentDefault={titleFormat.alignment}>
          <input name="title" aria-label="العنوان" defaultValue={config.title ?? ""} className={fieldClassName()} />
        </ModuleEditorVisibilityAlignRow>
        </ModuleEditorField>
        <ModuleEditorField nature="long-content" span={12}>
        <ModuleEditorVisibilityAlignRow presentation="premium" label={MODULE_EDITOR_TERMINOLOGY.longContent.labelAr} showName="show_intro" showDefault={introFormat.visible} controlMode="visibility-only">
          <input type="hidden" name="intro_content_format" value="markdown" />
          <AdminRichTextEditor
            name="intro"
            label={MODULE_EDITOR_TERMINOLOGY.longContent.labelAr}
            showLabel={false}
            minHeight={620}
            toolbarMode="full"
            storageFormat="markdown"
            enableArticleStructure
            enableTextAlign
            helperText="Enter لإنشاء فقرة جديدة، وShift + Enter للنزول إلى سطر جديد داخل الفقرة."
            defaultValue={config.introContentFormat === "markdown"
              ? (config.intro ?? []).join("\n\n")
              : plainTextToMarkdown((config.intro ?? []).join("\n\n"))}
          />
        </ModuleEditorVisibilityAlignRow>
        </ModuleEditorField>
        <ModuleEditorField nature="standard" span={12}>
          <AdminCard presentation="premium" className="space-y-3 p-3">
            <AdminFormControlHeader
              title="تنسيق المحتوى على الصفحة"
              description="تنسيق عام للمحتوى بالكامل. استخدم شريط المحرر لتنسيق الفقرات والنص المحدد."
            />
            <input type="hidden" name="intro_bold" value={String(introBold)} />
            <input type="hidden" name="intro_alignment" value={introAlignment} />
            <AdminTextFormatControls
              ariaLabel="تنسيق المحتوى على الصفحة"
              alignmentAriaLabel="محاذاة المحتوى على الصفحة"
              bold={introBold}
              onBoldChange={setIntroBold}
              alignment={introAlignment}
              onAlignmentChange={setIntroAlignment}
            />
          </AdminCard>
        </ModuleEditorField>
        </ModuleEditorFieldGrid>
      </div>
      ) : null}

      {showImages ? (
      <AdminCard presentation="premium" className="flex min-w-0 flex-col gap-3 p-3">
        <AdminFormControlHeader title="صورة القسم" />
        <AdminMediaImageField
          mediaSlot={contentModuleMediaSlot("vision-goals")}
          name="image"
          label="صورة القسم"
          variant="card"
          showLabel={false}
          defaultValue={config.image ?? ""}
          altName="image_alt"
          defaultAlt={config.imageAlt ?? ""}
          browseFolder="images/about"
        />
      </AdminCard>
      ) : null}

      {showVision ? (
      <div className="space-y-4">
        <AdminCard presentation="premium" className="p-3">
        <label className="block space-y-3">
          <AdminFormControlHeader title="عنوان عمود رؤيتنا" />
          <input name="vision_title" defaultValue={config.vision?.title ?? ""} className={fieldClassName()} />
        </label>
        </AdminCard>
        <ModuleEditorRepeaterGrid presentation="premium">
          {visionItems.map((item, index) => (
            <ModuleEditorRepeaterCard key={`vision-${index}`} title={`بند ${index + 1}`} presentation="premium">
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-white/55">العنوان</span>
                <input
                  name={`vision_item_${index}_title`}
                  defaultValue={item.title ?? ""}
                  className={fieldClassName()}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-white/55">الوصف المختصر</span>
                <textarea
                  name={`vision_item_${index}_text`}
                  defaultValue={item.text ?? ""}
                  rows={3}
                  className={fieldClassName("resize-y leading-7")}
                />
              </label>
            </ModuleEditorRepeaterCard>
          ))}
        </ModuleEditorRepeaterGrid>
      </div>
      ) : null}

      {showGoals ? (
      <div className="space-y-4">
        <AdminCard presentation="premium" className="p-3">
        <label className="block space-y-3">
          <AdminFormControlHeader title="عنوان عمود أهدافنا" />
          <input name="goals_title" defaultValue={config.goals?.title ?? ""} className={fieldClassName()} />
        </label>
        </AdminCard>
        <ModuleEditorRepeaterGrid presentation="premium">
          {goalsItems.map((item, index) => (
            <ModuleEditorRepeaterCard key={`goals-${index}`} title={`بند ${index + 1}`} presentation="premium">
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-white/55">العنوان</span>
                <input
                  name={`goals_item_${index}_title`}
                  defaultValue={item.title ?? ""}
                  className={fieldClassName()}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-white/55">الوصف المختصر</span>
                <textarea
                  name={`goals_item_${index}_text`}
                  defaultValue={item.text ?? ""}
                  rows={3}
                  className={fieldClassName("resize-y leading-7")}
                />
              </label>
            </ModuleEditorRepeaterCard>
          ))}
        </ModuleEditorRepeaterGrid>
      </div>
      ) : null}
    </div>
  );
}
