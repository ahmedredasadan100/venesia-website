"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import AdminMediaPickerModal from "./AdminMediaPickerModal";

export type ImageDimensionHint = "hero" | "content";

const DIMENSION_HINTS: Record<ImageDimensionHint, string> = {
  hero: "الأبعاد الموصى بها: 1920 × 1080 px (16:9)",
  content: "الأبعاد الموصى بها: 1600 × 900 px (16:9)",
};

type AdminMediaImageFieldProps = {
  name: string;
  label: string;
  defaultValue?: string;
  dimensionHint?: ImageDimensionHint;
  helperText?: string;
  browseFolder?: string;
  variant?: "default" | "compact";
  showLabel?: boolean;
  onValueChange?: (value: string) => void;
  compactAspectClassName?: string;
  previewLoading?: "lazy" | "eager";
  appearance?: "dark" | "light";
  altName?: string;
  defaultAlt?: string;
  altLabel?: string;
  altHelperText?: string;
  onAltValueChange?: (value: string) => void;
  allowRemove?: boolean;
};

export default function AdminMediaImageField({
  name,
  label,
  defaultValue = "",
  dimensionHint,
  helperText,
  browseFolder = "images",
  variant = "default",
  showLabel = true,
  onValueChange,
  compactAspectClassName = "aspect-[4/3]",
  previewLoading,
  appearance = "dark",
  altName,
  defaultAlt = "",
  altLabel = "النص البديل للصورة",
  altHelperText,
  onAltValueChange,
  allowRemove = true,
}: AdminMediaImageFieldProps) {
  const [value, setValue] = useState(defaultValue);
  const [prevDefaultValue, setPrevDefaultValue] = useState(defaultValue);
  const [altValue, setAltValue] = useState(defaultAlt);
  const [prevDefaultAlt, setPrevDefaultAlt] = useState(defaultAlt);
  const [pickerOpen, setPickerOpen] = useState(false);
  const valueInputRef = useRef<HTMLInputElement>(null);
  const altInputRef = useRef<HTMLInputElement>(null);

  if (defaultValue !== prevDefaultValue) {
    setPrevDefaultValue(defaultValue);
    setValue(defaultValue);
  }
  if (defaultAlt !== prevDefaultAlt) {
    setPrevDefaultAlt(defaultAlt);
    setAltValue(defaultAlt);
  }

  function updateValue(next: string) {
    setValue(next);
    if (valueInputRef.current) {
      valueInputRef.current.value = next;
      valueInputRef.current.dispatchEvent(
        new Event("input", { bubbles: true }),
      );
    }
    if (!next && altInputRef.current) {
      setAltValue("");
      altInputRef.current.dispatchEvent(new Event("input", { bubbles: true }));
      onAltValueChange?.("");
    }
    onValueChange?.(next);
  }

  const light = appearance === "light";
  const compactFrameClass = light
    ? "border-slate-200 bg-slate-50"
    : "border-white/10 bg-black/30";
  const emptyCompactClass = light
    ? "text-slate-500 hover:bg-amber-50 hover:text-[#9a6815]"
    : "text-white/40 hover:text-[#D8B87A]";

  if (variant === "compact") {
    return (
      <div className="space-y-3" data-admin-media-image-field={name}>
        <input ref={valueInputRef} type="hidden" name={name} value={value} />

        <div className={`relative w-full overflow-hidden rounded-xl border ${compactFrameClass} ${compactAspectClassName}`}>
          {value ? (
            <>
              <Image
                src={value}
                alt=""
                fill
                className="object-cover"
                loading={previewLoading}
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-1 bg-gradient-to-t from-black/85 via-black/55 to-transparent p-2 pt-8">
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="cursor-pointer rounded-lg border border-[#D8B87A]/35 bg-[#D8B87A]/10 px-2.5 py-1 text-[11px] font-semibold text-[#D8B87A] hover:bg-[#D8B87A]/15"
                >
                  استبدال
                </button>
                {allowRemove ? (
                  <button
                    type="button"
                    onClick={() => updateValue("")}
                    className="cursor-pointer rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] text-white/60 hover:bg-white/10 hover:text-white"
                  >
                    إزالة
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className={`flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 text-xs transition ${emptyCompactClass}`}
            >
              <span className="text-lg leading-none">+</span>
              <span>اختيار صورة</span>
            </button>
          )}
        </div>

        {altName ? (
          <label className="block space-y-2">
            <span className={`text-xs font-semibold ${light ? "text-slate-700" : "text-white/55"}`}>{altLabel}</span>
            <input
              ref={altInputRef}
              name={altName}
              value={altValue}
              onChange={(event) => {
                setAltValue(event.target.value);
                onAltValueChange?.(event.target.value);
              }}
              className={`h-11 w-full rounded-xl border px-3 text-sm outline-none transition ${light ? "border-slate-200 bg-white text-slate-900 focus:border-[#b98724]" : "border-white/10 bg-black/25 text-white focus:border-[#D8B87A]/45"}`}
            />
            {altHelperText ? <span className={`block text-xs leading-6 ${light ? "text-slate-500" : "text-white/42"}`}>{altHelperText}</span> : null}
          </label>
        ) : null}

        <AdminMediaPickerModal
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={updateValue}
          initialFolder={browseFolder}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3" data-admin-media-image-field={name}>
      <input ref={valueInputRef} type="hidden" name={name} value={value} />

      <div className={`flex flex-wrap items-center gap-3 ${showLabel ? "justify-between" : "justify-end"}`}>
        {showLabel ? (
          <span className={`text-xs font-semibold ${light ? "text-slate-700" : "text-white/55"}`}>{label}</span>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="cursor-pointer rounded-2xl border border-[#D8B87A]/35 bg-[#D8B87A]/10 px-4 py-2 text-sm font-semibold text-[#D8B87A] hover:bg-[#D8B87A]/15"
          >
            {value ? "استبدال" : "اختيار صورة"}
          </button>
          {value && allowRemove ? (
            <button
              type="button"
              onClick={() => updateValue("")}
              className={`cursor-pointer rounded-2xl border px-4 py-2 text-sm ${light ? "border-red-200 text-red-600 hover:bg-red-50" : "border-white/10 text-white/55 hover:bg-white/5 hover:text-white"}`}
            >
              إزالة
            </button>
          ) : null}
        </div>
      </div>

      {dimensionHint ? (
        <p className={`text-xs leading-6 ${light ? "text-[#9a6815]" : "text-[#D8B87A]/65"}`}>{DIMENSION_HINTS[dimensionHint]}</p>
      ) : null}
      {helperText ? <p className={`text-xs leading-6 ${light ? "text-slate-500" : "text-white/42"}`}>{helperText}</p> : null}

      {value ? (
        <div className={`relative max-w-sm overflow-hidden rounded-2xl border ${light ? "border-slate-200 bg-slate-50" : "border-white/10 bg-black/25"}`}>
          <div className="relative h-44">
            <Image src={value} alt="" fill className="object-cover" loading={previewLoading} sizes="360px" />
          </div>
          <p className={`truncate px-3 py-2 font-mono text-[11px] ${light ? "text-slate-500" : "text-white/45"}`} dir="ltr">
            {value}
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className={`flex h-40 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed text-sm ${light ? "border-slate-300 bg-slate-50 text-slate-500 hover:border-[#b98724] hover:bg-amber-50" : "border-white/15 bg-[#05070B] text-white/45 hover:border-[#D8B87A]/30 hover:text-white/70"} ${showLabel ? "max-w-sm" : ""}`}
        >
          لا توجد صورة محددة
        </button>
      )}

      {altName ? (
        <label className="block max-w-sm space-y-2" data-admin-media-image-alt-field={altName}>
          <span className={`text-xs font-semibold ${light ? "text-slate-700" : "text-white/55"}`}>{altLabel}</span>
          <input
            ref={altInputRef}
            name={altName}
            value={altValue}
            onChange={(event) => {
              setAltValue(event.target.value);
              onAltValueChange?.(event.target.value);
            }}
            className={`h-11 w-full rounded-xl border px-3 text-sm outline-none transition ${light ? "border-slate-200 bg-white text-slate-900 focus:border-[#b98724]" : "border-white/10 bg-black/25 text-white focus:border-[#D8B87A]/45"}`}
          />
          {altHelperText ? <span className={`block text-xs leading-6 ${light ? "text-slate-500" : "text-white/42"}`}>{altHelperText}</span> : null}
        </label>
      ) : null}

      <AdminMediaPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={updateValue}
        initialFolder={browseFolder}
      />
    </div>
  );
}
