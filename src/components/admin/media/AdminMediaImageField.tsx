"use client";
import type { MediaSlotContract } from "../../../lib/media/media-slot-contract";
import { ADMIN_FORM } from "../../../lib/admin/admin-ui-styles";
import AdminMediaSlotGuidance from "./AdminMediaSlotGuidance";
import { useAdminMediaReferenceState, AdminMediaPreview, AdminMediaReferenceLabel, AdminMediaOriginalDimensions, adminMediaPresentationState } from "./AdminDeletedMediaNotice";

import Image from "next/image";
import { useId, useRef, useState, type ComponentProps } from "react";

import AdminMediaPickerModal from "./AdminMediaPickerModal";
import VenesiaModal from "../VenesiaModal";
import AdminActionButton from "../ui/AdminActionButton";
import { AdminDataGridActionIcon } from "../ui/AdminDataGrid";

type AdminMediaImageActionAttributes = Omit<
  ComponentProps<typeof AdminActionButton>,
  "children" | "size" | "variant" | "className" | "href" | "form" | "type"
> & { [attribute: `data-${string}`]: string | undefined };

export function AdminMediaImageActions({
  replace,
  remove,
}: {
  replace: AdminMediaImageActionAttributes;
  remove?: AdminMediaImageActionAttributes;
}) {
  return (
    <div className="absolute bottom-3 left-3 flex gap-2 rounded-2xl bg-[#080B10]/95 p-1" data-admin-media-image-actions>
      <AdminActionButton {...replace} size="icon" variant="gold">
        <AdminDataGridActionIcon action="restore" size="md" />
      </AdminActionButton>
      {remove ? (
        <AdminActionButton {...remove} size="icon" variant="danger">
          <AdminDataGridActionIcon action="delete" size="md" />
        </AdminActionButton>
      ) : null}
    </div>
  );
}

type AdminMediaImageFieldProps = {
  name: string;
  label: string;
  defaultValue?: string;
  mediaSlot?: MediaSlotContract;
  showGuidance?: boolean;
  showReferenceLabel?: boolean;
  browseFolder?: string;
  variant?: "default" | "compact" | "card";
  showLabel?: boolean;
  onValueChange?: (value: string) => void;
  compactAspectClassName?: string;
  previewLoading?: "lazy" | "eager";
  appearance?: "dark" | "light";
  altName?: string;
  defaultAlt?: string;
  altLabel?: string;
  onAltValueChange?: (value: string) => void;
  allowRemove?: boolean;
  focusTargetId?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
};

export default function AdminMediaImageField({
  name,
  label,
  defaultValue = "",
  mediaSlot,
  showGuidance = true,
  showReferenceLabel = false,
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
  onAltValueChange,
  allowRemove = true,
  focusTargetId,
  ariaInvalid = false,
  ariaDescribedBy,
}: AdminMediaImageFieldProps) {
  const generatedFocusTargetId = useId();
  const triggerId = focusTargetId ?? generatedFocusTargetId;
  const [value, setValue] = useState(defaultValue);
  const [prevDefaultValue, setPrevDefaultValue] = useState(defaultValue);
  const [altValue, setAltValue] = useState(defaultAlt);
  const [prevDefaultAlt, setPrevDefaultAlt] = useState(defaultAlt);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loadedDimensions, setLoadedDimensions] = useState<{ value: string; width: number; height: number } | null>(null);
  const referenceState = useAdminMediaReferenceState([value]);
  const presentation = adminMediaPresentationState(value, referenceState);
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
      <div
        className="space-y-3"
        data-admin-media-image-field={name}
        role={focusTargetId ? "group" : undefined}
        aria-invalid={focusTargetId ? ariaInvalid || undefined : undefined}
        aria-describedby={focusTargetId ? ariaDescribedBy : undefined}
      >
        <input ref={valueInputRef} type="hidden" name={name} value={value} />

        {showGuidance ? <AdminMediaSlotGuidance slot={mediaSlot} /> : null}

        <div className={`relative w-full overflow-hidden rounded-xl border ${compactFrameClass} ${compactAspectClassName}`}>
          {value ? (
            <>
              <AdminMediaPreview value={value} state={referenceState} controlsOverlay><Image
                src={value}
                alt=""
                fill
                className="object-cover"
                loading={previewLoading}
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              /></AdminMediaPreview>
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-1 bg-gradient-to-t from-black/85 via-black/55 to-transparent p-2 pt-8">
                <button
                  id={triggerId}
                  type="button"
                  aria-label={focusTargetId ? label : undefined}
                  aria-haspopup={focusTargetId ? "dialog" : undefined}
                  aria-expanded={focusTargetId ? pickerOpen : undefined}
                  aria-describedby={ariaDescribedBy}
                  onClick={() => setPickerOpen(true)}
                  className="cursor-pointer rounded-lg border border-[#D8B87A]/35 bg-[#D8B87A]/10 px-2.5 py-1 text-[11px] font-semibold text-[#D8B87A] hover:bg-[#D8B87A]/15"
                >
                  {presentation === "deleted" || presentation === "missing" ? "اختيار بديل" : "استبدال"}
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
              id={triggerId}
              type="button"
              aria-label={focusTargetId ? label : undefined}
              aria-haspopup={focusTargetId ? "dialog" : undefined}
              aria-expanded={focusTargetId ? pickerOpen : undefined}
              aria-describedby={ariaDescribedBy}
              onClick={() => setPickerOpen(true)}
              className={`flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 text-xs transition ${emptyCompactClass}`}
            >
              <span className="text-lg leading-none">+</span>
              <span>اختيار صورة</span>
            </button>
          )}
        </div>

        <AdminMediaOriginalDimensions value={value} state={referenceState} />

        {altName ? (
          <label className={ADMIN_FORM.labelStack}>
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

  const cardPresentation = variant === "card";
  const original = referenceState?.originals.find((item) => item.value === value
    && Number.isFinite(item.width) && Number.isFinite(item.height)
    && (item.width ?? 0) > 0 && (item.height ?? 0) > 0);
  const dimensions = original?.width && original?.height
    ? original
    : loadedDimensions?.value === value ? loadedDimensions : null;
  const aspectRatio = dimensions?.width && dimensions?.height
    && Number.isFinite(dimensions.width) && Number.isFinite(dimensions.height)
    && dimensions.width > 0 && dimensions.height > 0
    ? dimensions.width / dimensions.height : 16 / 9;
  const replaceLabel = presentation === "deleted" || presentation === "missing" ? "اختيار بديل" : "استبدال";
  const selectedActions = cardPresentation ? (
    <AdminMediaImageActions
      replace={{
        id: triggerId,
        title: replaceLabel,
        "aria-label": focusTargetId ? label : replaceLabel,
        "aria-haspopup": "dialog",
        "aria-expanded": pickerOpen,
        "aria-describedby": ariaDescribedBy,
        onClick: () => setPickerOpen(true),
      }}
      remove={allowRemove ? {
        title: "إزالة",
        "aria-label": "إزالة",
        onClick: () => updateValue(""),
      } : undefined}
    />
  ) : (
    <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-2 bg-gradient-to-t from-black/90 via-black/65 to-transparent p-3 pt-10">
      <button
        id={triggerId}
        type="button"
        aria-label={focusTargetId ? label : undefined}
        aria-haspopup={focusTargetId ? "dialog" : undefined}
        aria-expanded={focusTargetId ? pickerOpen : undefined}
        aria-describedby={ariaDescribedBy}
        onClick={() => setPickerOpen(true)}
        className="cursor-pointer rounded-lg border border-[#D8B87A]/35 bg-black/45 px-3 py-1.5 text-xs font-semibold text-[#F2D99B] backdrop-blur-sm hover:bg-[#D8B87A]/15"
      >
        {presentation === "deleted" || presentation === "missing" ? "اختيار بديل" : "استبدال"}
      </button>
      {allowRemove ? (
        <button
          type="button"
          onClick={() => updateValue("")}
          className="cursor-pointer rounded-lg border border-white/15 bg-black/45 px-3 py-1.5 text-xs text-white/70 backdrop-blur-sm hover:bg-white/10 hover:text-white"
        >
          إزالة
        </button>
      ) : null}
    </div>
  );

  return (
    <div
      className={cardPresentation ? "flex min-w-0 flex-1 flex-col gap-3" : "space-y-3"}
      data-admin-media-image-field={name}
      role={focusTargetId ? "group" : undefined}
      aria-invalid={focusTargetId ? ariaInvalid || undefined : undefined}
      aria-describedby={focusTargetId ? ariaDescribedBy : undefined}
    >
      <input ref={valueInputRef} type="hidden" name={name} value={value} />


      {showLabel ? (
        <span className={`block text-xs font-semibold ${light ? "text-slate-700" : "text-white/55"}`}>{label}</span>
      ) : null}

      {showGuidance ? <AdminMediaSlotGuidance slot={mediaSlot} /> : null}

      {value ? (
        <div
          className={cardPresentation ? "flex w-full flex-1 flex-col items-center" : `relative w-full max-w-sm overflow-hidden rounded-2xl border ${light ? "border-slate-200 bg-slate-50" : "border-white/10 bg-black/25"}`}
          data-admin-media-image-card="selected"
        >
          <div
            className={cardPresentation ? `relative w-full min-h-20 min-w-[min(100%,8rem)] max-h-[min(40vh,24rem)] shrink-0 overflow-hidden rounded-2xl border ${light ? "border-slate-200 bg-slate-50" : "border-white/10 bg-black/25"}` : "relative h-44"}
            style={cardPresentation ? { aspectRatio, maxWidth: `min(100%, calc(min(40vh, 24rem) * ${aspectRatio}))` } : undefined}
            data-admin-media-image-frame
          >
            <AdminMediaPreview value={value} state={referenceState} controlsOverlay>
              <button
                type="button"
                aria-label={`معاينة ${label} بالحجم الكبير`}
                aria-haspopup="dialog"
                aria-expanded={previewOpen}
                onClick={() => setPreviewOpen(true)}
                className="absolute inset-0 cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[#D8B87A]"
                data-admin-media-image-preview-trigger
              >
                <Image src={value} alt="" fill className={cardPresentation ? "object-contain" : "object-cover"} loading={previewLoading} onLoad={cardPresentation ? (event) => {
                  const image = event.currentTarget;
                  setLoadedDimensions({ value, width: image.naturalWidth, height: image.naturalHeight });
                } : undefined} sizes={cardPresentation ? "(max-width: 767px) 100vw, 50vw" : "(max-width: 416px) 100vw, 384px"} />
              </button>
            </AdminMediaPreview>
            {selectedActions}
          </div>
          {showReferenceLabel ? <div className="px-3 py-2"><AdminMediaReferenceLabel value={value} state={referenceState} /></div> : null}
        </div>
      ) : (
        <button
          id={triggerId}
          type="button"
          aria-label={focusTargetId ? label : undefined}
          aria-haspopup={focusTargetId ? "dialog" : undefined}
          aria-expanded={focusTargetId ? pickerOpen : undefined}
          aria-describedby={ariaDescribedBy}
          onClick={() => setPickerOpen(true)}
          data-admin-media-image-card="add"
          className={`flex w-full ${cardPresentation ? "aspect-video" : "h-44 max-w-sm"} cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-sm transition ${light ? "border-slate-300 bg-slate-50 text-slate-500 hover:border-[#b98724] hover:bg-amber-50" : "border-white/15 bg-[#05070B] text-white/45 hover:border-[#D8B87A]/30 hover:text-white/70"}`}
        >
          <span aria-hidden="true" className="text-2xl leading-none">+</span>
          <span>اختيار صورة</span>
        </button>
      )}

      <AdminMediaOriginalDimensions value={value} state={referenceState} />

      {altName ? (
        <label className={ADMIN_FORM.labelStack} data-admin-media-image-alt-field={altName}>
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
        </label>
      ) : null}

      <VenesiaModal
        closeOnEscape
        open={previewOpen && presentation === "active"}
        onClose={() => setPreviewOpen(false)}
        title={`معاينة ${label}`}
        size="lg"
      >
        <div className="relative h-[min(70vh,720px)] w-full" data-admin-media-image-expanded>
          {value ? <Image src={value} alt={altValue || label} fill className="object-contain" sizes="(max-width: 920px) 100vw, 920px" /> : null}
        </div>
      </VenesiaModal>

      <AdminMediaPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={updateValue}
        initialFolder={browseFolder}
      />
    </div>
  );
}
