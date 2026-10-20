"use client";

import { useState } from "react";

import {
  ModuleEditorSection,
  ModuleEditorSectionHeading,
  ModuleEditorVisibilityAlignRow,
  MODULE_EDITOR_CONTROL_CARD_CLASS_NAME,
} from "../ModuleEditorPresentation";
import { AdminCard, AdminFormControlHeader, AdminFormGrid, AdminFormListboxSelect } from "../../ui";
import { AdminModuleTabIcon } from "../../ui/AdminModuleTabs";
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
  /** Visual opt-in only; domain presentation and persisted values stay unchanged. */
  surfacePresentation?: "default" | "premium";
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
  surfacePresentation = "default",
}: {
  display: CollectionDisplayOverrides;
  heading?: string;
  surfacePresentation?: "default" | "premium";
}) {
  const textFormatting = resolveCollectionDisplayTextFormatting(display);
  const premium = surfacePresentation === "premium";
  const Section = premium ? AdminCard : ModuleEditorSection;

  const cards = (
    <>
      <ModuleEditorVisibilityAlignRow
        label="العنوان"
        presentation={premium ? "premium" : "card"}
        icon={premium ? <AdminModuleTabIcon name="content" /> : undefined}
        showName="show_title_on_page"
        boldName="title_bold"
        alignmentName="title_alignment"
        showDefault={display.title}
        boldDefault={textFormatting.titleBold}
        alignmentDefault={textFormatting.titleAlignment}
      />
      <ModuleEditorVisibilityAlignRow
        label="الصورة"
        presentation={premium ? "premium" : "card"}
        icon={premium ? <AdminModuleTabIcon name="media" /> : undefined}
        showName="show_image_on_page"
        showDefault={display.image}
        controlMode="visibility-only"
      />
      <ModuleEditorVisibilityAlignRow
        label="التصنيف"
        presentation={premium ? "premium" : "card"}
        icon={premium ? <AdminModuleTabIcon name="section" /> : undefined}
        showName="show_category_on_page"
        boldName="category_bold"
        alignmentName="category_alignment"
        showDefault={display.category}
        boldDefault={textFormatting.categoryBold}
        alignmentDefault={textFormatting.categoryAlignment}
      />
      <ModuleEditorVisibilityAlignRow
        label="السلسلة"
        presentation={premium ? "premium" : "card"}
        icon={premium ? <AdminModuleTabIcon name="plans" /> : undefined}
        showName="show_series_on_page"
        boldName="series_bold"
        alignmentName="series_alignment"
        showDefault={display.series}
        boldDefault={textFormatting.seriesBold}
        alignmentDefault={textFormatting.seriesAlignment}
      />
      <ModuleEditorVisibilityAlignRow
        label="المقتطف"
        presentation={premium ? "premium" : "card"}
        icon={premium ? <AdminModuleTabIcon name="content" /> : undefined}
        showName="show_excerpt_on_page"
        boldName="excerpt_bold"
        alignmentName="excerpt_alignment"
        showDefault={display.excerpt}
        boldDefault={textFormatting.excerptBold}
        alignmentDefault={textFormatting.excerptAlignment}
      />
      <ModuleEditorVisibilityAlignRow
        label="التاريخ"
        presentation={premium ? "premium" : "card"}
        icon={premium ? <AdminModuleTabIcon name="overview" /> : undefined}
        showName="show_date_on_page"
        boldName="date_bold"
        alignmentName="date_alignment"
        showDefault={display.date}
        boldDefault={textFormatting.dateBold}
        alignmentDefault={textFormatting.dateAlignment}
      />
      <ModuleEditorVisibilityAlignRow
        label="زر التفاصيل"
        presentation={premium ? "premium" : "card"}
        icon={premium ? <AdminModuleTabIcon name="publish" /> : undefined}
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
    <Section {...(premium ? { presentation: "premium" as const, className: "p-4" } : {})} data-collection-display-formatting-capability="">
      {premium ? (
        <AdminFormControlHeader title={heading} icon={<AdminModuleTabIcon name="settings" />} presentation="leading-icon" />
      ) : (
        <ModuleEditorSectionHeading intent="settings">{heading}</ModuleEditorSectionHeading>
      )}

      <div
        className={premium ? undefined : "mt-4 grid items-start gap-4 md:grid-cols-3"}
        data-collection-display-settings=""
      >
        {premium ? <AdminFormGrid columns={3} className="mt-4">{cards}</AdminFormGrid> : cards}
      </div>
    </Section>
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
  surfacePresentation = "default",
  section = "all",
}: CollectionModuleEditorProps<
  Collection,
  Presentation,
  ItemsPerRow,
  ItemLimit
>) {
  const premium = surfacePresentation === "premium";
  const Section = premium ? AdminCard : ModuleEditorSection;
  const ControlCard = premium ? AdminCard : "div";
  const [activePresentation, setActivePresentation] =
    useState<Presentation>(presentation.value);
  const [itemsPerRow, setItemsPerRow] =
    useState<ItemsPerRow>(display.itemsPerRow.value);
  const supportsItemsPerRow =
    display.itemsPerRow.supportedPresentations.includes(activePresentation);

  return (
    <div className="space-y-6" data-collection-module-editor="">
      <Section {...(premium ? { presentation: "premium" as const, className: "p-4" } : {})}>
        {section === "all" ? (
          premium ? (
            <AdminFormControlHeader title="إعدادات القائمة" icon={<AdminModuleTabIcon name="section" />} presentation="leading-icon" />
          ) : (
            <ModuleEditorSectionHeading intent="settings">إعدادات القائمة</ModuleEditorSectionHeading>
          )
        ) : null}

        <AdminFormGrid columns={4} className={section === "all" ? "mt-4" : undefined}>
          <ControlCard {...(premium ? { presentation: "premium" as const } : {})} className={premium ? "h-full p-3" : `${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} h-full`}>
            <AdminFormListboxSelect
              name={selection.name}
              label={selection.label}
              defaultValue={selection.value}
              options={selection.options}
              required
              sizing="full"
            />
          </ControlCard>

          <ControlCard {...(premium ? { presentation: "premium" as const } : {})} className={premium ? "h-full p-3" : `${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} h-full`}>
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
          </ControlCard>

          {supportsItemsPerRow ? (
            <ControlCard {...(premium ? { presentation: "premium" as const } : {})} className={premium ? "h-full p-3" : `${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} h-full`}>
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
            </ControlCard>
          ) : (
            <input type="hidden" name="items_per_row" value={itemsPerRow} />
          )}

          <ControlCard {...(premium ? { presentation: "premium" as const } : {})} className={premium ? "h-full p-3" : `${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} h-full`}>
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
          </ControlCard>
        </AdminFormGrid>
      </Section>

      {section === "all" ? (
        <CollectionModuleDisplayFormattingFields display={display.overrides} surfacePresentation={surfacePresentation} />
      ) : null}
    </div>
  );
}
