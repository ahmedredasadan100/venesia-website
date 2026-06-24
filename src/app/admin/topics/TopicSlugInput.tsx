"use client";

import { useEffect, useRef, useState } from "react";

type TopicSlugInputProps = {
  defaultValue?: string | null;
  titleInputName?: string;
  required?: boolean;
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

function slugify(value: string) {
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

export default function TopicSlugInput({
  defaultValue = "",
  titleInputName = "title",
  required = true,
}: TopicSlugInputProps) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [isManual, setIsManual] = useState(Boolean(defaultValue));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = inputRef.current?.form;
    const titleInput = form?.elements.namedItem(titleInputName) as HTMLInputElement | null;

    if (!titleInput) return;

    function syncSlug() {
      if (isManual) return;
      setValue(slugify(titleInput?.value ?? ""));
    }

    titleInput.addEventListener("input", syncSlug);
    syncSlug();

    return () => titleInput.removeEventListener("input", syncSlug);
  }, [isManual, titleInputName]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="topic-slug" className="text-sm font-medium text-white/70">
          Slug
        </label>

        <button
          type="button"
          onClick={() => {
            const form = inputRef.current?.form;
            const titleInput = form?.elements.namedItem(titleInputName) as HTMLInputElement | null;
            setValue(slugify(titleInput?.value ?? ""));
            setIsManual(false);
          }}
          className="rounded-full border border-[#D8B87A]/25 px-3 py-1 text-xs text-[#D8B87A] transition hover:bg-[#D8B87A]/10"
        >
          توليد تلقائي
        </button>
      </div>

      <input
        ref={inputRef}
        id="topic-slug"
        name="slug"
        value={value}
        onChange={(event) => {
          setValue(slugify(event.target.value));
          setIsManual(true);
        }}
        required={required}
        pattern="[a-z0-9]+(-[a-z0-9]+)*"
        title="استخدم حروف إنجليزية صغيرة وأرقام وشرطة بين الكلمات فقط"
        placeholder="best-district-in-bait-al-watan"
        className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 font-en text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="text-white/35">
          يتم توليده تلقائيًا من العنوان، ويمكن تعديله يدويًا قبل الحفظ.
        </p>
        <span className="font-en text-white/40">{value.length} chars</span>
      </div>
    </div>
  );
}
