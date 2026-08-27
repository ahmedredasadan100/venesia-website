"use client";

import { useState } from "react";

import { linkDefaultFromContainer } from "../../../../lib/admin/links/link-defaults";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import type { BreadcrumbBlockItem } from "../../../../lib/page-blocks/configs";
import { AdminLinkField } from "../../ui";
import {
  ModuleEditorRepeaterCard,
  ModuleEditorRepeaterGrid,
} from "../ModuleEditorPresentation";

type BreadcrumbManualItemsFieldProps = {
  items: BreadcrumbBlockItem[];
  maxItems?: number;
};

type BreadcrumbEditorItem = BreadcrumbBlockItem & { clientKey: string };

export default function BreadcrumbManualItemsField({ items, maxItems = 8 }: BreadcrumbManualItemsFieldProps) {
  const [rows, setRows] = useState<BreadcrumbEditorItem[]>(() => {
    const initial = items.slice(0, maxItems).map((item, index) => ({
      ...item,
      clientKey: `saved-breadcrumb-${index}`,
    }));
    return initial;
  });

  function updateLabel(index: number, label: string) {
    setRows((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, label } : item,
    ));
  }

  function moveItem(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= rows.length) return;
    setRows((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function addItem() {
    setRows((current) => current.length >= maxItems
      ? current
      : [...current, { clientKey: `new-breadcrumb-${Date.now()}-${current.length}` }]);
  }

  function removeItem(index: number) {
    setRows((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={addItem}
          disabled={rows.length >= maxItems}
          className="cursor-pointer rounded-2xl border border-[#D8B87A]/35 bg-[#D8B87A]/10 px-4 py-2 text-sm font-semibold text-[#D8B87A] hover:bg-[#D8B87A]/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          إضافة عنصر مسار
        </button>
      </div>

      {rows.length ? (
        <ModuleEditorRepeaterGrid>
          {rows.map((item, index) => (
            <ModuleEditorRepeaterCard
              key={item.clientKey}
              title={`عنصر ${index + 1}`}
              actions={(
                <>
                  <button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0} aria-label={`تحريك عنصر المسار ${index + 1} لأعلى`} className="cursor-pointer rounded-xl border border-white/10 px-3 py-1 text-xs text-white/55 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30">↑</button>
                  <button type="button" onClick={() => moveItem(index, 1)} disabled={index === rows.length - 1} aria-label={`تحريك عنصر المسار ${index + 1} لأسفل`} className="cursor-pointer rounded-xl border border-white/10 px-3 py-1 text-xs text-white/55 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30">↓</button>
                  <button type="button" onClick={() => removeItem(index)} aria-label={`حذف عنصر المسار ${index + 1}`} className="cursor-pointer rounded-xl border border-white/10 px-3 py-1 text-xs text-white/55 hover:bg-white/5">حذف</button>
                </>
              )}
            >
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-white/55">التسمية</span>
                <input name={`manual_item_${index}_label`} value={item.label ?? ""} onChange={(event) => updateLabel(index, event.target.value)} className={fieldClassName()} />
              </label>
              <AdminLinkField
                prefix={`manual_item_${index}`}
                label="الرابط"
                defaultValue={linkDefaultFromContainer(item as Record<string, unknown>)}
                showAnchor
              />
            </ModuleEditorRepeaterCard>
          ))}
        </ModuleEditorRepeaterGrid>
      ) : null}
    </div>
  );
}
