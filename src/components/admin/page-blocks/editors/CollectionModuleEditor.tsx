"use client";

import { useState } from "react";

import {
  ModuleEditorSection,
  ModuleEditorSectionHeading,
  ModuleEditorVisibilityAlignRow,
  MODULE_EDITOR_CONTROL_CARD_CLASS_NAME,
} from "../ModuleEditorPresentation";
import { AdminFormGrid, AdminFormListboxSelect } from "../../ui";
import ContentDisplaySettings from "../../content/editors/ContentDisplaySettings";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import type { CollectionDisplayOverrides } from "../../../../lib/page-blocks/configs";

type CollectionEditorOption<Value extends string> = {
  value: Value;
  label: string;
  /** Shared Admin category-tree indentation contract. */
  depth?: number;
};

type CollectionEditorNumberOption<Value extends number> = {
  value: Value;
  label: string;
};

type CollectionSelectionField<Value extends string> = {
  name: string;
  label: string;
  value: Value;
  options: readonly CollectionEditorOption<Value>[];
};

export type CollectionModuleEditorProps<
  Collection extends string,
  Presentation extends string,
  ItemsPerRow extends number,
  ItemLimit extends number,
> = {
  selection: CollectionSelectionField<Collection>;
  presentation: {
    value: Presentation;
    options: readonly CollectionEditorOption<Presentation>[];
  };
  display: {
    itemsPerRow: {
      value: ItemsPerRow;
      options: readonly CollectionEditorNumberOption<ItemsPerRow>[];
      supportedPresentations: readonly Presentation[];
    };
    itemLimit: {
      value: ItemLimit;
      options: readonly CollectionEditorNumberOption<ItemLimit>[];
    };
    overrides: CollectionDisplayOverrides;
  };
};

/**
 * Shared Admin presentation for domain-owned selection, Presentation, and Display.
 * The adopting domain supplies only the first control's name, label, and options.
 */
export default function CollectionModuleEditor<
  Collection extends string,
  Presentation extends string,
  ItemsPerRow extends number,
  ItemLimit extends number,
>({
  selection,
  presentation,
  display,
}: CollectionModuleEditorProps<
  Collection,
  Presentation,
  ItemsPerRow,
  ItemLimit
>) {
  const [activePresentation, setActivePresentation] =
    useState<Presentation>(presentation.value);
  const [itemsPerRow, setItemsPerRow] =
    useState<ItemsPerRow>(display.itemsPerRow.value);
  const supportsItemsPerRow =
    display.itemsPerRow.supportedPresentations.includes(activePresentation);

  return (
    <div className="space-y-6" data-collection-module-editor="">
      <ModuleEditorSection>
        <ModuleEditorSectionHeading intent="settings">
          إعدادات القائمة
        </ModuleEditorSectionHeading>

        <AdminFormGrid columns={4} className="mt-4">
          <div className={`${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} h-full`}>
            <AdminFormListboxSelect
              name={selection.name}
              label={selection.label}
              defaultValue={selection.value}
              options={selection.options}
              required
              sizing="full"
            />
          </div>

          <div className={`${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} h-full`}>
            <AdminFormListboxSelect
              name="presentation"
              label="طريقة العرض"
              value={activePresentation}
              onChange={(value) =>
                setActivePresentation(value as Presentation)
              }
              options={presentation.options}
              required
              sizing="full"
            />
          </div>

          {supportsItemsPerRow ? (
            <div className={`${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} h-full`}>
              <AdminFormListboxSelect
                name="items_per_row"
                label="عدد العناصر في الصف"
                value={String(itemsPerRow)}
                onChange={(value) =>
                  setItemsPerRow(Number(value) as ItemsPerRow)
                }
                options={display.itemsPerRow.options.map((option) => ({
                  value: String(option.value),
                  label: option.label,
                }))}
                required
                sizing="full"
              />
            </div>
          ) : (
            <input type="hidden" name="items_per_row" value={itemsPerRow} />
          )}

          <div className={`${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} h-full`}>
            <AdminFormListboxSelect
              name="item_limit"
              label="عدد العناصر التي يتم عرضها"
              defaultValue={String(display.itemLimit.value)}
              options={display.itemLimit.options.map((option) => ({
                value: String(option.value),
                label: option.label,
              }))}
              required
              sizing="full"
            />
          </div>
        </AdminFormGrid>
      </ModuleEditorSection>

      <ModuleEditorSection>
        <ModuleEditorSectionHeading intent="settings">
          إعدادات العرض
        </ModuleEditorSectionHeading>

        <div className="mt-4">
          <ContentDisplaySettings
            showTitle={display.overrides.title}
            showImage={display.overrides.image}
            showExcerpt={display.overrides.excerpt}
            showDate={display.overrides.date}
            showCategory={display.overrides.category}
            showSeries={display.overrides.series}
            includeIntroCard={false}
          >
            <ModuleEditorVisibilityAlignRow
              label="زر التفاصيل"
              showName="show_details"
              boldName="details_bold"
              alignmentName="details_alignment"
              showDefault={display.overrides.details.visible}
              boldDefault={display.overrides.details.bold}
              alignmentDefault={display.overrides.details.alignment}
              className="h-full sm:col-span-2 lg:col-start-3 lg:row-start-1 lg:row-span-2"
            >
              <input
                name="details_text"
                aria-label="نص زر التفاصيل"
                defaultValue={display.overrides.details.text}
                placeholder="اقرأ المزيد"
                required
                className={fieldClassName("h-10")}
              />
            </ModuleEditorVisibilityAlignRow>
          </ContentDisplaySettings>
        </div>
      </ModuleEditorSection>
    </div>
  );
}
