"use client";

import {
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorSection,
  ModuleEditorVisibilityAlignRow,
} from "../ModuleEditorPresentation";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import {
  resolvePageBlockTextFormat,
  type ContentBlockConfig,
  type PageBlockFormattableTextField,
} from "../../../../lib/page-blocks/configs";
import { MODULE_EDITOR_TERMINOLOGY } from "../../../../lib/page-blocks/module-editor-presentation-contract";

type GenericContentModuleEditorProps = {
  config: ContentBlockConfig;
  introPresentation?: boolean;
};

function formatDefaults(
  config: ContentBlockConfig,
  field: PageBlockFormattableTextField,
  bold = false,
) {
  return resolvePageBlockTextFormat(config, field, {
    bold,
    alignment: config.alignment === "center" ? "center" : "right",
  });
}

export default function GenericContentModuleEditor({
  config,
  introPresentation = false,
}: GenericContentModuleEditorProps) {
  const fields = [
    { field: "eyebrow" as const, label: MODULE_EDITOR_TERMINOLOGY.eyebrow.labelAr, name: "eyebrow", value: config.eyebrow ?? "" },
    { field: "title" as const, label: "العنوان الرئيسي", name: "title", value: config.title ?? "", bold: true },
    { field: "subtitle" as const, label: "العنوان الفرعي", name: "subtitle", value: config.subtitle ?? "" },
  ];
  const descriptionFormat = formatDefaults(config, "description");

  return (
    <ModuleEditorSection>
      <ModuleEditorFieldGrid>
        {fields.map((item) => {
          const format = formatDefaults(config, item.field, item.bold);
          return (
            <ModuleEditorField key={item.field} nature="short-text" span={6}>
            <ModuleEditorVisibilityAlignRow
              label={item.label}
              showName={`show_${item.field}`}
              boldName={`${item.field}_bold`}
              alignmentName={`${item.field}_alignment`}
              showDefault={format.visible}
              boldDefault={format.bold}
              alignmentDefault={format.alignment}
              className="h-full"
            >
              <input
                name={item.name}
                defaultValue={item.value}
                aria-label={item.label}
                className={fieldClassName("h-11")}
              />
            </ModuleEditorVisibilityAlignRow>
            </ModuleEditorField>
          );
        })}
        <ModuleEditorField nature="short-description" span={6}>
        <ModuleEditorVisibilityAlignRow
          label="الوصف"
          showName="show_description"
          boldName="description_bold"
          alignmentName="description_alignment"
          showDefault={descriptionFormat.visible}
          boldDefault={descriptionFormat.bold}
          alignmentDefault={descriptionFormat.alignment}
          className="h-full"
        >
          {introPresentation ? (
            <input
              name="body"
              defaultValue={config.body ?? ""}
              aria-label="الوصف"
              className={fieldClassName("h-11")}
            />
          ) : (
            <textarea
              name="body"
              defaultValue={config.body ?? ""}
              aria-label="الوصف"
              rows={2}
              className={fieldClassName("h-[72px] resize-none overflow-hidden leading-6")}
            />
          )}
        </ModuleEditorVisibilityAlignRow>
        </ModuleEditorField>
      </ModuleEditorFieldGrid>
    </ModuleEditorSection>
  );
}
