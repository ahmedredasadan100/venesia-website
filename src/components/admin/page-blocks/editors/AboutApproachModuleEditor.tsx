"use client";

import {
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorSection,
  ModuleEditorSectionHeading,
} from "../ModuleEditorPresentation";

import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import type { AboutApproachModuleConfig } from "../../../../lib/page-blocks/configs";

type AboutApproachModuleEditorProps = {
  config: AboutApproachModuleConfig;
};

export default function AboutApproachModuleEditor({ config }: AboutApproachModuleEditorProps) {
  return (
    <div className="space-y-6">
      <ModuleEditorSection>
        <ModuleEditorSectionHeading intent="domain">منهج العمل</ModuleEditorSectionHeading>
        <ModuleEditorFieldGrid>
        <ModuleEditorField nature="short-text" span={3}><label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">النص التمهيدي</span>
          <input name="eyebrow" defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
        </label></ModuleEditorField>
        <ModuleEditorField nature="short-description" span={9}><label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">العنوان — النص الكامل</span>
          <textarea
            name="title"
            defaultValue={config.title ?? ""}
            rows={4}
            className={fieldClassName("resize-y leading-7")}
          />
        </label></ModuleEditorField>
        </ModuleEditorFieldGrid>
        <p className="text-xs leading-6 text-white/45">
          لفصل جزئي العنوان بصريًا، ضع <code dir="ltr"> — </code> بين الجزئين (مسافة قبل وبعد الشرطة).
        </p>
      </ModuleEditorSection>
    </div>
  );
}
