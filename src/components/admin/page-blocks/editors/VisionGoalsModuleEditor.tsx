"use client";

import {
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorRepeaterCard,
  ModuleEditorRepeaterGrid,
  ModuleEditorSection,
  ModuleEditorSectionHeading,
} from "../ModuleEditorPresentation";

import AdminMediaImageField from "../../media/AdminMediaImageField";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import type { VisionGoalsItemConfig, VisionGoalsModuleConfig } from "../../../../lib/page-blocks/configs";
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

  return (
    <div className="space-y-6">
      <input type="hidden" name="config_schema" value="vision-goals" />

      <ModuleEditorSection>
        <ModuleEditorFieldGrid>
        <ModuleEditorField nature="short-text" span={3}><label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">{MODULE_EDITOR_TERMINOLOGY.eyebrow.labelAr}</span>
          <input name="eyebrow" defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
        </label></ModuleEditorField>
        <ModuleEditorField nature="short-text" span={9}><label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">العنوان</span>
          <input name="title" defaultValue={config.title ?? ""} className={fieldClassName()} />
        </label></ModuleEditorField>
        <ModuleEditorField nature="long-content" span={12}><label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">{MODULE_EDITOR_TERMINOLOGY.longContent.labelAr} — فقرتان مفصولتان بسطر فارغ</span>
          <textarea
            name="intro"
            defaultValue={(config.intro ?? []).join("\n\n")}
            rows={6}
            className={fieldClassName("resize-y leading-7")}
          />
        </label></ModuleEditorField>
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
