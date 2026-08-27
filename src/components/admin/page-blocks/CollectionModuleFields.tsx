"use client";

import type {
  CollectionContentHierarchy,
  CollectionContentHierarchyCapabilities,
} from "../../../lib/collection-modules/content-hierarchy";
import type {
  CollectionCardVariant,
  CollectionLayout,
  CollectionView,
  CollectionViewCapabilities,
} from "../../../lib/collection-modules/collection-view";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import { AdminFormListboxSelect } from "../ui";
import { ModuleEditorField } from "./ModuleEditorPresentation";

const LAYOUT_LABELS: Record<CollectionLayout, string> = {
  grid: "شبكة",
  list: "قائمة",
  timeline: "خط زمني",
  carousel: "سلايدر",
};

const CARD_VARIANT_LABELS: Record<CollectionCardVariant, string> = {
  default: "افتراضي",
  compact: "مدمج",
};

export function CollectionItemLimitField({ value }: { value: number }) {
  return (
    <ModuleEditorField nature="standard" span={4}>
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
}: {
  value: CollectionContentHierarchy;
  capabilities: CollectionContentHierarchyCapabilities;
}) {
  const hierarchyOptions = capabilities.modes.map((mode) => ({
    value: mode,
    label: mode === "featured-first" ? "عنصر رئيسي ثم عناصر ثانوية" : "عناصر متساوية",
  }));

  return (
    <>
      {hierarchyOptions.length > 1 ? (
        <ModuleEditorField nature="standard" span={4}>
          <AdminFormListboxSelect
            name="content_hierarchy_mode"
            label="هرمية المحتوى"
            defaultValue={value.mode}
            options={hierarchyOptions}
            hint="يحدد علاقة العناصر بعد تحميلها، ولا يختار السجل الرئيسي."
          />
        </ModuleEditorField>
      ) : (
        <input
          type="hidden"
          name="content_hierarchy_mode"
          value={capabilities.modes[0] ?? value.mode}
        />
      )}

      {capabilities.modes.includes("featured-first") ? (
        <ModuleEditorField nature="standard" span={4}>
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
              يطبق عند اختيار عنصر رئيسي ثم عناصر ثانوية.
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
}: {
  value: CollectionView;
  capabilities: CollectionViewCapabilities;
}) {
  return (
    <>
      <ModuleEditorField nature="standard" span={4}>
        <AdminFormListboxSelect
          name="collection_layout"
          label="طريقة عرض المجموعة"
          defaultValue={value.layout}
          options={capabilities.layouts.map((layout) => ({
            value: layout,
            label: LAYOUT_LABELS[layout],
          }))}
        />
      </ModuleEditorField>

      <ModuleEditorField nature="standard" span={3}>
        <AdminFormListboxSelect
          name="items_per_row"
          label="عدد العناصر في الصف"
          defaultValue={String(value.itemsPerRow)}
          options={capabilities.itemsPerRow.map((count) => ({
            value: String(count),
            label: String(count),
          }))}
          hint="يطبق على طرق العرض الشبكية والسلايدر داخل الموديول."
        />
      </ModuleEditorField>

      <ModuleEditorField nature="standard" span={3}>
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
    </>
  );
}
