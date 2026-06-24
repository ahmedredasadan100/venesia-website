"use client";

import { useState } from "react";
import AdminMediaImageField from "./AdminMediaImageField";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";

export type MediaListItem = {
  image: string;
  label: string;
};

type AdminMediaListFieldProps = {
  imageName: string;
  labelName: string;
  title: string;
  defaultItems?: MediaListItem[];
  browseFolder?: string;
  addLabel?: string;
  dimensionHint?: "hero" | "content";
};

export default function AdminMediaListField({
  imageName,
  labelName,
  title,
  defaultItems = [],
  browseFolder = "images/projects",
  addLabel = "إضافة صورة",
  dimensionHint = "content",
}: AdminMediaListFieldProps) {
  const [items, setItems] = useState<MediaListItem[]>(defaultItems.length ? defaultItems : []);

  function addItem() {
    setItems((current) => [...current, { image: "", label: "" }]);
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function updateItem(index: number, patch: Partial<MediaListItem>) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function moveItem(index: number, direction: -1 | 1) {
    setItems((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-semibold text-white/70">{title}</span>
        <button
          type="button"
          onClick={addItem}
          className="cursor-pointer rounded-full border border-[#D8B87A]/35 px-4 py-2 text-sm font-semibold text-[#D8B87A] transition hover:bg-[#D8B87A]/10"
        >
          {addLabel}
        </button>
      </div>

      {items.length ? (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={`${imageName}-${index}`} className="space-y-4 rounded-[20px] border border-white/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-[#D8B87A]/70">صورة {index + 1}</p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => moveItem(index, -1)}
                      disabled={index === 0}
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-white/10 text-xs text-white/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                      title="تحريك لأعلى"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(index, 1)}
                      disabled={index === items.length - 1}
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-white/10 text-xs text-white/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                      title="تحريك لأسفل"
                    >
                      ↓
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="cursor-pointer rounded-xl border border-red-400/20 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/10"
                >
                  حذف
                </button>
              </div>

              <AdminMediaImageField
                name={imageName}
                label="الصورة"
                defaultValue={item.image}
                browseFolder={browseFolder}
                dimensionHint={dimensionHint}
                onValueChange={(image) => updateItem(index, { image })}
              />

              <label className="block">
                <span className="text-xs font-semibold text-white/55">التسمية</span>
                <input
                  name={labelName}
                  value={item.label}
                  onChange={(event) => updateItem(index, { label: event.target.value })}
                  className={`${fieldClassName()} mt-3`}
                />
              </label>
            </div>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={addItem}
          className="flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-white/40 hover:border-[#D8B87A]/30 hover:text-white/60"
        >
          لا توجد صور — اضغط «{addLabel}» لبدء المعرض
        </button>
      )}
    </div>
  );
}
