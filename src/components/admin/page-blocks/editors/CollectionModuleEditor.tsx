"use client";

import { useState } from "react";

import {
  ModuleEditorSection,
  ModuleEditorVisibilityAlignRow,
} from "../ModuleEditorPresentation";
import { ADMIN_FORM_STACK_CLASS_NAME, AdminCard, AdminFormGrid, AdminFormListboxSelect } from "../../ui";
import { AdminModuleSectionHeader, AdminModuleTabIcon } from "../../ui/AdminModuleTabs";
import { ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME } from "../../../../lib/admin/admin-ui-styles";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import {
  resolveCollectionDisplayTextFormatting,
  type CollectionDisplayOverrides,
} from "../../../../lib/page-blocks/configs";

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
  /** Configuration-only composition delegates its header to the parent tab and display fields to a sibling panel. */
  section?: "all" | "configuration";
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

export function CollectionModuleDisplayFormattingFields({
  display,
  heading = "إعدادات العرض",
}: {
  display: CollectionDisplayOverrides;
  heading?: string;
}) {
  const textFormatting = resolveCollectionDisplayTextFormatting(display);

  const cards = (
    <>
      <ModuleEditorVisibilityAlignRow
        label="العنوان"
        icon={<AdminModuleTabIcon name="content" />}
        showName="show_title_on_page"
        boldName="title_bold"
        alignmentName="title_alignment"
        showDefault={display.title}
        boldDefault={textFormatting.titleBold}
        alignmentDefault={textFormatting.titleAlignment}
      />
      <ModuleEditorVisibilityAlignRow
        label="الصورة"
        icon={<AdminModuleTabIcon name="media" />}
        showName="show_image_on_page"
        showDefault={display.image}
        controlMode="visibility-only"
      />
      <ModuleEditorVisibilityAlignRow
        label="التصنيف"
        icon={<AdminModuleTabIcon name="section" />}
        showName="show_category_on_page"
        boldName="category_bold"
        alignmentName="category_alignment"
        showDefault={display.category}
        boldDefault={textFormatting.categoryBold}
        alignmentDefault={textFormatting.categoryAlignment}
      />
      <ModuleEditorVisibilityAlignRow
        label="السلسلة"
        icon={<AdminModuleTabIcon name="plans" />}
        showName="show_series_on_page"
        boldName="series_bold"
        alignmentName="series_alignment"
        showDefault={display.series}
        boldDefault={textFormatting.seriesBold}
        alignmentDefault={textFormatting.seriesAlignment}
      />
      <ModuleEditorVisibilityAlignRow
        label="المقتطف"
        icon={<AdminModuleTabIcon name="content" />}
        showName="show_excerpt_on_page"
        boldName="excerpt_bold"
        alignmentName="excerpt_alignment"
        showDefault={display.excerpt}
        boldDefault={textFormatting.excerptBold}
        alignmentDefault={textFormatting.excerptAlignment}
      />
      <ModuleEditorVisibilityAlignRow
        label="التاريخ"
        icon={<AdminModuleTabIcon name="overview" />}
        showName="show_date_on_page"
        boldName="date_bold"
        alignmentName="date_alignment"
        showDefault={display.date}
        boldDefault={textFormatting.dateBold}
        alignmentDefault={textFormatting.dateAlignment}
      />
      <ModuleEditorVisibilityAlignRow
        label="زر التفاصيل"
        icon={<AdminModuleTabIcon name="publish" />}
        showName="show_details"
        boldName="details_bold"
        alignmentName="details_alignment"
        showDefault={display.details.visible}
        boldDefault={display.details.bold}
        alignmentDefault={display.details.alignment}
      >
        <input
          name="details_text"
          aria-label="نص زر التفاصيل"
          defaultValue={display.details.text}
          placeholder="اقرأ المزيد"
          required
          className={fieldClassName("h-10")}
        />
      </ModuleEditorVisibilityAlignRow>
    </>
  );

  return (
    <ModuleEditorSection
      presentation="panel"
      data-collection-display-formatting-capability=""
      header={<AdminModuleSectionHeader id="collection-display-formatting" sectionHeading={heading} icon="settings" sectionHeaderPresentation="premium" sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME} />}
    >


      <div
        data-collection-display-settings=""
      >
        <AdminFormGrid columns={3}>{cards}</AdminFormGrid>
      </div>
    </ModuleEditorSection>
  );
}

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
  section = "all",
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
    <div className={ADMIN_FORM_STACK_CLASS_NAME} data-collection-module-editor="">
      <ModuleEditorSection surface={section === "all" ? "panel" : "neutral"} header={section === "all" ? <AdminModuleSectionHeader id="collection-configuration" sectionHeading="إعدادات القائمة" icon="section" sectionHeaderPresentation="premium" sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME} /> : undefined}>


        <AdminFormGrid columns={4}>
          <AdminCard className="h-full p-3">
            <AdminFormListboxSelect
              presentation="panel"
              name={selection.name}
              label={selection.label}
              defaultValue={selection.value}
              options={selection.options}
              required
              sizing="full"
            />
          </AdminCard>

          <AdminCard className="h-full p-3">
            <AdminFormListboxSelect
              presentation="panel"
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
          </AdminCard>

          {supportsItemsPerRow ? (
            <AdminCard className="h-full p-3">
              <AdminFormListboxSelect
              presentation="panel"
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
            </AdminCard>
          ) : (
            <input type="hidden" name="items_per_row" value={itemsPerRow} />
          )}

          <AdminCard className="h-full p-3">
            <AdminFormListboxSelect
              presentation="panel"
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
          </AdminCard>
        </AdminFormGrid>
      </ModuleEditorSection>

      {section === "all" ? (
        <CollectionModuleDisplayFormattingFields display={display.overrides} />
      ) : null}
    </div>
  );
}
