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
import {
  AdminCard,
  AdminFormControlHeader,
  AdminFormListboxSelect,
} from "../ui";
import { AdminModuleSectionHeader, AdminModuleTabIcon } from "../ui/AdminModuleTabs";
import {
  ModuleEditorField,
  ModuleEditorFieldGrid,
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

const LAYOUT_SUMMARIES: Record<CollectionLayout, string> = {
  featured:
    "مجموعة بارزة؛ 4 لأربعة أعمدة، و2 أو 3 لعمودين، و1 لعمود واحد، مع اختيار شكل الكروت.",
  editorial:
    "عنصر رئيسي مع عناصر ثانوية قابلة للضبط، ويمكن اختيار شكل الكروت.",
  mosaic:
    "تكوين بصري بعنصر رئيسي وعناصر أصغر مع عدد ثانوي قابل للضبط.",
  grid:
    "شبكة منتظمة؛ يمكن ضبط عدد العناصر في الصف وشكل الكروت.",
  list: "قائمة رأسية؛ يتغير شكل الكروت مع بقاء ترتيب العناصر كما هو.",
  timeline: "خط زمني بالبطاقات دون إعدادات إضافية خاصة بالنمط.",
  "timeline-digest": "موجز زمني مضغوط دون إعدادات إضافية خاصة بالنمط.",
};

export function CollectionItemLimitField({ value }: { value: number }) {
  const control = (
      <label className="flex min-w-0 flex-col gap-3">
        <AdminFormControlHeader title="عدد العناصر المعروضة" presentation="compact-inline" icon={<AdminModuleTabIcon name="specifications" />} />
        <span className="flex min-w-0 items-center gap-1.5 text-sm text-[#E6C98D]">
          <input
            name="item_limit"
            type="number"
            min={1}
            max={60}
            defaultValue={value}
            required
            aria-label="عدد العناصر المعروضة"
            className={fieldClassName("[color-scheme:dark]")}
            dir="ltr"
          />
          <span>عنصر</span>
        </span>
      </label>
  );
  return (
    <ModuleEditorField
      nature="standard"
      span={3}
    >
      <AdminCard presentation="premium" className="h-full p-3">{control}</AdminCard>
    </ModuleEditorField>
  );
}
export function CollectionContentHierarchyFields({
  value,
  capabilities,
  mode,
}: {
  value: CollectionContentHierarchy;
  capabilities: CollectionContentHierarchyCapabilities;
  mode: CollectionContentHierarchyMode;
}) {
  const control = (
          <label className="flex min-w-0 flex-col gap-3">
            <AdminFormControlHeader title="عدد العناصر الثانوية" presentation="compact-inline" icon={<AdminModuleTabIcon name="specifications" />} />
            <span className="flex min-w-0 items-center gap-1.5 text-sm text-[#E6C98D]">
              <input
                name="secondary_item_count"
                type="number"
                min={1}
                max={capabilities.maximumSecondaryItems ?? 24}
                defaultValue={value.secondaryItemCount}
                required
                aria-label="عدد العناصر الثانوية"
                className={fieldClassName("[color-scheme:dark]")}
                dir="ltr"
              />
              <span>عنصر</span>
            </span>
          </label>
  );
  return (
    <>
      <input type="hidden" name="content_hierarchy_mode" value={mode} />

      {mode === "featured-first" ? (
        <ModuleEditorField
          nature="standard"
          span={3}
        >
          <AdminCard presentation="premium" className="h-full p-3">{control}</AdminCard>
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

function CollectionLayoutField({
  capabilities,
  activeLayout,
  onLayoutChange,
}: {
  capabilities: CollectionViewCapabilities;
  activeLayout: CollectionLayout;
  onLayoutChange: (layout: CollectionLayout) => void;
}) {
  const control = (
        <AdminFormListboxSelect
          name="collection_layout"
          label={<AdminFormControlHeader title="طريقة العرض" presentation="compact-inline" icon={<AdminModuleTabIcon name="section" />} />}
          value={activeLayout}
          onChange={(layout) => onLayoutChange(layout as CollectionLayout)}
          options={capabilities.layouts.map((layout) => ({
            value: layout,
            label: LAYOUT_LABELS[layout],
          }))}
          sizing="full"
        />
  );
  return (
    <ModuleEditorField nature="standard" span={4}>
      <AdminCard presentation="premium" className="h-full p-3">{control}</AdminCard>
    </ModuleEditorField>
  );
}

function CollectionViewVariantFields({
  value,
  capabilities,
  activeLayout,
}: {
  value: CollectionView;
  capabilities: CollectionViewCapabilities;
  activeLayout: CollectionLayout;
}) {
  const variantCapabilities = getCollectionViewVariantCapabilities(
    capabilities,
    activeLayout,
  );

  return (
    <>
      {variantCapabilities.itemsPerRow ? (
        <ModuleEditorField
          nature="standard"
          span={3}
        >
          <AdminCard presentation="premium" className="h-full p-3">
            <AdminFormListboxSelect
              name="items_per_row"
              label={<AdminFormControlHeader title="عدد العناصر في الصف" presentation="compact-inline" icon={<AdminModuleTabIcon name="overview" />} />}
              defaultValue={String(value.itemsPerRow)}
              options={capabilities.itemsPerRow.map((count) => ({ value: String(count), label: String(count) }))}
              sizing="full"
            />
          </AdminCard>
        </ModuleEditorField>
      ) : (
        <input type="hidden" name="items_per_row" value={value.itemsPerRow} />
      )}

      {variantCapabilities.cardVariant ? (
        <ModuleEditorField
          nature="standard"
          span={3}
        >
          <AdminCard presentation="premium" className="h-full p-3">
            <AdminFormListboxSelect
              name="collection_card_variant"
              label={<AdminFormControlHeader title="شكل الكروت" presentation="compact-inline" icon={<AdminModuleTabIcon name="section" />} />}
              defaultValue={value.cardVariant}
              options={capabilities.cardVariants.map((variant) => ({ value: variant, label: CARD_VARIANT_LABELS[variant] }))}
              sizing="full"
            />
          </AdminCard>
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
  itemLimit,
  contextLabel,
}: {
  hierarchy: CollectionContentHierarchy;
  hierarchyCapabilities: CollectionContentHierarchyCapabilities;
  view: CollectionView;
  viewCapabilities: CollectionViewCapabilities;
  itemLimit: number;
  contextLabel: string;
}) {
  const [activeLayout, setActiveLayout] = useState(view.layout);
  const variantCapabilities = getCollectionViewVariantCapabilities(
    viewCapabilities,
    activeLayout,
  );

  return (
    <div className="space-y-6" data-collection-presentation-fields="">
      <div>
        <ModuleEditorFieldGrid>
          <CollectionLayoutField
            capabilities={viewCapabilities}
            activeLayout={activeLayout}
            onLayoutChange={setActiveLayout}
          />
        </ModuleEditorFieldGrid>
      </div>

      <div>
        <AdminModuleSectionHeader id="collection-variant-settings" sectionHeading="إعدادات النمط المختار" icon="settings" />
        <div
          className="space-y-4"
          data-collection-presentation-settings={activeLayout}
        >
          <p
            className="text-sm leading-6 text-white/58"
            data-collection-presentation-context=""
          >
            <span className="font-medium text-[#E6C98D]">{contextLabel}</span>
            <span aria-hidden="true"> — </span>
            {LAYOUT_SUMMARIES[activeLayout]}
          </p>

          <ModuleEditorFieldGrid>
            <CollectionItemLimitField value={itemLimit} />
            <CollectionViewVariantFields
              value={view}
              capabilities={viewCapabilities}
              activeLayout={activeLayout}
            />
            <CollectionContentHierarchyFields
              value={hierarchy}
              capabilities={hierarchyCapabilities}
              mode={variantCapabilities.contentHierarchyMode}
            />
          </ModuleEditorFieldGrid>
        </div>
      </div>
    </div>
  );
}
