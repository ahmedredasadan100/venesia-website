"use client";

import { useMemo, useRef, useState } from "react";

type CategorySlugFieldsProps = {
  nameDefaultValue?: string;
  slugDefaultValue?: string;
  namePlaceholder?: string;
  slugPlaceholder?: string;
};

const arabicMap: Record<string, string> = {
  ا: "a",
  أ: "a",
  إ: "e",
  آ: "a",
  ب: "b",
  ت: "t",
  ث: "th",
  ج: "g",
  ح: "h",
  خ: "kh",
  د: "d",
  ذ: "z",
  ر: "r",
  ز: "z",
  س: "s",
  ش: "sh",
  ص: "s",
  ض: "d",
  ط: "t",
  ظ: "z",
  ع: "a",
  غ: "gh",
  ف: "f",
  ق: "q",
  ك: "k",
  ل: "l",
  م: "m",
  ن: "n",
  ه: "h",
  و: "w",
  ي: "y",
  ى: "a",
  ة: "h",
  ء: "",
  ئ: "e",
  ؤ: "o",
};

function createSlug(value: string) {
  return value
    .split("")
    .map((char) => arabicMap[char] ?? char)
    .join("")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export default function CategorySlugFields({
  nameDefaultValue = "",
  slugDefaultValue = "",
  namePlaceholder = "اسم التصنيف",
  slugPlaceholder = "category-slug",
}: CategorySlugFieldsProps) {
  const [name, setName] = useState(nameDefaultValue);
  const [slug, setSlug] = useState(slugDefaultValue || createSlug(nameDefaultValue));
  const slugTouchedRef = useRef(Boolean(slugDefaultValue));

  const suggestedSlug = useMemo(() => createSlug(name), [name]);

  return (
    <>
      <div className="space-y-2">
        <label className="text-xs font-medium text-white/45">اسم التصنيف</label>
        <input
          name="name"
          required
          value={name}
          onChange={(event) => {
            const nextName = event.target.value;
            setName(nextName);
            if (!slugTouchedRef.current) setSlug(createSlug(nextName));
          }}
          placeholder={namePlaceholder}
          className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#D8B87A]/45"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-white/45">Slug التصنيف</label>
        <div className="flex gap-2">
          <input
            name="slug"
            value={slug}
            onChange={(event) => {
              slugTouchedRef.current = true;
              setSlug(createSlug(event.target.value));
            }}
            placeholder={slugPlaceholder}
            dir="ltr"
            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 font-en text-sm text-white outline-none placeholder:text-white/30 focus:border-[#D8B87A]/45"
          />
          <button
            type="button"
            onClick={() => {
              slugTouchedRef.current = false;
              setSlug(suggestedSlug);
            }}
            className="shrink-0 rounded-2xl border border-[#D8B87A]/25 px-4 py-3 text-xs font-semibold text-[#D8B87A] transition hover:bg-[#D8B87A]/10"
            title="يغيّر الـ Slug فقط. اضغط حفظ لتطبيق التعديل."
          >
            توليد من الاسم
          </button>
        </div>
        <p className="text-[11px] text-white/30">توليد الـ Slug لا يحفظ تلقائيًا. اضغط حفظ لتطبيق التعديل.</p>
      </div>
    </>
  );
}
