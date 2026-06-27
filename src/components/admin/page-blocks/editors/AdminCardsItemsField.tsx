"use client";

import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import type { CardsBlockItem } from "../../../../lib/page-blocks/configs";
import { AdminLinkField } from "../../ui";
import { linkDefaultFromContainer } from "../../../../lib/admin/links/link-defaults";

type AdminCardsItemsFieldProps = {
  items: CardsBlockItem[];
  label?: string;
  minItems?: number;
  maxItems?: number;
  showIcon?: boolean;
  showHref?: boolean;
};

function padItems(items: CardsBlockItem[], minItems: number): CardsBlockItem[] {
  const padded = [...items];
  while (padded.length < minItems) {
    padded.push({});
  }
  return padded;
}

export default function AdminCardsItemsField({
  items,
  label = "العناصر",
  minItems = 1,
  maxItems = 12,
  showIcon = true,
  showHref = false,
}: AdminCardsItemsFieldProps) {
  const rows = padItems(items, minItems).slice(0, maxItems);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-white">{label}</h3>
      <div className="space-y-3">
        {rows.map((item, index) => (
          <div key={index} className="space-y-3 rounded-2xl border border-white/10 bg-[#05070B] p-4">
            <p className="text-xs font-semibold text-[#D8B87A]/70">عنصر {index + 1}</p>
            <div className="grid gap-3 md:grid-cols-2">
              {showIcon ? (
                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-white/55">أيقونة / رقم</span>
                  <input name={`item_${index}_icon`} defaultValue={item.icon ?? ""} className={fieldClassName()} />
                </label>
              ) : null}
              <label className={`block space-y-2 ${showIcon ? "" : "md:col-span-2"}`}>
                <span className="text-xs font-semibold text-white/55">العنوان</span>
                <input name={`item_${index}_title`} defaultValue={item.title ?? ""} className={fieldClassName()} />
              </label>
              <label className="block space-y-2 md:col-span-2">
                <span className="text-xs font-semibold text-white/55">النص</span>
                <textarea
                  name={`item_${index}_body`}
                  defaultValue={item.body ?? ""}
                  rows={2}
                  className={fieldClassName("resize-y leading-7")}
                />
              </label>
              {showHref ? (
                <div className="md:col-span-2">
                  <AdminLinkField
                    prefix={`item_${index}`}
                    label="الرابط (اختياري)"
                    defaultValue={linkDefaultFromContainer(item as Record<string, unknown>)}
                    showAnchor
                  />
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
