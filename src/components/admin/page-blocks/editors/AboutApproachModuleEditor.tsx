"use client";

import {
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorSection,
  ModuleEditorSectionHeading,
  ModuleEditorVisibilityAlignRow,
} from "../ModuleEditorPresentation";

import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import {
  resolvePageBlockTextFormat,
  type AboutApproachModuleConfig,
} from "../../../../lib/page-blocks/configs";

type AboutApproachModuleEditorProps = {
  config: AboutApproachModuleConfig;
};

export default function AboutApproachModuleEditor({ config }: AboutApproachModuleEditorProps) {
  const eyebrowFormat = resolvePageBlockTextFormat(config, "eyebrow");
  const titleFormat = resolvePageBlockTextFormat(config, "title", { bold: true });
  return (
    <div className="space-y-6">
      <ModuleEditorSection>
        <ModuleEditorSectionHeading intent="domain">منهج العمل</ModuleEditorSectionHeading>
        <ModuleEditorFieldGrid>
          <ModuleEditorField nature="short-text" span={6}>
            <ModuleEditorVisibilityAlignRow label="النص التمهيدي" showName="show_eyebrow" boldName="eyebrow_bold" alignmentName="eyebrow_alignment" showDefault={eyebrowFormat.visible} boldDefault={eyebrowFormat.bold} alignmentDefault={eyebrowFormat.alignment}>
              <input name="eyebrow" aria-label="النص التمهيدي" defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
            </ModuleEditorVisibilityAlignRow>
          </ModuleEditorField>
          <ModuleEditorField nature="short-description" span={6}>
            <ModuleEditorVisibilityAlignRow label="العنوان — النص الكامل" showName="show_title" boldName="title_bold" alignmentName="title_alignment" showDefault={titleFormat.visible} boldDefault={titleFormat.bold} alignmentDefault={titleFormat.alignment}>
              <textarea
                name="title"
                aria-label="العنوان — النص الكامل"
                defaultValue={config.title ?? ""}
                rows={2}
                className={fieldClassName("h-[72px] resize-none overflow-hidden leading-6")}
              />
            </ModuleEditorVisibilityAlignRow>
          </ModuleEditorField>
        </ModuleEditorFieldGrid>
        <p className="text-xs leading-6 text-white/45">
          لفصل جزئي العنوان بصريًا، ضع <code dir="ltr"> — </code> بين الجزئين (مسافة قبل وبعد الشرطة).
        </p>
      </ModuleEditorSection>
    </div>
  );
}
