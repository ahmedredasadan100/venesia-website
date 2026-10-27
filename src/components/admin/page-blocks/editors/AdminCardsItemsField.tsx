"use client";

import { useState, type ReactNode } from "react";

import { PlusIcon, TrashIcon } from "../../AdminRowActions";
import AdminActionButton from "../../ui/AdminActionButton";
import { AdminFormControlHeader } from "../../ui/AdminForm";
import { AdminModuleTabIcon } from "../../ui/AdminModuleTabs";

import { adminFormLabelClassName } from "../../../../lib/admin/admin-ui-styles";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import type { CardsBlockItem } from "../../../../lib/page-blocks/configs";
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
  renderHref?: (item: CardsBlockItem, index: number) => ReactNode;
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
  renderHref,
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
        <AdminFormControlHeader
            presentation="leading-icon"
            title={<span role="heading" aria-level={3}>{label}</span>}
            icon={<AdminModuleTabIcon name="section" />}
          />
        <AdminActionButton variant="gold" onClick={addItem} disabled={rows.length >= maxItems}>
            <PlusIcon className="size-5" />
            إضافة بطاقة
          </AdminActionButton>
      </div>

      <ModuleEditorRepeaterGrid columns={3}>
        {rows.map((item, index) => (
          <ModuleEditorRepeaterCard
            key={item.clientKey}
            icon={<AdminModuleTabIcon name="section" />}
            title={`بطاقة ${index + 1}`}
            actions={(
              <>
                <AdminActionButton size="icon" onClick={() => moveItem(index, -1)} disabled={index === 0} aria-label={`تحريك البطاقة ${index + 1} لأعلى`}>↑</AdminActionButton>
                <AdminActionButton size="icon" onClick={() => moveItem(index, 1)} disabled={index === rows.length - 1} aria-label={`تحريك البطاقة ${index + 1} لأسفل`}>↓</AdminActionButton>
                <AdminActionButton size="icon" variant="danger" onClick={() => removeItem(index)} disabled={rows.length <= minItems} aria-label={`حذف البطاقة ${index + 1}`}><TrashIcon className="size-5" /></AdminActionButton>
              </>
            )}
          >
            <div className="space-y-3">
              {showIcon ? (
                <label className={adminFormLabelClassName({ textInset: true })}>
                  <span data-admin-form-label-text="">{MODULE_EDITOR_TERMINOLOGY.eyebrow.labelAr}</span>
                  <input name={`item_${index}_icon`} value={item.icon ?? ""} onChange={(event) => updateItem(index, { icon: event.target.value })} className={fieldClassName()} />
                </label>
              ) : null}
              <label className={adminFormLabelClassName({ textInset: true })}>
                <span data-admin-form-label-text="">العنوان</span>
                <input name={`item_${index}_title`} value={item.title ?? ""} onChange={(event) => updateItem(index, { title: event.target.value })} className={fieldClassName()} />
              </label>
              <label className={adminFormLabelClassName({ textInset: true })}>
                <span data-admin-form-label-text="">{MODULE_EDITOR_TERMINOLOGY.shortDescription.labelAr}</span>
                <textarea name={`item_${index}_body`} value={item.body ?? ""} onChange={(event) => updateItem(index, { body: event.target.value })} rows={2} className={fieldClassName("resize-y leading-7")} />
              </label>
              {renderHref ? (
                <div>{renderHref(item, index)}</div>
              ) : null}
            </div>
          </ModuleEditorRepeaterCard>
        ))}
      </ModuleEditorRepeaterGrid>
    </div>
  );
}
