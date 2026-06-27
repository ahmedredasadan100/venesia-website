"use client";

import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import type { BreadcrumbBlockItem } from "../../../../lib/page-blocks/configs";
import { AdminLinkField } from "../../ui";
import { linkDefaultFromContainer } from "../../../../lib/admin/links/link-defaults";

type BreadcrumbManualItemsFieldProps = {
  items: BreadcrumbBlockItem[];
  maxItems?: number;
};

function padItems(items: BreadcrumbBlockItem[], maxItems: number) {
  const rows = [...items].slice(0, maxItems);
  while (rows.length < Math.min(3, maxItems)) rows.push({});
  return rows;
}

export default function BreadcrumbManualItemsField({ items, maxItems = 8 }: BreadcrumbManualItemsFieldProps) {
  const rows = padItems(items, maxItems);

  return (
    <div className="space-y-4">
      <p className="text-xs leading-6 text-white/45">
        أضف عناصر المسار يدويًا — اختر كل رابط من النظام بدون كتابة Internal URL.
      </p>
      <div className="space-y-3">
        {rows.map((item, index) => (
          <div key={index} className="space-y-3 rounded-2xl border border-white/10 bg-[#05070B] p-4">
            <p className="text-xs font-semibold text-[#D8B87A]/70">عنصر {index + 1}</p>
            <label className="block space-y-2">
              <span className="text-xs font-semibold text-white/55">Label</span>
              <input
                name={`manual_item_${index}_label`}
                defaultValue={item.label ?? ""}
                className={fieldClassName()}
              />
            </label>
            <AdminLinkField
              prefix={`manual_item_${index}`}
              label="الرابط"
              defaultValue={linkDefaultFromContainer(item as Record<string, unknown>)}
              showAnchor
            />
          </div>
        ))}
      </div>
    </div>
  );
}
