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
}: AdminMediaImageFieldProps) {
  const [value, setValue] = useState(defaultValue);
  const [prevDefaultValue, setPrevDefaultValue] = useState(defaultValue);
  const [pickerOpen, setPickerOpen] = useState(false);
  const valueInputRef = useRef<HTMLInputElement>(null);

  if (defaultValue !== prevDefaultValue) {
    setPrevDefaultValue(defaultValue);
    setValue(defaultValue);
  }

  function updateValue(next: string) {
    setValue(next);
    if (valueInputRef.current) {
      valueInputRef.current.value = next;
      valueInputRef.current.dispatchEvent(
        new Event("input", { bubbles: true }),
      );
    }
    onValueChange?.(next);
  }

  if (variant === "compact") {
    return (
      <>
        <input ref={valueInputRef} type="hidden" name={name} value={value} />

        <div className={`relative w-full overflow-hidden rounded-xl border border-white/10 bg-black/30 ${compactAspectClassName}`}>
          {value ? (
            <>
              <Image
                src={value}
                alt=""
                fill
                className="object-cover"
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
                <button
                  type="button"
                  onClick={() => updateValue("")}
                  className="cursor-pointer rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] text-white/60 hover:bg-white/10 hover:text-white"
                >
                  إزالة
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 text-xs text-white/40 transition hover:text-[#D8B87A]"
            >
              <span className="text-lg leading-none">+</span>
              <span>اختيار صورة</span>
            </button>
          )}
        </div>

        <AdminMediaPickerModal
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={updateValue}
          initialFolder={browseFolder}
          replacePath={value || null}
        />
      </>
    );
  }

  return (
    <div className="space-y-3">
      <input ref={valueInputRef} type="hidden" name={name} value={value} />

      {showLabel ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-semibold text-white/55">{label}</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="cursor-pointer rounded-2xl border border-[#D8B87A]/35 bg-[#D8B87A]/10 px-4 py-2 text-sm font-semibold text-[#D8B87A] hover:bg-[#D8B87A]/15"
            >
              {value ? "استبدال" : "اختيار صورة"}
            </button>
            {value ? (
              <button
                type="button"
                onClick={() => updateValue("")}
                className="cursor-pointer rounded-2xl border border-white/10 px-4 py-2 text-sm text-white/55 hover:bg-white/5 hover:text-white"
              >
                إزالة
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {dimensionHint ? (
        <p className="text-xs leading-6 text-[#D8B87A]/65">{DIMENSION_HINTS[dimensionHint]}</p>
      ) : null}
      {helperText ? <p className="text-xs leading-6 text-white/42">{helperText}</p> : null}

      {value ? (
        <div className="relative max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-black/25">
          <div className="relative h-44">
            <Image src={value} alt="" fill className="object-cover" sizes="360px" />
          </div>
          <p className="truncate px-3 py-2 font-mono text-[11px] text-white/45" dir="ltr">
            {value}
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className={`flex h-40 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-[#05070B] text-sm text-white/45 hover:border-[#D8B87A]/30 hover:text-white/70 ${showLabel ? "max-w-sm" : ""}`}
        >
          لا توجد صورة محددة
        </button>
      )}

      <AdminMediaPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={updateValue}
        initialFolder={browseFolder}
        replacePath={value || null}
      />
    </div>
  );
}
