"use client";

import { useState } from "react";
import type {
  CollectionContentHierarchy,
  CollectionContentHierarchyCapabilities,
  CollectionContentHierarchyMode,
} from "../../../lib/collection-modules/content-hierarchy";
import type {
  CollectionCardVariant,
  CollectionLayout,
  CollectionView,
  CollectionViewCapabilities,
} from "../../../lib/collection-modules/collection-view";
import { getCollectionViewVariantCapabilities } from "../../../lib/collection-modules/collection-view";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import { AdminFormListboxSelect } from "../ui";
import {
  ModuleEditorField,
  MODULE_EDITOR_CONTROL_CARD_CLASS_NAME,
} from "./ModuleEditorPresentation";

const LAYOUT_LABELS: Record<CollectionLayout, string> = {
  featured: "مميز",
  editorial: "تحريري",
  mosaic: "فسيفساء بصرية",
  grid: "شبكة",
  list: "قائمة",
  timeline: "خط زمني بالبطاقات",
  "timeline-digest": "موجز زمني",
};

const CARD_VARIANT_LABELS: Record<CollectionCardVariant, string> = {
  default: "افتراضي",
  compact: "مدمج",
};

export function CollectionItemLimitField({ value }: { value: number }) {
  return (
    <ModuleEditorField
      nature="standard"
      span={4}
      className={MODULE_EDITOR_CONTROL_CARD_CLASS_NAME}
    >
      <label className="block space-y-2">
        <span className="text-xs font-semibold text-white/55">عدد العناصر المعروضة</span>
        <input
          name="item_limit"
          type="number"
          min={1}
          max={60}
          defaultValue={value}
          required
          className={fieldClassName()}
          dir="ltr"
        />
      </label>
    </ModuleEditorField>
  );
}
export function CollectionContentHierarchyFields({
  value,
  capabilities,
  mode,
  layout,
}: {
  value: CollectionContentHierarchy;
  capabilities: CollectionContentHierarchyCapabilities;
  mode: CollectionContentHierarchyMode;
  layout: CollectionLayout;
}) {
  return (
    <>
      <input type="hidden" name="content_hierarchy_mode" value={mode} />

      {mode === "featured-first" ? (
        <ModuleEditorField
          nature="standard"
          span={4}
          className={MODULE_EDITOR_CONTROL_CARD_CLASS_NAME}
        >
          <label className="block space-y-2">
            <span className="text-xs font-semibold text-white/55">عدد العناصر الثانوية</span>
            <input
              name="secondary_item_count"
              type="number"
              min={1}
              max={capabilities.maximumSecondaryItems ?? 24}
              defaultValue={value.secondaryItemCount}
              required
              className={fieldClassName()}
              dir="ltr"
            />
            <span className="block text-xs leading-5 text-white/40">
              {layout === "mosaic"
                ? "يحدد عدد العناصر الأصغر بجوار العنصر البصري الرئيسي."
                : "يطبق على طريقة العرض التحريرية فقط."}
            </span>
          </label>
        </ModuleEditorField>
      ) : (
        <input
          type="hidden"
          name="secondary_item_count"
          value={value.secondaryItemCount}
        />
      )}
    </>
  );
}

export function CollectionViewFields({
  value,
  capabilities,
  activeLayout,
  onLayoutChange,
}: {
  value: CollectionView;
  capabilities: CollectionViewCapabilities;
  activeLayout: CollectionLayout;
  onLayoutChange: (layout: CollectionLayout) => void;
}) {
  const variantCapabilities = getCollectionViewVariantCapabilities(
    capabilities,
    activeLayout,
  );

  return (
    <>
      <ModuleEditorField
        nature="standard"
        span={4}
        className={MODULE_EDITOR_CONTROL_CARD_CLASS_NAME}
      >
        <AdminFormListboxSelect
          name="collection_layout"
          label="طريقة العرض"
          value={activeLayout}
          onChange={(layout) => onLayoutChange(layout as CollectionLayout)}
          options={capabilities.layouts.map((layout) => ({
            value: layout,
            label: LAYOUT_LABELS[layout],
          }))}
        />
      </ModuleEditorField>

      {variantCapabilities.itemsPerRow ? (
        <ModuleEditorField
          nature="standard"
          span={3}
          className={MODULE_EDITOR_CONTROL_CARD_CLASS_NAME}
        >
          <AdminFormListboxSelect
            name="items_per_row"
            label="عدد العناصر في الصف"
            defaultValue={String(value.itemsPerRow)}
            options={capabilities.itemsPerRow.map((count) => ({
              value: String(count),
              label: String(count),
            }))}
            hint={activeLayout === "featured"
              ? "في العرض المميز: 4 تعرض أربعة أعمدة، و3 تعرض عمودين، و2 عمودين، و1 عمودًا واحدًا."
              : "يطبق وفق قواعد الشبكة الطبيعية لهذه الطريقة."}
          />
        </ModuleEditorField>
      ) : (
        <input type="hidden" name="items_per_row" value={value.itemsPerRow} />
      )}

      {variantCapabilities.cardVariant ? (
        <ModuleEditorField
          nature="standard"
          span={3}
          className={MODULE_EDITOR_CONTROL_CARD_CLASS_NAME}
        >
          <AdminFormListboxSelect
            name="collection_card_variant"
            label="شكل الكروت"
            defaultValue={value.cardVariant}
            options={capabilities.cardVariants.map((variant) => ({
              value: variant,
              label: CARD_VARIANT_LABELS[variant],
            }))}
          />
        </ModuleEditorField>
      ) : (
        <input
          type="hidden"
          name="collection_card_variant"
          value={value.cardVariant}
        />
      )}
    </>
  );
}

export function CollectionPresentationFields({
  hierarchy,
  hierarchyCapabilities,
  view,
  viewCapabilities,
}: {
  hierarchy: CollectionContentHierarchy;
  hierarchyCapabilities: CollectionContentHierarchyCapabilities;
  view: CollectionView;
  viewCapabilities: CollectionViewCapabilities;
}) {
  const [activeLayout, setActiveLayout] = useState(view.layout);
  const variantCapabilities = getCollectionViewVariantCapabilities(
    viewCapabilities,
    activeLayout,
  );

  return (
    <>
      <CollectionViewFields
        value={view}
        capabilities={viewCapabilities}
        activeLayout={activeLayout}
        onLayoutChange={setActiveLayout}
      />
      <CollectionContentHierarchyFields
        value={hierarchy}
        capabilities={hierarchyCapabilities}
        mode={variantCapabilities.contentHierarchyMode}
        layout={activeLayout}
      />
    </>
  );
}
