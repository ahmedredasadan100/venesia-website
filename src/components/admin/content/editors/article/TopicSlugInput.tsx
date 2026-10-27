"use client";

import { useEffect, useRef, useState } from "react";
import type { ContentType } from "../../../../../lib/admin/content/content-types";
import { adminFormFieldClassName } from "../../../../../lib/admin/admin-ui-styles";
import { slugifyFromTitle } from "../../../../../lib/admin/slug";
import {
  AdminFormError,
  useOptionalAdminFormRuntime,
} from "../../../ui/AdminFormRuntime";

type TopicSlugInputProps = {
  defaultValue?: string | null;
  titleInputName?: string;
  titleValue?: string;
  required?: boolean;
  contentType?: ContentType;
  /** Optional shared label/stack classes; omitted consumers retain their current presentation. */
  labelClassName?: string;
  /** A recovered raw value, including blank, is an explicit user draft. */
  draftRestored?: boolean;
};

export default function TopicSlugInput({
  defaultValue = "",
  titleInputName = "title",
  titleValue,
  required = true,
  labelClassName,
  draftRestored = false,
}: TopicSlugInputProps) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [isManual, setIsManual] = useState(draftRestored || Boolean(defaultValue));
  const resolvedValue =
    titleValue !== undefined && !isManual ? slugifyFromTitle(titleValue) : value;
  const inputRef = useRef<HTMLInputElement>(null);
  const previousValueRef = useRef(resolvedValue);
  const hasError = Boolean(
    useOptionalAdminFormRuntime()?.fieldErrors.slug?.length,
  );

  useEffect(() => {
    if (previousValueRef.current === resolvedValue) return;
    previousValueRef.current = resolvedValue;
    // Notify the existing dirty and SEO observers after React commits the value.
    inputRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [resolvedValue]);

  useEffect(() => {
    const input = inputRef.current;
    const form = input?.form;
    if (!input || !form) return;

    // A confirmed save protects this value from later title-only edits.
    const protectSavedSlug = () => {
      setValue(input.value);
      setIsManual(true);
    };

    form.addEventListener("admin-form-saved", protectSavedSlug);
    return () => form.removeEventListener("admin-form-saved", protectSavedSlug);
  }, []);

  useEffect(() => {
    const input = inputRef.current;
    const form = input?.form;
    if (!input || !form) return;

    const finalizeSlug = () => {
      const titleInput = form.elements.namedItem(titleInputName);
      const currentTitle = titleInput instanceof HTMLInputElement || titleInput instanceof HTMLTextAreaElement
        ? titleInput.value
        : titleValue ?? "";
      const rawValue = input.value;
      const normalized = slugifyFromTitle(rawValue.trim() || currentTitle);
      // Retain an invalid nonempty candidate for the existing server validation.
      if (normalized || !rawValue.trim()) setValue(normalized);
    };

    form.addEventListener("admin-form-before-submit", finalizeSlug);
    return () => form.removeEventListener("admin-form-before-submit", finalizeSlug);
  }, [titleInputName, titleValue]);

  useEffect(() => {
    if (titleValue !== undefined) return;
    const form = inputRef.current?.form;
    const titleInput = form?.elements.namedItem(titleInputName) as HTMLInputElement | null;

    if (!titleInput) return;

    function syncSlug() {
      if (isManual) return;
      setValue(slugifyFromTitle(titleInput?.value ?? ""));
    }

    titleInput.addEventListener("input", syncSlug);
    syncSlug();

    return () => titleInput.removeEventListener("input", syncSlug);
  }, [isManual, titleInputName, titleValue]);

  return (
    <div className={labelClassName ?? "space-y-1.5"}>
      <label data-admin-form-label-text htmlFor="topic-slug" className={labelClassName === undefined ? "text-xs font-medium text-white/58" : undefined}>
        الرابط المختصر (Slug) <span className="text-red-400">*</span>
      </label>
      <div className="relative" data-topic-slug-field>
        <input
          ref={inputRef}
          id="topic-slug"
          name="slug"
          value={resolvedValue}
          onChange={(event) => {
            setValue(event.target.value);
            setIsManual(true);
          }}
          onBlur={(event) => {
            if (isManual && event.currentTarget.value !== (defaultValue ?? "")) {
              const rawValue = event.currentTarget.value;
              const normalized = slugifyFromTitle(rawValue);
              if (normalized || !rawValue.trim()) setValue(normalized);
            }
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
            const titleInput = form?.elements.namedItem(titleInputName);
            const currentTitle = titleInput instanceof HTMLInputElement || titleInput instanceof HTMLTextAreaElement
              ? titleInput.value
              : titleValue ?? "";
            setValue(
              slugifyFromTitle(currentTitle),
            );
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
