"use client";

import {
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorRepeaterCard,
  ModuleEditorRepeaterGrid,
  ModuleEditorSection,
  ModuleEditorSectionHeading,
  ModuleEditorVisibilityAlignRow,
} from "../ModuleEditorPresentation";

import AdminMediaImageField from "../../media/AdminMediaImageField";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import {
  resolvePageBlockTextFormat,
  type VisionGoalsItemConfig,
  type VisionGoalsModuleConfig,
} from "../../../../lib/page-blocks/configs";
import { MODULE_EDITOR_TERMINOLOGY } from "../../../../lib/page-blocks/module-editor-presentation-contract";

type VisionGoalsModuleEditorProps = {
  config: VisionGoalsModuleConfig;
};

function padItems(items: VisionGoalsItemConfig[] | undefined, size = 3) {
  const rows = [...(items ?? [])].slice(0, size);
  while (rows.length < size) rows.push({});
  return rows;
}

export default function VisionGoalsModuleEditor({ config }: VisionGoalsModuleEditorProps) {
  const visionItems = padItems(config.vision?.items);
  const goalsItems = padItems(config.goals?.items);
  const eyebrowFormat = resolvePageBlockTextFormat(config, "eyebrow");
  const titleFormat = resolvePageBlockTextFormat(config, "title", { bold: true });
  const introFormat = resolvePageBlockTextFormat(config, "intro");

  return (
    <div className="space-y-6">
      <input type="hidden" name="config_schema" value="vision-goals" />

      <ModuleEditorSection>
        <ModuleEditorFieldGrid>
        <ModuleEditorField nature="short-text" span={6}>
        <ModuleEditorVisibilityAlignRow label={MODULE_EDITOR_TERMINOLOGY.eyebrow.labelAr} showName="show_eyebrow" boldName="eyebrow_bold" alignmentName="eyebrow_alignment" showDefault={eyebrowFormat.visible} boldDefault={eyebrowFormat.bold} alignmentDefault={eyebrowFormat.alignment}>
          <input name="eyebrow" aria-label={MODULE_EDITOR_TERMINOLOGY.eyebrow.labelAr} defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
        </ModuleEditorVisibilityAlignRow>
        </ModuleEditorField>
        <ModuleEditorField nature="short-text" span={6}>
        <ModuleEditorVisibilityAlignRow label="العنوان" showName="show_title" boldName="title_bold" alignmentName="title_alignment" showDefault={titleFormat.visible} boldDefault={titleFormat.bold} alignmentDefault={titleFormat.alignment}>
          <input name="title" aria-label="العنوان" defaultValue={config.title ?? ""} className={fieldClassName()} />
        </ModuleEditorVisibilityAlignRow>
        </ModuleEditorField>
        <ModuleEditorField nature="long-content" span={12}>
        <ModuleEditorVisibilityAlignRow label={MODULE_EDITOR_TERMINOLOGY.longContent.labelAr} showName="show_intro" boldName="intro_bold" alignmentName="intro_alignment" showDefault={introFormat.visible} boldDefault={introFormat.bold} alignmentDefault={introFormat.alignment}>
          <textarea
            name="intro"
            aria-label={MODULE_EDITOR_TERMINOLOGY.longContent.labelAr}
            defaultValue={(config.intro ?? []).join("\n\n")}
            rows={2}
            className={fieldClassName("h-[72px] resize-none overflow-hidden leading-6")}
          />
        </ModuleEditorVisibilityAlignRow>
        </ModuleEditorField>
        </ModuleEditorFieldGrid>
      </ModuleEditorSection>

      <ModuleEditorSection>
        <AdminMediaImageField
          name="image"
          label="صورة القسم"
          defaultValue={config.image ?? ""}
          altName="image_alt"
          defaultAlt={config.imageAlt ?? ""}
          dimensionHint="content"
          browseFolder="images/about"
        />
      </ModuleEditorSection>

      <ModuleEditorSection>
        <ModuleEditorSectionHeading intent="domain">رؤيتنا</ModuleEditorSectionHeading>
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">عنوان العمود</span>
          <input name="vision_title" defaultValue={config.vision?.title ?? ""} className={fieldClassName()} />
        </label>
        <ModuleEditorRepeaterGrid>
          {visionItems.map((item, index) => (
            <ModuleEditorRepeaterCard key={`vision-${index}`} title={`بند ${index + 1}`}>
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
      </ModuleEditorSection>

      <ModuleEditorSection>
        <ModuleEditorSectionHeading intent="domain">أهدافنا</ModuleEditorSectionHeading>
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">عنوان العمود</span>
          <input name="goals_title" defaultValue={config.goals?.title ?? ""} className={fieldClassName()} />
        </label>
        <ModuleEditorRepeaterGrid>
          {goalsItems.map((item, index) => (
            <ModuleEditorRepeaterCard key={`goals-${index}`} title={`بند ${index + 1}`}>
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
      </ModuleEditorSection>
    </div>
  );
}
