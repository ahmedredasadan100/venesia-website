"use client";

import { useState } from "react";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";

type AdminStringListFieldProps = {
  name: string;
  label: string;
  defaultItems?: string[];
  placeholder?: string;
  addLabel?: string;
  emptyHint?: string;
};

export default function AdminStringListField({
  name,
  label,
  defaultItems = [],
  placeholder = "اكتب العنصر هنا",
  addLabel = "إضافة",
  emptyHint,
}: AdminStringListFieldProps) {
  const [items, setItems] = useState<string[]>(defaultItems.length ? defaultItems : []);

  function updateItem(index: number, value: string) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
  }

  function addItem() {
    setItems((current) => [...current, ""]);
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium text-white/70">{label}</span>
        <button
          type="button"
          onClick={addItem}
          className="cursor-pointer rounded-full border border-[#D8B87A]/35 px-4 py-2 text-sm font-semibold text-[#D8B87A] transition hover:bg-[#D8B87A]/10"
        >
          {addLabel}
        </button>
      </div>

      {items.length ? (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={`${name}-${index}`} className="flex items-center gap-2">
              <input
                name={name}
                value={item}
                onChange={(event) => updateItem(index, event.target.value)}
                placeholder={placeholder}
                className={fieldClassName("flex-1")}
              />
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="cursor-pointer rounded-xl border border-red-400/20 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/10"
              >
                حذف
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-white/10 px-4 py-3 text-sm text-white/40">
          {emptyHint ?? "لا توجد عناصر — اضغط إضافة لبدء القائمة."}
        </p>
      )}
    </div>
  );
}
