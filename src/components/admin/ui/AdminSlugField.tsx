"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { normalizeSlugInput, slugifyFromTitle } from "../../../lib/admin/slug";
import {
  adminFormFieldClassName,
  adminFormHintClassName,
  adminFormLabelClassName,
} from "../VenesiaModal";

type AdminSlugFieldProps = {
  name?: string;
  sourceInputName: string;
  value?: string;
  error?: string | null;
  required?: boolean;
  onChange?: (slug: string) => void;
};

export default function AdminSlugField({
  name = "slug",
  sourceInputName,
  value: controlledValue,
  error = null,
  required = true,
  onChange,
}: AdminSlugFieldProps) {
  const [internalSlug, setInternalSlug] = useState(controlledValue ?? "");
  const [isManual, setIsManual] = useState(Boolean(controlledValue));
  const slugRef = useRef<HTMLInputElement>(null);

  const slug = controlledValue ?? internalSlug;

  const updateSlug = useCallback((next: string) => {
    if (controlledValue === undefined) {
      setInternalSlug(next);
    }
    onChange?.(next);
  }, [controlledValue, onChange]);

  useEffect(() => {
    const form = slugRef.current?.form;
    const sourceInput = form?.elements.namedItem(sourceInputName) as HTMLInputElement | null;
    if (!sourceInput) return;

    function syncFromSource() {
      if (isManual) return;
      updateSlug(slugifyFromTitle(sourceInput?.value ?? ""));
    }

    sourceInput.addEventListener("input", syncFromSource);
    syncFromSource();

    return () => sourceInput.removeEventListener("input", syncFromSource);
  }, [isManual, sourceInputName, updateSlug]);

  function handleGenerate() {
    const form = slugRef.current?.form;
    const sourceInput = form?.elements.namedItem(sourceInputName) as HTMLInputElement | null;
    setIsManual(false);
    updateSlug(slugifyFromTitle(sourceInput?.value ?? ""));
  }

  return (
    <label className={adminFormLabelClassName()}>
      <span className="flex items-center justify-between gap-3">
        <span>Slug</span>
        <button
          type="button"
          onClick={handleGenerate}
          className="cursor-pointer rounded-full border border-[#D8B87A]/25 px-3 py-1 font-en text-xs font-semibold text-[#D8B87A] transition hover:bg-[#D8B87A]/10"
        >
          Generate
        </button>
      </span>
      <input
        ref={slugRef}
        name={name}
        value={slug}
        required={required}
        dir="ltr"
        placeholder="main-menu"
        onChange={(event) => {
          setIsManual(true);
          updateSlug(normalizeSlugInput(event.target.value));
        }}
        className={adminFormFieldClassName(error ? "border-red-400/40 text-left font-en" : "text-left font-en")}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "admin-slug-error" : "admin-slug-hint"}
      />
      {error ? (
        <span id="admin-slug-error" className="mt-2 block text-xs font-semibold text-red-300">
          {error}
        </span>
      ) : (
        <span id="admin-slug-hint" className={adminFormHintClassName()}>
          يُولَّد تلقائيًا من الاسم أثناء الكتابة، ويمكنك تعديله يدويًا في أي وقت.
        </span>
      )}
    </label>
  );
}
