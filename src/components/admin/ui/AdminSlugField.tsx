"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { normalizeSlugInput, slugifyFromTitle } from "../../../lib/admin/slug";
import {
  adminFormFieldClassName,
  adminFormHintClassName,
  adminFormLabelClassName,
} from "../VenesiaModal";

type AdminSlugFieldProps = {
  id?: string;
  name?: string;
  sourceInputName: string;
  value?: string;
  error?: string | null;
  required?: boolean;
  readOnly?: boolean;
  onChange?: (slug: string) => void;
  appearance?: "dark" | "light";
};

export default function AdminSlugField({
  id,
  name = "slug",
  sourceInputName,
  value: controlledValue,
  error = null,
  required = true,
  readOnly = false,
  onChange,
  appearance = "dark",
}: AdminSlugFieldProps) {
  const [internalSlug, setInternalSlug] = useState(controlledValue ?? "");
  const [isManual, setIsManual] = useState(Boolean(controlledValue));
  const slugRef = useRef<HTMLInputElement>(null);
  const notifyChangeRef = useRef(false);

  const slug = controlledValue ?? internalSlug;

  const updateSlug = useCallback((next: string, notify = false) => {
    if (next === slug) return;
    notifyChangeRef.current = notify;
    if (controlledValue === undefined) {
      setInternalSlug(next);
    }
    onChange?.(next);
  }, [controlledValue, onChange, slug]);

  useEffect(() => {
    if (!notifyChangeRef.current) return;
    notifyChangeRef.current = false;
    slugRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [slug]);

  useEffect(() => {
    const form = slugRef.current?.form;
    const sourceInput = form?.elements.namedItem(sourceInputName) as HTMLInputElement | null;
    if (!sourceInput) return;

    function syncFromSource() {
      if (isManual) return;
      updateSlug(slugifyFromTitle(sourceInput?.value ?? ""), true);
    }

    sourceInput.addEventListener("input", syncFromSource);
    syncFromSource();

    return () => sourceInput.removeEventListener("input", syncFromSource);
  }, [isManual, sourceInputName, updateSlug]);

  function handleGenerate() {
    const form = slugRef.current?.form;
    const sourceInput = form?.elements.namedItem(sourceInputName) as HTMLInputElement | null;
    setIsManual(false);
    updateSlug(slugifyFromTitle(sourceInput?.value ?? ""), true);
  }

  const light = appearance === "light";

  return (
    <label className={light ? "block space-y-1.5 text-sm font-semibold text-slate-700" : adminFormLabelClassName()}>
      <span className="flex items-center justify-between gap-3">
        <span>الرابط المختصر</span>
        {!readOnly ? (
          <button
            type="button"
            onClick={handleGenerate}
            className={`cursor-pointer rounded-full border px-3 py-1 font-en text-xs font-semibold transition ${light ? "border-[#c99a43] text-[#8a5b12] hover:bg-amber-50" : "border-[#D8B87A]/25 text-[#D8B87A] hover:bg-[#D8B87A]/10"}`}
          >
            توليد
          </button>
        ) : null}
      </span>
      <input
        id={id}
        ref={slugRef}
        name={name}
        value={slug}
        required={required}
        readOnly={readOnly}
        data-admin-slug-locked={readOnly ? "true" : "false"}
        dir="ltr"
        placeholder="main-menu"
        onChange={(event) => {
          if (readOnly) return;
          setIsManual(true);
          updateSlug(normalizeSlugInput(event.target.value), true);
        }}
        className={light
          ? `min-h-11 w-full rounded-xl border bg-white px-3 py-2.5 text-left font-en text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#b98724] focus:ring-2 focus:ring-[#b98724]/15 ${error ? "border-red-400" : "border-slate-200"}`
          : adminFormFieldClassName(error ? "border-red-400/40 text-left font-en" : "text-left font-en")}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "admin-slug-error" : "admin-slug-hint"}
      />
      {error ? (
        <span id="admin-slug-error" className={`mt-2 block text-xs font-semibold ${light ? "text-red-600" : "text-red-300"}`}>
          {error}
        </span>
      ) : (
        <span id="admin-slug-hint" className={light ? "mt-2 block text-xs leading-5 text-slate-500" : adminFormHintClassName()}>
          {readOnly
            ? "الرابط المختصر ثابت بعد أول حفظ لحماية الروابط والعلاقات الحالية."
            : "يُولَّد تلقائيًا من الاسم أثناء الكتابة، ويمكنك تعديله يدويًا قبل أول حفظ."}
        </span>
      )}
    </label>
  );
}
