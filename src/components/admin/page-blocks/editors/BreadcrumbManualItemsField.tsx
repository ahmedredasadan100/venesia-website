"use client";

import { useState } from "react";

import { linkDefaultFromContainer } from "../../../../lib/admin/links/link-defaults";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import type { BreadcrumbBlockItem } from "../../../../lib/page-blocks/configs";
import { TrashIcon } from "../../AdminRowActions";
import { AdminActionButton, AdminFormControlHeader, AdminFormField, AdminLinkField } from "../../ui";
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AdminFormControlHeader
          title={<span role="heading" aria-level={3}>عناصر المسار اليدوية</span>}
          description="تُستخدم هذه العناصر عند اختيار المصدر اليدوي."
        />
        <AdminActionButton
          type="button"
          variant="gold"
          onClick={addItem}
          disabled={rows.length >= maxItems}
        >
          إضافة عنصر مسار
        </AdminActionButton>
      </div>

      {rows.length ? (
        <ModuleEditorRepeaterGrid>
          {rows.map((item, index) => (
            <ModuleEditorRepeaterCard
              key={item.clientKey}
              title={`عنصر ${index + 1}`}
              actions={(
                <>
                  <AdminActionButton type="button" size="icon" onClick={() => moveItem(index, -1)} disabled={index === 0} aria-label={`تحريك عنصر المسار ${index + 1} لأعلى`}>↑</AdminActionButton>
                  <AdminActionButton type="button" size="icon" onClick={() => moveItem(index, 1)} disabled={index === rows.length - 1} aria-label={`تحريك عنصر المسار ${index + 1} لأسفل`}>↓</AdminActionButton>
                  <AdminActionButton type="button" size="icon" variant="danger" onClick={() => removeItem(index)} aria-label={`حذف عنصر المسار ${index + 1}`}><TrashIcon className="size-5" /></AdminActionButton>
                </>
              )}
            >
              <AdminFormField presentation="panel" label="التسمية">
                <input name={`manual_item_${index}_label`} value={item.label ?? ""} onChange={(event) => updateLabel(index, event.target.value)} className={fieldClassName()} />
              </AdminFormField>
              <AdminLinkField
                prefix={`manual_item_${index}`}
                label="الرابط"
                defaultValue={linkDefaultFromContainer(item as Record<string, unknown>)}
                showAnchor
                presentation="inline"
                actionPresentation="bare"
              />
            </ModuleEditorRepeaterCard>
          ))}
        </ModuleEditorRepeaterGrid>
      ) : null}
    </div>
  );
}
