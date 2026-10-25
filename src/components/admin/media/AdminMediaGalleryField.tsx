"use client";
import {
  ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME,
} from "../../../lib/admin/admin-ui-styles";
import type { MediaSlotContract } from "../../../lib/media/media-slot-contract";
import AdminMediaSlotGuidance from "./AdminMediaSlotGuidance";
import { useAdminMediaReferenceState } from "./AdminDeletedMediaNotice";

import { useLayoutEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import {
  AdminFormError,
  useOptionalAdminFormRuntime,
} from "../ui/AdminFormRuntime";
import { AdminDataGridReorderHandle } from "../ui/AdminDataGrid";
import AdminCard from "../ui/AdminCard";
import { AdminModuleSectionHeader } from "../ui/AdminModuleTabs";
import AdminMediaImageField from "./AdminMediaImageField";
import AdminMediaPickerModal from "./AdminMediaPickerModal";



export type AdminMediaGalleryItem = {
  url: string;
  alt?: string | null;
  caption?: string | null;
};

export type AdminMediaGalleryControlledItem = {
  key: string;
  url: string;
  alt: string;
  caption: string;
};

type NormalizedGalleryItem = AdminMediaGalleryControlledItem;

type AdminMediaGalleryFieldBaseProps = {
  label: string;
  mediaSlot?: MediaSlotContract;
  showGuidance?: boolean;
  showReferenceLabel?: boolean;
  browseFolder?: string;
  density?: "default" | "compact";
  /** Desktop-only column opt-in; Mobile/Tablet and omitted density defaults stay unchanged. */
  desktopColumns?: 2 | 3 | 4;
  selectionMode?: "single" | "multiple";
  actionPresentation?: "default" | "bare" | "card";
  /** Explicit consumer adoption; omitted ports retain Hero/Tracking defaults. */
  presentation?: "default" | "panel";
  allowAdd?: boolean;
  allowReplace?: boolean;
  allowRemove?: boolean;
  allowReorder?: boolean;
  showAlt?: boolean;
  showCaption?: boolean;
  /** HTML5 drag plus the existing shared keyboard handle; arrows remain available. */
  enableDragDrop?: boolean;
  /** Explicit image-area drag opt-in; omitted consumers keep handle-only dragging. */
  dragFromImage?: boolean;
  disabled?: boolean;
  addLabel?: string;
  emptyLabel?: string;
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
  captionName?: string;
  /** Domain identity and persistence remain controlled by the existing consumer. */
  renderItemProjection?: (item: AdminMediaGalleryControlledItem, index: number) => ReactNode;
  onRequestAdd?: () => void;
  onRequestRemove?: (key: string) => void;
  errorName?: string;
  altErrorName?: string;
  defaultValue?: never;
  defaultPaths?: never;
  focusTargetId: string;
  altFocusTargetId: string;
} & (
  | {
      controlledItems: readonly AdminMediaGalleryControlledItem[];
      onItemsChange: (update: (current: AdminMediaGalleryControlledItem[]) => AdminMediaGalleryControlledItem[]) => void;
      defaultItems?: never;
    }
  | {
      defaultItems?: readonly AdminMediaGalleryItem[];
      controlledItems?: never;
      onItemsChange?: never;
    }
);

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
    mediaSlot,
    showGuidance = true,
    showReferenceLabel = false,
    browseFolder = "images",
    density = "default",
    desktopColumns = density === "compact" ? 4 : 2,
    selectionMode = "single",
    actionPresentation = "default",
    presentation = "default",
    allowAdd = true,
    allowReplace = true,
    allowRemove = true,
    allowReorder = true,
    showAlt = true,
    showCaption = true,
    enableDragDrop = false,
    dragFromImage = false,
    addLabel = "إضافة صورة",
    emptyLabel,
  } = props;
  const panel = presentation === "panel";
  const itemsMode = props.valueMode === "items";
  const controlled = props.valueMode === "items" && props.controlledItems !== undefined;
  const defaultKey = getDefaultKey(props);
  const [ownedItems, setOwnedItems] = useState<NormalizedGalleryItem[]>(() =>
    controlled ? [] : resolveDefaultItems(props),
  );
  const items = props.valueMode === "items" && props.controlledItems !== undefined ? props.controlledItems : ownedItems;
  const referenceState = useAdminMediaReferenceState(items.map(item => item.url));
  const nextItemKeyRef = useRef(items.length);
  const [prevDefaultKey, setPrevDefaultKey] = useState(defaultKey);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [projectionRevision, setProjectionRevision] = useState(0);
  const draggedItemKeyRef = useRef<string | null>(null);
  const [draggedItemKey, setDraggedItemKey] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const projectionSignalRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const runtime = useOptionalAdminFormRuntime();
  const formStatus = useFormStatus();
  const disabled = Boolean(props.disabled || runtime?.pending || formStatus.pending);
  const fieldErrors = runtime?.fieldErrors ?? {};
  const errorName = props.valueMode === "items" ? props.errorName ?? props.name : props.name;
  const altErrorName = props.valueMode === "items" ? props.altErrorName ?? props.altName : "";
  const hasUrlError = itemsMode && Boolean(fieldErrors[errorName]?.length);
  const hasAltError = itemsMode && Boolean(fieldErrors[altErrorName]?.length);
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
        : "min-h-[167px]"
      : itemsMode
        ? "min-h-[330px]"
        : "min-h-[170px]";

  if (!controlled && defaultKey !== prevDefaultKey) {
    const nextItems = resolveDefaultItems(props);
    setPrevDefaultKey(defaultKey);
    setOwnedItems(nextItems);
  }

  useLayoutEffect(() => {
    if (projectionRevision === 0) return;
    projectionSignalRef.current?.dispatchEvent(
      new Event("input", { bubbles: true }),
    );
  }, [projectionRevision]);

  function isLocked() {
    return disabled || Boolean(galleryRef.current?.closest("fieldset:disabled"));
  }

  function commitItems(
    update: (current: NormalizedGalleryItem[]) => NormalizedGalleryItem[],
  ) {
    if (isLocked()) return;
    if (props.valueMode === "items" && props.controlledItems !== undefined) {
      if (!props.onItemsChange) return;
      props.onItemsChange(update);
    } else {
      setOwnedItems(update);
    }
    setProjectionRevision((current) => current + 1);
  }

  function openAdd() {
    if (isLocked() || !allowAdd) return;
    if (props.valueMode === "items" && props.onRequestAdd) {
      props.onRequestAdd();
      return;
    }
    setReplaceIndex(null);
    setPickerOpen(true);
  }

  function openReplace(index: number) {
    if (isLocked() || !allowReplace) return;
    setReplaceIndex(index);
    setPickerOpen(true);
  }

  function handleSelect(path: string) {
    if (isLocked() || (replaceIndex === null ? !allowAdd : !allowReplace)) return;
    if (selectionMode === "multiple" && items.some((item, index) =>
      index !== replaceIndex && item.url === path)) return;
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

  function handleSelectMany(paths: string[]) {
    if (isLocked() || !allowAdd) return;
    const additions = [...new Set(paths)]
      .filter((url) => !items.some((item) => item.url === url))
      .map((url) => ({
        key: `gallery-item-added-${nextItemKeyRef.current++}`,
        url,
        alt: "",
        caption: "",
      }));
    if (!additions.length) return;
    commitItems((current) => [
      ...current,
      ...additions.filter((added) => !current.some((item) => item.url === added.url)),
    ]);
  }

  function removeAt(index: number) {
    if (isLocked() || !allowRemove) return;
    if (props.valueMode === "items" && props.onRequestRemove) {
      const item = items[index];
      if (item) props.onRequestRemove(item.key);
      return;
    }
    commitItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    moveItemTo(items[index]?.key, target);
  }

  function moveItemTo(key: string | undefined, target: number) {
    if (isLocked() || !allowReorder || !key) return;
    const index = items.findIndex((item) => item.key === key);
    if (index < 0 || target < 0 || target >= items.length || index === target) return;
    commitItems((current) => {
      const currentIndex = current.findIndex((item) => item.key === key);
      if (currentIndex < 0 || target >= current.length || currentIndex === target) return current;
      const next = [...current];
      const [moved] = next.splice(currentIndex, 1);
      next.splice(target, 0, moved!);
      return next;
    });
  }

  function endDrag() {
    draggedItemKeyRef.current = null;
    setDraggedItemKey(null);
    setDropTargetKey(null);
  }

  function startDrag(event: DragEvent<HTMLElement>, key: string) {
    if (isLocked() || !allowReorder || !enableDragDrop || items.length < 2) {
      event.preventDefault();
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    const interactive = target?.closest("button, input, textarea, select, a, label, summary");
    if (interactive && !interactive.hasAttribute("data-admin-grid-reorder-handle")) {
      event.preventDefault();
      return;
    }
    event.stopPropagation();
    draggedItemKeyRef.current = key;
    setDraggedItemKey(key);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", key);
  }

  function dragOver(event: DragEvent<HTMLElement>, targetKey?: string) {
    if (isLocked() || !allowReorder || !enableDragDrop || !draggedItemKeyRef.current) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetKey(targetKey && targetKey !== draggedItemKeyRef.current ? targetKey : null);
  }

  function dropOn(event: DragEvent<HTMLElement>, targetKey: string) {
    if (isLocked() || !allowReorder || !enableDragDrop || !draggedItemKeyRef.current) {
      endDrag();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const target = items.findIndex((item) => item.key === targetKey);
    moveItemTo(draggedItemKeyRef.current, target);
    endDrag();
  }

  function updateItem(
    index: number,
    field: "alt" | "caption",
    value: string,
  ) {
    if (isLocked()) return;
    if (props.valueMode === "items" && props.controlledItems !== undefined) {
      props.onItemsChange?.((current) => current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ));
      return;
    }
    setOwnedItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  return (
    <div
      ref={galleryRef}
      id={itemsMode ? "gallery-editor" : undefined}
      className="space-y-3 scroll-mt-24"
      data-admin-media-gallery-mode={itemsMode ? "items" : "paths"}
      data-admin-media-gallery-presentation={panel ? "panel" : undefined}
      data-admin-media-gallery-drag-drop={allowReorder && enableDragDrop ? "html5" : undefined}
      role={itemsMode ? "group" : undefined}
      aria-label={itemsMode ? label : undefined}
      aria-invalid={
        itemsMode && (hasUrlError || hasAltError) ? true : undefined
      }
      aria-describedby={
        itemsMode && (hasUrlError || hasAltError)
          ? [
              hasUrlError ? `${errorName}-error` : null,
              hasAltError ? `${altErrorName}-error` : null,
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

      {panel ? (
        <AdminModuleSectionHeader
          id={`${props.name}-gallery-heading`}
          sectionHeading={label}
          icon="media"
          sectionHeaderPresentation="premium"
          sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
        />
      ) : <span className="block text-xs font-semibold text-white/55">{label}</span>}
      {showGuidance && !panel ? <AdminMediaSlotGuidance slot={mediaSlot} /> : null}

      <div
        className={`grid gap-3 ${
          density === "compact"
            ? desktopColumns === 4
              ? "grid-cols-1 md:grid-cols-3 xl:grid-cols-4"
              : desktopColumns === 3
                ? "grid-cols-1 md:grid-cols-3"
              : "grid-cols-1 md:grid-cols-3 xl:grid-cols-2"
            : desktopColumns === 4
              ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
              : desktopColumns === 3
                ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
              : "grid-cols-1 md:grid-cols-2"
        }`}
        data-admin-media-gallery-density={density}
      >
        {items.map((item, index) => {
          const reorderControls = allowReorder ? (
            <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
              {enableDragDrop ? (
                <AdminDataGridReorderHandle
                  label={`الصورة ${index + 1} من ${label}`}
                  position={index}
                  count={items.length}
                  disabled={disabled}
                  tone={panel ? "gold" : undefined}
                  onMoveTo={(target) => moveItemTo(item.key, target)}
                  onDragStart={(event) => startDrag(event, item.key)}
                  onDragOver={(event) => dragOver(event, item.key)}
                  onDrop={(event) => dropOn(event, item.key)}
                  onDragEnd={endDrag}
                />
              ) : null}
              <button
                type="button"
                onClick={() => moveItem(index, -1)}
                disabled={disabled || index === 0}
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
                disabled={disabled || index === items.length - 1}
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
          ) : null;
          const cardContent = (
            <>
            {props.valueMode === "items" ? props.renderItemProjection?.(item, index) : null}
            <AdminMediaImageField
              name={props.name}
              label={`الصورة ${index + 1} من ${label}`}
              variant="gallery"
              value={item.url}
              referenceState={referenceState}
              renderValueInput={itemsMode}
              showLabel={false}
              mediaSlot={mediaSlot}
              showGuidance={panel && showGuidance}
              showReferenceLabel={panel || showReferenceLabel}
              dimensionsPresentation={panel ? "disclosure" : "default"}
              previewAspectRatio={4 / 3}
              previewFit="cover"
              enablePreview={false}
              actionPresentation={actionPresentation}
              allowReplace={allowReplace}
              allowRemove={allowRemove}
              onReplace={() => openReplace(index)}
              onRemove={() => removeAt(index)}
              pickerExpanded={pickerOpen && replaceIndex === index}
              focusTargetId={itemsMode && index === 0 ? props.focusTargetId : undefined}
              ariaInvalid={itemsMode && index === 0 && hasUrlError}
              ariaDescribedBy={itemsMode && index === 0 && hasUrlError ? `${errorName}-error` : undefined}
              actionAttributes={{
                replace: {
                  id: itemsMode && index === 0 ? props.focusTargetId : undefined,
                  "aria-describedby": itemsMode && index === 0 && hasUrlError ? `${errorName}-error` : undefined,
                  disabled,
                  "data-admin-media-gallery-action": "replace",
                },
                remove: {
                  "aria-label": `إزالة الصورة ${index + 1} من ${label}`,
                  disabled,
                  "data-admin-media-gallery-action": "remove",
                },
              }}
              altName={props.valueMode === "items" ? props.altName : undefined}
              altValue={item.alt}
              altLabel="النص البديل (alt)"
              altPlaceholder="وصف مختصر للصورة"
              showAlt={showAlt}
              altRows={1}
              showAltCounter={panel}
              altId={itemsMode && index === altErrorIndex ? props.altFocusTargetId : undefined}
              altInvalid={(index === altErrorIndex && hasAltError) || undefined}
              altDescribedBy={itemsMode && index === altErrorIndex && hasAltError ? `${altErrorName}-error` : undefined}
              onAltValueChange={(value) => updateItem(index, "alt", value)}
              captionName={props.valueMode === "items" ? props.captionName : undefined}
              captionValue={item.caption}
              captionLabel="التعليق (caption)"
              showCaption={showCaption}
              captionRows={1}
              showCaptionCounter={panel}
              onCaptionValueChange={(value) => updateItem(index, "caption", value)}
              metadataPresentation={panel ? "panel" : "gallery"}
              metadataClassName={!panel ? "space-y-3 pt-1" : undefined}
              previewOverlay={reorderControls}
              previewSurfaceProps={allowReorder && enableDragDrop && dragFromImage ? {
                draggable: !disabled && items.length > 1,
                onDragStart: (event) => startDrag(event, item.key),
                onDragEnd: endDrag,
                "data-admin-media-gallery-drag-surface": "",
              } : undefined}
            />
            </>
          );
          return (
            <div
              key={item.key}
              className={`${panel ? "min-w-0" : `relative overflow-hidden rounded-2xl border border-white/10 bg-black/25 ${galleryCardHeightClass}`} ${draggedItemKey === item.key ? "opacity-55" : ""} ${dropTargetKey === item.key ? "rounded-2xl ring-1 ring-[#D8B87A]/65" : ""}`}
              data-admin-media-gallery-card="image"
              data-admin-media-gallery-index={index}
              data-gallery-item-key={item.key}
              data-gallery-item-dragging={draggedItemKey === item.key || undefined}
              data-gallery-item-drop-target={dropTargetKey === item.key || undefined}
              onDragOver={(event) => dragOver(event, item.key)}
              onDragLeave={(event) => {
                if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
                setDropTargetKey((current) => current === item.key ? null : current);
              }}
              onDrop={(event) => dropOn(event, item.key)}
            >
              {panel ? (
                <AdminCard presentation="premium" className="h-full min-w-0 overflow-hidden">
                  {cardContent}
                </AdminCard>
              ) : cardContent}
            </div>
          );
        })}

        {allowAdd ? <button
          id={
            itemsMode && items.length === 0 ? props.focusTargetId : undefined
          }
          type="button"
          disabled={disabled}
          onClick={openAdd}
          aria-label={`إضافة صورة إلى ${label}`}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen && replaceIndex === null}
          aria-describedby={
            itemsMode && items.length === 0 && hasUrlError
              ? `${errorName}-error`
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
          <span className="font-semibold">{addLabel}</span>
        </button> : null}
      </div>

      {!items.length && emptyLabel ? <p className="text-sm text-white/55">{emptyLabel}</p> : null}

      {itemsMode ? (
        <div className="space-y-2">
          <AdminFormError name={errorName} />
          <AdminFormError name={altErrorName} />
        </div>
      ) : null}

      <AdminMediaPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
        multiple={selectionMode === "multiple" && replaceIndex === null}
        onSelectMany={handleSelectMany}
        excludedPaths={selectionMode === "multiple"
          ? items.filter((_, index) => index !== replaceIndex).map((item) => item.url)
          : undefined}
        initialFolder={browseFolder}
      />
    </div>
  );
}
