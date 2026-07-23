"use client";

import { useEffect, useRef, useState } from "react";
import type { ContentType } from "../../../../../lib/admin/content/content-types";
import { adminFormFieldClassName } from "../../../../../lib/admin/admin-ui-styles";
import {
  AdminFormError,
  useOptionalAdminFormRuntime,
} from "../../../ui/AdminFormRuntime";

type TopicSlugInputProps = {
  defaultValue?: string | null;
  titleInputName?: string;
  required?: boolean;
  contentType?: ContentType;
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
  const hasError = Boolean(
    useOptionalAdminFormRuntime()?.fieldErrors.slug?.length,
  );

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
    <div className="space-y-1.5">
      <label htmlFor="topic-slug" className="text-xs font-medium text-white/58">
        الرابط المختصر (Slug) <span className="text-red-400">*</span>
      </label>
      <div className="relative" data-topic-slug-field>
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
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? "slug-error" : undefined}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          title="استخدم حروف إنجليزية صغيرة وأرقام وشرطة بين الكلمات فقط"
          placeholder="best-district-in-bait-al-watan"
          dir="ltr"
          className={adminFormFieldClassName("h-11 rounded-xl py-2.5 pl-[7.25rem] pr-3 font-en")}
        />
        <button
          type="button"
          onClick={() => {
            const form = inputRef.current?.form;
            const titleInput = form?.elements.namedItem(titleInputName) as HTMLInputElement | null;
            setValue(slugify(titleInput?.value ?? ""));
            setIsManual(false);
          }}
          className="absolute bottom-1 left-1 top-1 z-10 shrink-0 whitespace-nowrap rounded-lg border border-[#D8B87A]/25 bg-[#090D12]/96 px-3 text-xs font-medium text-[#D8B87A] transition hover:bg-[#D8B87A]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E2B84F]/70"
        >
          توليد تلقائي
        </button>
      </div>
      <AdminFormError name="slug" />
    </div>
  );
}
