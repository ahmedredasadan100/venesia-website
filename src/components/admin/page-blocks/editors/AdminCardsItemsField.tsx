"use client";

import { useState } from "react";

import { linkDefaultFromContainer } from "../../../../lib/admin/links/link-defaults";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import type { CardsBlockItem } from "../../../../lib/page-blocks/configs";
import { AdminLinkField } from "../../ui";
import {
  ModuleEditorRepeaterCard,
  ModuleEditorRepeaterGrid,
} from "../ModuleEditorPresentation";
import { MODULE_EDITOR_TERMINOLOGY } from "../../../../lib/page-blocks/module-editor-presentation-contract";

type AdminCardsItemsFieldProps = {
  items: CardsBlockItem[];
  label?: string;
  minItems?: number;
  maxItems?: number;
  showIcon?: boolean;
  showHref?: boolean;
};

type CardsEditorItem = CardsBlockItem & { clientKey: string };

function padItems(items: CardsBlockItem[], minItems: number): CardsEditorItem[] {
  const padded = items.map((item, index) => ({ ...item, clientKey: `saved-card-${index}` }));
  while (padded.length < minItems) {
    padded.push({ clientKey: `empty-card-${padded.length}` });
  }
  return padded;
}

export default function AdminCardsItemsField({
  items,
  label = "البطاقات",
  minItems = 1,
  maxItems = 12,
  showIcon = true,
  showHref = false,
}: AdminCardsItemsFieldProps) {
  const [rows, setRows] = useState<CardsEditorItem[]>(() =>
    padItems(items, minItems).slice(0, maxItems),
  );

  function updateItem(index: number, patch: Partial<CardsBlockItem>) {
    setRows((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
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

  function removeItem(index: number) {
    if (rows.length <= minItems) return;
    setRows((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function addItem() {
    if (rows.length >= maxItems) return;
    setRows((current) => [
      ...current,
      { clientKey: `new-card-${Date.now()}-${current.length}` },
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">{label}</h3>
        <button
          type="button"
          onClick={addItem}
          disabled={rows.length >= maxItems}
          className="cursor-pointer rounded-2xl border border-[#D8B87A]/35 bg-[#D8B87A]/10 px-4 py-2 text-sm font-semibold text-[#D8B87A] hover:bg-[#D8B87A]/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          إضافة بطاقة
        </button>
      </div>

      <ModuleEditorRepeaterGrid>
        {rows.map((item, index) => (
          <ModuleEditorRepeaterCard
            key={item.clientKey}
            title={`بطاقة ${index + 1}`}
            actions={(
              <>
                <button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0} aria-label={`تحريك البطاقة ${index + 1} لأعلى`} className="cursor-pointer rounded-xl border border-white/10 px-3 py-1 text-xs text-white/55 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30">↑</button>
                <button type="button" onClick={() => moveItem(index, 1)} disabled={index === rows.length - 1} aria-label={`تحريك البطاقة ${index + 1} لأسفل`} className="cursor-pointer rounded-xl border border-white/10 px-3 py-1 text-xs text-white/55 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30">↓</button>
                <button type="button" onClick={() => removeItem(index)} disabled={rows.length <= minItems} aria-label={`حذف البطاقة ${index + 1}`} className="cursor-pointer rounded-xl border border-white/10 px-3 py-1 text-xs text-white/55 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30">حذف</button>
              </>
            )}
          >
            <div className="space-y-3">
              {showIcon ? (
                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-white/55">{MODULE_EDITOR_TERMINOLOGY.eyebrow.labelAr}</span>
                  <input name={`item_${index}_icon`} value={item.icon ?? ""} onChange={(event) => updateItem(index, { icon: event.target.value })} className={fieldClassName()} />
                </label>
              ) : null}
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-white/55">العنوان</span>
                <input name={`item_${index}_title`} value={item.title ?? ""} onChange={(event) => updateItem(index, { title: event.target.value })} className={fieldClassName()} />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-white/55">{MODULE_EDITOR_TERMINOLOGY.shortDescription.labelAr}</span>
                <textarea name={`item_${index}_body`} value={item.body ?? ""} onChange={(event) => updateItem(index, { body: event.target.value })} rows={2} className={fieldClassName("resize-y leading-7")} />
              </label>
              {showHref ? (
                <div>
                  <AdminLinkField
                    prefix={`item_${index}`}
                    label="الرابط (اختياري)"
                    defaultValue={linkDefaultFromContainer(item as Record<string, unknown>)}
                    showAnchor
                  />
                </div>
              ) : null}
            </div>
          </ModuleEditorRepeaterCard>
        ))}
      </ModuleEditorRepeaterGrid>
    </div>
  );
}
