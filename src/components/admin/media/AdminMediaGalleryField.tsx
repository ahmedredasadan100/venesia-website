"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";

import {
  AdminFormError,
  useOptionalAdminFormRuntime,
} from "../ui/AdminFormRuntime";
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

export type AdminMediaGalleryItem = {
  url: string;
  alt?: string | null;
  caption?: string | null;
};

type NormalizedGalleryItem = {
  key: string;
  url: string;
  alt: string;
  caption: string;
};

type AdminMediaGalleryFieldBaseProps = {
  label: string;
  helperText?: string;
  dimensionHint?: ImageDimensionHint;
  browseFolder?: string;
  density?: "default" | "compact";
};

type AdminMediaGalleryPathsProps = AdminMediaGalleryFieldBaseProps & {
  valueMode?: "paths";
  name: string;
  defaultValue?: string;
  defaultPaths?: string[];
  defaultItems?: never;
  altName?: never;
  captionName?: never;
  focusTargetId?: never;
  altFocusTargetId?: never;
};

type AdminMediaGalleryItemsProps = AdminMediaGalleryFieldBaseProps & {
  valueMode: "items";
  name: string;
  altName: string;
  captionName: string;
  defaultItems?: readonly AdminMediaGalleryItem[];
  defaultValue?: never;
  defaultPaths?: never;
  focusTargetId: string;
  altFocusTargetId: string;
};

export type AdminMediaGalleryFieldProps =
  | AdminMediaGalleryPathsProps
  | AdminMediaGalleryItemsProps;

function parsePaths(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeItems(items: readonly AdminMediaGalleryItem[]) {
  return items.map((item, index) => ({
    key: `gallery-item-${index}-${item.url}`,
    url: item.url,
    alt: item.alt ?? "",
    caption: item.caption ?? "",
  }));
}

function resolveDefaultItems(
  props: AdminMediaGalleryFieldProps,
): NormalizedGalleryItem[] {
  if (props.valueMode === "items") {
    return normalizeItems(props.defaultItems ?? []);
  }
  const paths = props.defaultPaths?.length
    ? props.defaultPaths
    : parsePaths(props.defaultValue ?? "");
  return paths.map((url, index) => ({
    key: `gallery-item-${index}-${url}`,
    url,
    alt: "",
    caption: "",
  }));
}

function getDefaultKey(props: AdminMediaGalleryFieldProps) {
  if (props.valueMode === "items") {
    return JSON.stringify(normalizeItems(props.defaultItems ?? []));
  }
  return `${props.defaultValue ?? ""}|${props.defaultPaths?.join("\n") ?? ""}`;
}

export default function AdminMediaGalleryField(
  props: AdminMediaGalleryFieldProps,
) {
  const {
    label,
    helperText,
    dimensionHint = "hero",
    browseFolder = "images",
    density = "default",
  } = props;
  const itemsMode = props.valueMode === "items";
  const defaultKey = getDefaultKey(props);
  const [items, setItems] = useState<NormalizedGalleryItem[]>(() =>
    resolveDefaultItems(props),
  );
  const nextItemKeyRef = useRef(items.length);
  const [prevDefaultKey, setPrevDefaultKey] = useState(defaultKey);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [projectionRevision, setProjectionRevision] = useState(0);
  const projectionSignalRef = useRef<HTMLInputElement>(null);
  const fieldErrors = useOptionalAdminFormRuntime()?.fieldErrors ?? {};
  const altName = props.valueMode === "items" ? props.altName : "";
  const hasUrlError = itemsMode && Boolean(fieldErrors[props.name]?.length);
  const hasAltError = itemsMode && Boolean(fieldErrors[altName]?.length);
  const altErrorIndex = Math.max(
    0,
    items.findIndex(
      (item) => item.url.trim().length > 0 && !item.alt.trim(),
    ),
  );
  const galleryCardHeightClass =
    density === "compact"
      ? itemsMode
        ? "min-h-[315px]"
        : "h-[167px]"
      : itemsMode
        ? "min-h-[330px]"
        : "min-h-[170px]";

  if (defaultKey !== prevDefaultKey) {
    const nextItems = resolveDefaultItems(props);
    setPrevDefaultKey(defaultKey);
    setItems(nextItems);
  }

  useLayoutEffect(() => {
    if (projectionRevision === 0) return;
    projectionSignalRef.current?.dispatchEvent(
      new Event("input", { bubbles: true }),
    );
  }, [projectionRevision]);

  function commitItems(
    update: (current: NormalizedGalleryItem[]) => NormalizedGalleryItem[],
  ) {
    setItems(update);
    setProjectionRevision((current) => current + 1);
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
    const addedKey =
      replaceIndex === null
        ? `gallery-item-added-${nextItemKeyRef.current}`
        : null;
    if (addedKey) nextItemKeyRef.current += 1;

    commitItems((current) => {
      if (replaceIndex === null) {
        return [
          ...current,
          { key: addedKey!, url: path, alt: "", caption: "" },
        ];
      }
      return current.map((item, index) =>
        index === replaceIndex ? { ...item, url: path } : item,
      );
    });
  }

  function removeAt(index: number) {
    commitItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    commitItems((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function updateItem(
    index: number,
    field: "alt" | "caption",
    value: string,
  ) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  return (
    <div
      id={itemsMode ? "gallery-editor" : undefined}
      className="space-y-3 scroll-mt-24"
      data-admin-media-gallery-mode={itemsMode ? "items" : "paths"}
      role={itemsMode ? "group" : undefined}
      aria-label={itemsMode ? label : undefined}
      aria-invalid={
        itemsMode && (hasUrlError || hasAltError) ? true : undefined
      }
      aria-describedby={
        itemsMode && (hasUrlError || hasAltError)
          ? [
              hasUrlError ? `${props.name}-error` : null,
              hasAltError ? `${altName}-error` : null,
            ]
              .filter(Boolean)
              .join(" ")
          : undefined
      }
    >
      {itemsMode ? (
        <input
          ref={projectionSignalRef}
          type="hidden"
          data-admin-media-gallery-projection=""
        />
      ) : (
        <input
          ref={projectionSignalRef}
          type="hidden"
          name={props.name}
          value={items.map((item) => item.url).join("\n")}
        />
      )}

      <span className="block text-xs font-semibold text-white/55">{label}</span>
      <p className="text-xs leading-6 text-[#D8B87A]/65">
        {DIMENSION_HINTS[dimensionHint]}
      </p>
      {helperText ? (
        <p className="text-xs leading-6 text-white/42">{helperText}</p>
      ) : null}

      <div
        className={`grid gap-3 ${
          density === "compact"
            ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
            : "sm:grid-cols-2"
        }`}
        data-admin-media-gallery-density={density}
      >
        {items.map((item, index) => (
          <div
            key={item.key}
            className={`relative overflow-hidden rounded-2xl border border-white/10 bg-black/25 ${galleryCardHeightClass}`}
            data-admin-media-gallery-card="image"
            data-admin-media-gallery-index={index}
          >
            {itemsMode ? (
              <input type="hidden" name={props.name} value={item.url} />
            ) : null}

            <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
              <button
                type="button"
                onClick={() => moveItem(index, -1)}
                disabled={index === 0}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/60 text-xs text-white/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                title={
                  index === 0
                    ? "الصورة في أول الترتيب"
                    : "تحريك الصورة لأعلى"
                }
                aria-label={
                  index === 0
                    ? "الصورة في أول الترتيب ولا يمكن تحريكها لأعلى"
                    : "تحريك الصورة لأعلى"
                }
                data-admin-media-gallery-action="move-up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveItem(index, 1)}
                disabled={index === items.length - 1}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/60 text-xs text-white/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                title={
                  index === items.length - 1
                    ? "الصورة في آخر الترتيب"
                    : "تحريك الصورة لأسفل"
                }
                aria-label={
                  index === items.length - 1
                    ? "الصورة في آخر الترتيب ولا يمكن تحريكها لأسفل"
                    : "تحريك الصورة لأسفل"
                }
                data-admin-media-gallery-action="move-down"
              >
                ↓
              </button>
            </div>

            <button
              type="button"
              onClick={() => removeAt(index)}
              className="absolute right-2 top-2 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/60 text-white/80 hover:text-white"
              title="إزالة الصورة"
              aria-label={`إزالة الصورة ${index + 1} من ${label}`}
              data-admin-media-gallery-action="remove"
            >
              ×
            </button>

            <div
              className={`relative ${density === "compact" ? "h-24" : "h-28"}`}
            >
              {item.url ? (
                <Image
                  src={item.url}
                  alt={itemsMode ? item.alt : ""}
                  fill
                  className="object-cover"
                  sizes="200px"
                />
              ) : (
                <div className="grid h-full place-items-center text-xs text-white/35">
                  لم تُحدّد صورة
                </div>
              )}
            </div>

            <div className="space-y-2 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p
                  className="min-w-0 flex-1 truncate font-mono text-[11px] text-white/45"
                  dir="ltr"
                >
                  {item.url}
                </p>
                <button
                  id={
                    itemsMode && index === 0
                      ? props.focusTargetId
                      : undefined
                  }
                  type="button"
                  onClick={() => openReplace(index)}
                  aria-haspopup="dialog"
                  aria-expanded={pickerOpen && replaceIndex === index}
                  aria-describedby={
                    itemsMode && index === 0 && hasUrlError
                      ? `${props.name}-error`
                      : undefined
                  }
                  className="cursor-pointer shrink-0 rounded-lg border border-[#D8B87A]/30 px-2.5 py-1 text-[11px] font-semibold text-[#D8B87A] hover:bg-[#D8B87A]/10"
                  data-admin-media-gallery-action="replace"
                >
                  استبدال
                </button>
              </div>
              <p
                className="text-[10px] font-medium tracking-wide text-[#D8B87A]/65"
                dir="ltr"
              >
                {DIMENSION_CARD_LABELS[dimensionHint]}
              </p>

              {itemsMode ? (
                <div className="space-y-3 pt-1">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-white/60">
                      النص البديل (alt)
                    </span>
                    <input
                      id={
                        index === altErrorIndex
                          ? props.altFocusTargetId
                          : undefined
                      }
                      name={props.altName}
                      value={item.alt}
                      onChange={(event) =>
                        updateItem(index, "alt", event.target.value)
                      }
                      placeholder="وصف مختصر للصورة"
                      aria-invalid={
                        (index === altErrorIndex && hasAltError) || undefined
                      }
                      aria-describedby={
                        index === altErrorIndex && hasAltError
                          ? `${props.altName}-error`
                          : undefined
                      }
                      className="h-10 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-white/60">
                      التعليق (caption)
                    </span>
                    <input
                      name={props.captionName}
                      value={item.caption}
                      onChange={(event) =>
                        updateItem(index, "caption", event.target.value)
                      }
                      placeholder="تعليق اختياري"
                      className="h-10 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
                    />
                  </label>
                </div>
              ) : null}
            </div>
          </div>
        ))}

        <button
          id={
            itemsMode && items.length === 0 ? props.focusTargetId : undefined
          }
          type="button"
          onClick={openAdd}
          aria-label={`إضافة صورة إلى ${label}`}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen && replaceIndex === null}
          aria-describedby={
            itemsMode && items.length === 0 && hasUrlError
              ? `${props.name}-error`
              : undefined
          }
          className={`group flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-[#05070B] text-sm text-white/45 transition hover:border-[#D8B87A]/35 hover:bg-[#D8B87A]/[0.035] hover:text-white/75 ${galleryCardHeightClass}`}
          data-admin-media-gallery-card="add"
          data-admin-media-gallery-action="add"
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

      {itemsMode ? (
        <div className="space-y-2">
          <AdminFormError name={props.name} />
          <AdminFormError name={props.altName} />
        </div>
      ) : null}

      <AdminMediaPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
        initialFolder={browseFolder}
      />
    </div>
  );
}
