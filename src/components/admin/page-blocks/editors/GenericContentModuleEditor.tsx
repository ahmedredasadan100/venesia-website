"use client";

import { ModuleEditorSection } from "../ModuleEditorPresentation";
import { AdminFormListboxSelect } from "../../ui";

import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import type { ContentBlockConfig } from "../../../../lib/page-blocks/configs";

type GenericContentModuleEditorProps = {
  config: ContentBlockConfig;
};

export default function GenericContentModuleEditor({ config }: GenericContentModuleEditorProps) {
  return (
      <ModuleEditorSection>
      <label className="block space-y-2">
        <span className="text-xs font-semibold text-white/55">Eyebrow</span>
        <input name="eyebrow" defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
      </label>
      <label className="block space-y-2">
        <span className="text-xs font-semibold text-white/55">العنوان</span>
        <input name="title" defaultValue={config.title ?? ""} className={fieldClassName()} />
      </label>
      <label className="block space-y-2">
        <span className="text-xs font-semibold text-white/55">Subtitle</span>
        <input name="subtitle" defaultValue={config.subtitle ?? ""} className={fieldClassName()} />
      </label>
      <label className="block space-y-2">
        <span className="text-xs font-semibold text-white/55">المحتوى — فقرات مفصولة بسطر فارغ</span>
        <textarea name="body" defaultValue={config.body ?? ""} rows={8} className={fieldClassName("resize-y leading-7")} />
      </label>
      <AdminFormListboxSelect
        name="alignment"
        label="المحاذاة"
        defaultValue={config.alignment ?? "start"}
        options={[
          { value: "start", label: "بداية" },
          { value: "center", label: "وسط" },
        ]}
      />
      </ModuleEditorSection>
  );
}
