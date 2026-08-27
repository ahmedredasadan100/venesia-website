"use client";

import Image from "next/image";
import { useState } from "react";

import AdminMediaPickerModal from "./AdminMediaPickerModal";
import type { ImageDimensionHint } from "./AdminMediaImageField";

const DIMENSION_HINTS: Record<ImageDimensionHint, string> = {
  hero: "المقاس المستهدف بعد إعادة التحجيم: 1920 × 1080 px (16:9)",
  "hero-mobile": "المقاس المستهدف بعد إعادة التحجيم: 1080 × 1920 px (9:16)",
  content: "الأبعاد الموصى بها للصور المميزة/المحتوى: 1600 × 900 px (16:9)",
};

const DIMENSION_CARD_LABELS: Record<ImageDimensionHint, string> = {
  hero: "1920 × 1080 • 16:9",
  "hero-mobile": "1080 × 1920 • 9:16",
  content: "1600 × 900 • 16:9",
};

function parsePaths(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function resolveGalleryPaths(defaultPaths?: string[], defaultValue?: string) {
  return defaultPaths?.length ? defaultPaths : parsePaths(defaultValue ?? "");
}

type AdminMediaGalleryFieldProps = {
  name: string;
  label: string;
  defaultValue?: string;
  defaultPaths?: string[];
  helperText?: string;
  dimensionHint?: ImageDimensionHint;
  browseFolder?: string;
  density?: "default" | "compact";
};

export default function AdminMediaGalleryField({
  name,
  label,
  defaultValue = "",
  defaultPaths,
  helperText,
  dimensionHint = "hero",
  browseFolder = "images",
  density = "default",
}: AdminMediaGalleryFieldProps) {
  const defaultKey = `${defaultValue ?? ""}|${defaultPaths?.join("\n") ?? ""}`;
  const [paths, setPaths] = useState<string[]>(() => resolveGalleryPaths(defaultPaths, defaultValue));
  const [prevDefaultKey, setPrevDefaultKey] = useState(defaultKey);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const galleryCardHeightClass = density === "compact" ? "h-[167px]" : "min-h-[170px]";

  if (defaultKey !== prevDefaultKey) {
    setPrevDefaultKey(defaultKey);
    setPaths(resolveGalleryPaths(defaultPaths, defaultValue));
  }

  function openAdd() {
    setReplaceIndex(null);
    setPickerOpen(true);
  }

  function openReplace(index: number) {
    setReplaceIndex(index);
    setPickerOpen(true);
  }

  function handleSelect(path: string) {
    setPaths((current) => {
      if (replaceIndex === null) return [...current, path];
      return current.map((item, index) => (index === replaceIndex ? path : item));
    });
  }

  function removeAt(index: number) {
    setPaths((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function moveItem(index: number, direction: -1 | 1) {
    setPaths((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={paths.join("\n")} />

      <span className="block text-xs font-semibold text-white/55">{label}</span>

      <p className="text-xs leading-6 text-[#D8B87A]/65">{DIMENSION_HINTS[dimensionHint]}</p>
      {helperText ? <p className="text-xs leading-6 text-white/42">{helperText}</p> : null}

      <div
        className={`grid gap-3 ${
          density === "compact"
            ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
            : "sm:grid-cols-2"
        }`}
        data-admin-media-gallery-density={density}
      >
        {paths.map((path, index) => (
          <div
            key={`${path}-${index}`}
            className={`relative overflow-hidden rounded-2xl border border-white/10 bg-black/25 ${galleryCardHeightClass}`}
            data-admin-media-gallery-card="image"
          >
              <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => moveItem(index, -1)}
                  disabled={index === 0}
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/60 text-xs text-white/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  title={index === 0 ? "الصورة في أول الترتيب" : "تحريك الصورة لأعلى"}
                  aria-label={index === 0 ? "الصورة في أول الترتيب ولا يمكن تحريكها لأعلى" : "تحريك الصورة لأعلى"}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === paths.length - 1}
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/60 text-xs text-white/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  title={index === paths.length - 1 ? "الصورة في آخر الترتيب" : "تحريك الصورة لأسفل"}
                  aria-label={index === paths.length - 1 ? "الصورة في آخر الترتيب ولا يمكن تحريكها لأسفل" : "تحريك الصورة لأسفل"}
                >
                  ↓
                </button>
              </div>

              <button
                type="button"
                onClick={() => removeAt(index)}
                className="absolute right-2 top-2 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/60 text-white/80 hover:text-white"
                title="إزالة الصورة"
              >
                ×
              </button>

              <div className={`relative ${density === "compact" ? "h-24" : "h-28"}`}>
                <Image src={path} alt="" fill className="object-cover" sizes="200px" />
              </div>

              <div className="space-y-2 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-white/45" dir="ltr">
                    {path}
                  </p>
                  <button
                    type="button"
                    onClick={() => openReplace(index)}
                    className="cursor-pointer shrink-0 rounded-lg border border-[#D8B87A]/30 px-2.5 py-1 text-[11px] font-semibold text-[#D8B87A] hover:bg-[#D8B87A]/10"
                  >
                    استبدال
                  </button>
                </div>
                <p className="text-[10px] font-medium tracking-wide text-[#D8B87A]/65" dir="ltr">
                  {DIMENSION_CARD_LABELS[dimensionHint]}
                </p>
              </div>
          </div>
        ))}

        <button
          type="button"
          onClick={openAdd}
          aria-label={`إضافة صورة إلى ${label}`}
          className={`group flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-[#05070B] text-sm text-white/45 transition hover:border-[#D8B87A]/35 hover:bg-[#D8B87A]/[0.035] hover:text-white/75 ${galleryCardHeightClass}`}
          data-admin-media-gallery-card="add"
        >
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-full border border-white/15 text-2xl font-light leading-none text-white/50 transition group-hover:border-[#D8B87A]/35 group-hover:text-[#D8B87A]"
          >
            +
          </span>
          <span className="font-semibold">إضافة صورة</span>
        </button>
      </div>

      <AdminMediaPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
        initialFolder={browseFolder}
      />
    </div>
  );
}
