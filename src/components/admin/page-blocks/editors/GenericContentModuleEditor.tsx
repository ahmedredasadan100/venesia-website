"use client";

import {
  ModuleEditorContentGroup,
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorSection,
} from "../ModuleEditorPresentation";
import { AdminFormListboxSelect } from "../../ui";

import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import type { ContentBlockConfig } from "../../../../lib/page-blocks/configs";
import { MODULE_EDITOR_TERMINOLOGY } from "../../../../lib/page-blocks/module-editor-presentation-contract";

type GenericContentModuleEditorProps = {
  config: ContentBlockConfig;
};

export default function GenericContentModuleEditor({ config }: GenericContentModuleEditorProps) {
  return (
    <ModuleEditorSection>
      <ModuleEditorContentGroup kind="short">
      <ModuleEditorFieldGrid>
        <ModuleEditorField nature="short-text" span={3}>
          <label className="block space-y-2">
            <span className="text-xs font-semibold text-white/55">{MODULE_EDITOR_TERMINOLOGY.eyebrow.labelAr}</span>
            <input name="eyebrow" defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
          </label>
        </ModuleEditorField>
        <ModuleEditorField nature="short-text" span={4}>
          <label className="block space-y-2">
            <span className="text-xs font-semibold text-white/55">العنوان</span>
            <input name="title" defaultValue={config.title ?? ""} className={fieldClassName()} />
          </label>
        </ModuleEditorField>
        <ModuleEditorField nature="short-description" span={5}>
          <label className="block space-y-2">
            <span className="text-xs font-semibold text-white/55">العنوان الفرعي</span>
            <input name="subtitle" defaultValue={config.subtitle ?? ""} className={fieldClassName()} />
          </label>
        </ModuleEditorField>
      </ModuleEditorFieldGrid>
      </ModuleEditorContentGroup>
      <ModuleEditorContentGroup kind="long">
        <ModuleEditorFieldGrid>
        <ModuleEditorField nature="long-content">
          <label className="block space-y-2">
            <span className="text-xs font-semibold text-white/55">النص</span>
            <textarea name="body" defaultValue={config.body ?? ""} rows={8} className={fieldClassName("resize-y leading-7")} />
            <span className="block text-xs leading-6 text-white/45">استخدم سطرًا فارغًا للفصل بين الفقرات.</span>
          </label>
        </ModuleEditorField>
        </ModuleEditorFieldGrid>
      </ModuleEditorContentGroup>
      <ModuleEditorFieldGrid>
        <ModuleEditorField nature="standard" span={4}>
          <AdminFormListboxSelect
            name="alignment"
            label="المحاذاة"
            defaultValue={config.alignment ?? "start"}
            options={[
              { value: "start", label: "بداية" },
              { value: "center", label: "وسط" },
            ]}
          />
        </ModuleEditorField>
      </ModuleEditorFieldGrid>
    </ModuleEditorSection>
  );
}
