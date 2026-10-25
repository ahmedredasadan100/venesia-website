"use client";
import type { MediaSlotContract } from "../../../lib/media/media-slot-contract";
import { ADMIN_FORM, adminFormFieldClassName, adminFormLabelClassName, adminFormTextareaClassName } from "../../../lib/admin/admin-ui-styles";
import AdminMediaSlotGuidance from "./AdminMediaSlotGuidance";
import MediaNoImage from "./MediaNoImage";
import { useAdminMediaReferenceState, AdminMediaPreview, AdminMediaReferenceLabel, AdminMediaOriginalDimensions, adminMediaPresentationState } from "./AdminDeletedMediaNotice";

import Image from "next/image";
import { useId, useRef, useState, type ComponentProps, type ReactNode } from "react";

import AdminMediaPickerModal from "./AdminMediaPickerModal";
import VenesiaModal from "../VenesiaModal";
import AdminActionButton from "../ui/AdminActionButton";
import { AdminDataGridActionIcon } from "../ui/AdminDataGrid";

export type AdminMediaImageActionAttributes = Omit<
  ComponentProps<typeof AdminActionButton>,
  "children" | "size" | "variant" | "className" | "href" | "form" | "type"
> & { [attribute: `data-${string}`]: string | undefined };

export function AdminMediaImageActions({
  replace,
  remove,
}: {
  replace?: AdminMediaImageActionAttributes;
  remove?: AdminMediaImageActionAttributes;
}) {
  if (!replace && !remove) return null;
  return (
    <div className="absolute bottom-3 left-3 flex gap-2 rounded-2xl bg-[#080B10]/95 p-1" data-admin-media-image-actions>
      {replace ? (
        <AdminActionButton {...replace} size="icon" variant="gold">
          <AdminDataGridActionIcon action="restore" size="md" />
        </AdminActionButton>
      ) : null}
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
  /** Optional canonical field title presentation; image controls keep their geometry. */
  labelClassName?: string;
  defaultValue?: string;
  /** Controlled list items retain their value and projection at the collection owner. */
  value?: string;
  renderValueInput?: boolean;
  /** Card-only URL entry shares the same value with the existing image controls. */
  urlInput?: {
    id: string;
    placeholder?: string;
    dir?: "ltr" | "rtl";
    ariaInvalid?: boolean;
    ariaDescribedBy?: string;
  };
  referenceState?: ReturnType<typeof useAdminMediaReferenceState>;
  mediaSlot?: MediaSlotContract;
  showGuidance?: boolean;
  /** Presentation-only classes forwarded to the existing design-size hint owner. */
  guidanceClassName?: string;
  /** Presentation-only classes appended to the original-dimensions helper. */
  originalDimensionsClassName?: string;
  showReferenceLabel?: boolean;
  browseFolder?: string;
  variant?: "default" | "compact" | "card" | "gallery";
  showLabel?: boolean;
  onValueChange?: (value: string) => void;
  compactAspectClassName?: string;
  previewLoading?: "lazy" | "eager";
  appearance?: "dark" | "light";
  altName?: string;
  defaultAlt?: string;
  altValue?: string;
  altLabel?: string;
  onAltValueChange?: (value: string) => void;
  allowRemove?: boolean;
  allowReplace?: boolean;
  onReplace?: () => void;
  onRemove?: () => void;
  pickerExpanded?: boolean;
  actionPresentation?: "default" | "bare" | "card";
  actionAttributes?: { replace?: AdminMediaImageActionAttributes; remove?: AdminMediaImageActionAttributes };
  previewAspectRatio?: number;
  previewFit?: "contain" | "cover";
  enablePreview?: boolean;
  previewOverlay?: ReactNode;
  previewSurfaceProps?: ComponentProps<"div"> & { [attribute: `data-${string}`]: string | undefined };
  dimensionsPresentation?: "default" | "disclosure";
  metadataPresentation?: "default" | "panel" | "gallery";
  metadataLabelClassName?: string;
  metadataClassName?: string;
  showAlt?: boolean;
  showCaption?: boolean;
  altRows?: number;
  captionRows?: number;
  showAltCounter?: boolean;
  showCaptionCounter?: boolean;
  altPlaceholder?: string;
  captionPlaceholder?: string;
  altId?: string;
  altInvalid?: boolean;
  altDescribedBy?: string;
  altError?: ReactNode;
  captionError?: ReactNode;
  altWarning?: ReactNode;
  captionName?: string;
  captionValue?: string;
  captionLabel?: string;
  onCaptionValueChange?: (value: string) => void;
  clearAltOnRemove?: boolean;
  focusTargetId?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
};

export default function AdminMediaImageField({
  name,
  label,
  labelClassName,
  defaultValue = "",
  value: controlledValue,
  renderValueInput = true,
  urlInput,
  referenceState: providedReferenceState,
  mediaSlot,
  showGuidance = true,
  guidanceClassName,
  originalDimensionsClassName,
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
  altValue: controlledAlt,
  altLabel = "النص البديل للصورة",
  onAltValueChange,
  allowRemove = true,
  allowReplace = true,
  onReplace,
  onRemove,
  pickerExpanded,
  actionPresentation = "default",
  actionAttributes,
  previewAspectRatio,
  previewFit,
  enablePreview,
  previewOverlay,
  previewSurfaceProps,
  dimensionsPresentation = "default",
  metadataPresentation = "default",
  metadataLabelClassName,
  metadataClassName,
  showAlt = true,
  showCaption = true,
  altRows = 2,
  captionRows = 2,
  showAltCounter = false,
  showCaptionCounter = false,
  altPlaceholder,
  captionPlaceholder = "تعليق اختياري",
  altId,
  altInvalid,
  altDescribedBy,
  altError,
  captionError,
  altWarning,
  captionName,
  captionValue = "",
  captionLabel = "التعليق (Caption)",
  onCaptionValueChange,
  clearAltOnRemove = true,
  focusTargetId,
  ariaInvalid = false,
  ariaDescribedBy,
}: AdminMediaImageFieldProps) {
  const generatedFocusTargetId = useId();
  const triggerId = focusTargetId ?? generatedFocusTargetId;
  const [localValue, setValue] = useState(defaultValue);
  const value = controlledValue ?? localValue;
  const [prevDefaultValue, setPrevDefaultValue] = useState(defaultValue);
  const [localAltValue, setAltValue] = useState(defaultAlt);
  const altValue = controlledAlt ?? localAltValue;
  const [prevDefaultAlt, setPrevDefaultAlt] = useState(defaultAlt);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loadedDimensions, setLoadedDimensions] = useState<{ value: string; width: number; height: number } | null>(null);
  const localReferenceState = useAdminMediaReferenceState(providedReferenceState === undefined ? [value] : []);
  const referenceState = providedReferenceState === undefined ? localReferenceState : providedReferenceState;
  const presentation = adminMediaPresentationState(value, referenceState);
  const valueInputRef = useRef<HTMLInputElement>(null);
  const altInputRef = useRef<HTMLInputElement>(null);
  const altProjectionRef = useRef<HTMLInputElement>(null);
  const captionProjectionRef = useRef<HTMLInputElement>(null);

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
    if (!next && clearAltOnRemove && altName) {
      setAltValue("");
      altInputRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
      onAltValueChange?.("");
    }
    onValueChange?.(next);
  }

  function openPicker() {
    if (onReplace) onReplace();
    else setPickerOpen(true);
  }

  function removeValue() {
    if (onRemove) onRemove();
    else updateValue("");
  }

  const light = appearance === "light";
  const compactFrameClass = light
    ? "border-slate-200 bg-slate-50"
    : "border-white/10 bg-black/30";
  const emptyCompactClass = light
    ? "text-slate-500 hover:bg-amber-50 hover:text-[#9a6815]"
    : "text-white/40 hover:text-[#D8B87A]";

  function renderMetadataField(kind: "alt" | "caption") {
    const isAlt = kind === "alt";
    const fieldName = isAlt ? altName : captionName;
    if (!fieldName) return null;
    const fieldValue = isAlt ? altValue : captionValue;
    if (!(isAlt ? showAlt : showCaption)) return <input key={kind} type="hidden" name={fieldName} value={fieldValue} />;
    const article = metadataPresentation === "panel";
    const rows = isAlt ? altRows : captionRows;
    const multiline = article && rows > 1;
    // A text input strips stored line breaks. Keep its untouched raw snapshot
    // until an explicit edit, without adding a second named submission value.
    const preserveRaw = !multiline && /[\r\n]/.test(fieldValue);
    const projectionRef = isAlt ? altProjectionRef : captionProjectionRef;
    const update = (next: string) => {
      if (isAlt) { setAltValue(next); onAltValueChange?.(next); }
      else onCaptionValueChange?.(next);
    };
    const attributes = {
      name: fieldName,
      value: fieldValue,
      id: isAlt ? altId : undefined,
      placeholder: isAlt ? altPlaceholder : captionPlaceholder,
      "aria-invalid": isAlt ? altInvalid || undefined : undefined,
      "aria-describedby": isAlt ? altDescribedBy : undefined,
    };
    return <label key={kind} className={article ? metadataLabelClassName ?? adminFormLabelClassName({ textInset: true }) : ADMIN_FORM.labelStack} data-admin-media-image-metadata-field={kind}>
      <span data-admin-form-label-text className={article ? "inline-flex items-center gap-2" : "text-xs font-semibold text-white/60"}>
        <span>{isAlt ? altLabel : captionLabel}</span>
        {(isAlt ? showAltCounter : showCaptionCounter) ? <span className="shrink-0 whitespace-nowrap font-en text-[11px] tabular-nums text-[#D8B87A]/78" dir="ltr" data-admin-media-image-counter={kind}>{fieldValue.length}</span> : null}
      </span>
      {preserveRaw ? <input ref={projectionRef} type="hidden" name={fieldName} value={fieldValue} /> : null}
      {multiline ? <textarea {...attributes} rows={rows} onChange={(event) => update(event.target.value)} className={adminFormTextareaClassName("h-auto min-h-16 scroll-mt-24 resize-y rounded-xl px-3 py-2.5 leading-6")} /> : <input {...attributes} name={preserveRaw ? undefined : fieldName} data-admin-media-image-input-name={fieldName} onInputCapture={(event) => { if (preserveRaw && projectionRef.current) projectionRef.current.value = event.currentTarget.value; }} onChange={(event) => update(event.target.value)} className={article ? adminFormFieldClassName("h-11 py-2.5") : "h-10 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"} />}
    </label>;
  }
  const metadataFields = metadataPresentation !== "default" && (altName || captionName) ? <div className={metadataClassName ?? "space-y-3"} data-admin-media-image-metadata={metadataPresentation}>
    {renderMetadataField("alt")}{altError}{renderMetadataField("caption")}{captionError}{altWarning}
  </div> : null;
  const dimensionDisclosures = dimensionsPresentation === "disclosure" ? <div className="grid grid-cols-2 items-start gap-2" data-admin-media-image-dimensions>
    {showGuidance ? <AdminMediaSlotGuidance slot={mediaSlot} presentation="disclosure" /> : null}
    <AdminMediaOriginalDimensions value={value} state={referenceState} presentation="disclosure" />
  </div> : null;

  if (variant === "gallery") {
    const replaceLabel = presentation === "deleted" || presentation === "missing" ? "اختيار بديل" : "استبدال";
    const replace = {
      title: replaceLabel,
      "aria-label": replaceLabel,
      "aria-haspopup": "dialog" as const,
      "aria-expanded": pickerExpanded ?? pickerOpen,
      onClick: onReplace ?? (() => setPickerOpen(true)),
      ...actionAttributes?.replace,
    };
    const remove = {
      title: "إزالة الصورة",
      "aria-label": "إزالة الصورة",
      onClick: onRemove ?? (() => updateValue("")),
      ...actionAttributes?.remove,
    };
    return <>
      {renderValueInput ? <input ref={valueInputRef} type="hidden" name={name} value={value} /> : null}
      {actionPresentation === "default" && allowRemove ? <button {...remove} type="button" className="absolute right-2 top-2 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/60 text-white/80 hover:text-white">×</button> : null}
      <div {...previewSurfaceProps} className={`relative aspect-[4/3]${previewSurfaceProps?.className ? ` ${previewSurfaceProps.className}` : ""}`} style={previewAspectRatio ? { ...previewSurfaceProps?.style, aspectRatio: previewAspectRatio } : previewSurfaceProps?.style} data-admin-media-image-frame>
        <AdminMediaPreview value={value} state={referenceState} controlsOverlay={actionPresentation === "card"}>
          <Image src={value} alt={altValue} fill className={previewFit === "contain" ? "object-contain" : "object-cover"} draggable={previewSurfaceProps?.draggable ? false : undefined} sizes="(max-width: 768px) 100vw, 50vw" />
        </AdminMediaPreview>
        {previewOverlay}
        {actionPresentation === "card" ? <AdminMediaImageActions replace={allowReplace ? replace : undefined} remove={allowRemove ? remove : undefined} /> : null}
      </div>
      <div className="space-y-2 px-3 py-2">
        {dimensionsPresentation === "disclosure" ? dimensionDisclosures : <AdminMediaOriginalDimensions value={value} state={referenceState} />}
        {showReferenceLabel || actionPresentation !== "card" ? <div className="flex flex-wrap items-center justify-between gap-2">
          {showReferenceLabel ? <div className="min-w-0 flex-1"><AdminMediaReferenceLabel value={value} state={referenceState} /></div> : null}
          {actionPresentation === "bare" ? <div className="inline-flex shrink-0 items-center gap-1" data-admin-media-gallery-actions="bare">
            {allowReplace ? <AdminActionButton {...replace} variant="gold-ghost" size="icon"><AdminDataGridActionIcon action="copy-link" size="lg" /></AdminActionButton> : null}
            {allowRemove ? <AdminActionButton {...remove} variant="danger-ghost" size="icon"><AdminDataGridActionIcon action="delete" size="lg" /></AdminActionButton> : null}
          </div> : actionPresentation === "default" && allowReplace ? <button {...replace} type="button" className="cursor-pointer shrink-0 rounded-lg border border-[#D8B87A]/30 px-2.5 py-1 text-[11px] font-semibold text-[#D8B87A] hover:bg-[#D8B87A]/10">{replaceLabel}</button> : null}
        </div> : null}
        {metadataFields}
      </div>
      {onReplace ? null : <AdminMediaPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={updateValue} initialFolder={browseFolder} />}
    </>;
  }

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

        {showGuidance ? <AdminMediaSlotGuidance slot={mediaSlot} className={guidanceClassName} /> : null}

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
                {allowReplace ? <button
                  id={triggerId}
                  type="button"
                  aria-label={focusTargetId ? label : undefined}
                  aria-haspopup={focusTargetId ? "dialog" : undefined}
                  aria-expanded={focusTargetId ? pickerExpanded ?? pickerOpen : undefined}
                  aria-describedby={ariaDescribedBy}
                  onClick={openPicker}
                  className="cursor-pointer rounded-lg border border-[#D8B87A]/35 bg-[#D8B87A]/10 px-2.5 py-1 text-[11px] font-semibold text-[#D8B87A] hover:bg-[#D8B87A]/15"
                >
                  {presentation === "deleted" || presentation === "missing" ? "اختيار بديل" : "استبدال"}
                </button> : null}
                {allowRemove ? (
                  <button
                    type="button"
                    onClick={removeValue}
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
              aria-expanded={focusTargetId ? pickerExpanded ?? pickerOpen : undefined}
              aria-describedby={ariaDescribedBy}
              onClick={openPicker}
              className={`flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 text-xs transition ${emptyCompactClass}`}
            >
              <span className="text-lg leading-none">+</span>
              <span>اختيار صورة</span>
            </button>
          )}
        </div>

        <AdminMediaOriginalDimensions value={value} state={referenceState} className={originalDimensionsClassName} />

        {altName && !showAlt ? <input type="hidden" name={altName} value={altValue} /> : null}
        {altName && showAlt ? (
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
  const urlInputOptions = cardPresentation ? urlInput : undefined;
  // This only protects the opt-in preview while editing. The raw input and
  // server validation retain ownership of the value that will be submitted.
  const canPreviewValue = !urlInputOptions || (() => {
    if (value.startsWith("/") && !value.startsWith("//")) return true;
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  })();
  const original = referenceState?.originals.find((item) => item.value === value
    && Number.isFinite(item.width) && Number.isFinite(item.height)
    && (item.width ?? 0) > 0 && (item.height ?? 0) > 0);
  const dimensions = original?.width && original?.height
    ? original
    : loadedDimensions?.value === value ? loadedDimensions : null;
  const aspectRatio = previewAspectRatio ?? (dimensions?.width && dimensions?.height
    && Number.isFinite(dimensions.width) && Number.isFinite(dimensions.height)
    && dimensions.width > 0 && dimensions.height > 0
    ? dimensions.width / dimensions.height : 16 / 9);
  const replaceLabel = presentation === "deleted" || presentation === "missing" ? "اختيار بديل" : "استبدال";
  const selectedActions = cardPresentation ? (
    <AdminMediaImageActions
      replace={allowReplace ? {
        id: triggerId,
        title: replaceLabel,
        "aria-label": focusTargetId ? label : replaceLabel,
        "aria-haspopup": "dialog",
        "aria-expanded": pickerExpanded ?? pickerOpen,
        "aria-describedby": ariaDescribedBy,
        onClick: openPicker,
      } : undefined}
      remove={allowRemove ? {
        title: "إزالة",
        "aria-label": "إزالة",
        onClick: removeValue,
      } : undefined}
    />
  ) : (
    <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-2 bg-gradient-to-t from-black/90 via-black/65 to-transparent p-3 pt-10">
      {allowReplace ? <button
        id={triggerId}
        type="button"
        aria-label={focusTargetId ? label : undefined}
        aria-haspopup={focusTargetId ? "dialog" : undefined}
        aria-expanded={focusTargetId ? pickerExpanded ?? pickerOpen : undefined}
        aria-describedby={ariaDescribedBy}
        onClick={openPicker}
        className="cursor-pointer rounded-lg border border-[#D8B87A]/35 bg-black/45 px-3 py-1.5 text-xs font-semibold text-[#F2D99B] backdrop-blur-sm hover:bg-[#D8B87A]/15"
      >
        {presentation === "deleted" || presentation === "missing" ? "اختيار بديل" : "استبدال"}
      </button> : null}
      {allowRemove ? (
        <button
          type="button"
          onClick={removeValue}
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
      {urlInputOptions ? (
        <label htmlFor={urlInputOptions.id} className={ADMIN_FORM.labelStack}>
          {showLabel ? <span className={labelClassName ?? adminFormLabelClassName({ textInset: true })}><span data-admin-form-label-text>{label}</span></span> : null}
          <input
            ref={valueInputRef}
            type="text"
            id={urlInputOptions.id}
            name={name}
            value={value}
            placeholder={urlInputOptions.placeholder}
            dir={urlInputOptions.dir}
            aria-label={showLabel ? undefined : label}
            aria-invalid={urlInputOptions.ariaInvalid}
            aria-describedby={urlInputOptions.ariaDescribedBy}
            className={adminFormFieldClassName(urlInputOptions.ariaInvalid ? "border-red-400/40" : "")}
            onChange={(event) => updateValue(event.currentTarget.value)}
          />
        </label>
      ) : <input ref={valueInputRef} type="hidden" name={name} value={value} />}


      {showLabel && !urlInputOptions ? (
        <span className={labelClassName ?? `block text-xs font-semibold ${light ? "text-slate-700" : "text-white/55"}`}>
          {labelClassName ? <span data-admin-form-label-text>{label}</span> : label}
        </span>
      ) : null}

      {showGuidance && dimensionsPresentation === "default" ? <AdminMediaSlotGuidance slot={mediaSlot} className={guidanceClassName} /> : null}

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
              {!canPreviewValue ? <MediaNoImage label="أدخل مسار صورة أو رابطًا كاملًا للمعاينة" /> : enablePreview !== false ? <button
                type="button"
                aria-label={`معاينة ${label} بالحجم الكبير`}
                aria-haspopup="dialog"
                aria-expanded={previewOpen}
                onClick={() => setPreviewOpen(true)}
                className="absolute inset-0 cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[#D8B87A]"
                data-admin-media-image-preview-trigger
              >
                <Image src={value} alt="" fill unoptimized={urlInputOptions ? true : undefined} className={(previewFit ?? (cardPresentation ? "contain" : "cover")) === "contain" ? "object-contain" : "object-cover"} loading={previewLoading} onLoad={cardPresentation ? (event) => {
                  const image = event.currentTarget;
                  setLoadedDimensions({ value, width: image.naturalWidth, height: image.naturalHeight });
                } : undefined} sizes={cardPresentation ? "(max-width: 767px) 100vw, 50vw" : "(max-width: 416px) 100vw, 384px"} />
              </button> : <Image src={value} alt={altValue} fill unoptimized={urlInputOptions ? true : undefined} className={(previewFit ?? (cardPresentation ? "contain" : "cover")) === "contain" ? "object-contain" : "object-cover"} sizes="(max-width: 767px) 100vw, 50vw" />}
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
          aria-expanded={focusTargetId ? pickerExpanded ?? pickerOpen : undefined}
          aria-describedby={ariaDescribedBy}
          onClick={openPicker}
          data-admin-media-image-card="add"
          className={`flex w-full ${cardPresentation ? "aspect-video" : "h-44 max-w-sm"} cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-sm transition ${light ? "border-slate-300 bg-slate-50 text-slate-500 hover:border-[#b98724] hover:bg-amber-50" : "border-white/15 bg-[#05070B] text-white/45 hover:border-[#D8B87A]/30 hover:text-white/70"}`}
        >
          <span aria-hidden="true" className="text-2xl leading-none">+</span>
          <span>اختيار صورة</span>
        </button>
      )}

      {dimensionsPresentation === "disclosure" ? dimensionDisclosures : <AdminMediaOriginalDimensions value={value} state={referenceState} className={originalDimensionsClassName} />}

      {metadataFields}
      {altName && !showAlt && metadataPresentation === "default" ? <input type="hidden" name={altName} value={altValue} /> : null}
      {altName && showAlt && metadataPresentation === "default" ? (
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
        open={previewOpen && presentation === "active" && canPreviewValue}
        onClose={() => setPreviewOpen(false)}
        title={`معاينة ${label}`}
        size="lg"
      >
        <div className="relative h-[min(70vh,720px)] w-full" data-admin-media-image-expanded>
          {value && canPreviewValue ? <Image src={value} alt={altValue || label} fill unoptimized={urlInputOptions ? true : undefined} className="object-contain" sizes="(max-width: 920px) 100vw, 920px" /> : null}
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
