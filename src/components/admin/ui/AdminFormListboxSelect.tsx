"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { adminFormHintClassName, adminFormLabelClassName } from "../../../lib/admin/admin-ui-styles";

import AdminListboxSelect, {
  type AdminListboxSelectOption,
  type AdminListboxSelectProps,
} from "./AdminListboxSelect";

export type AdminFormListboxSelectProps = {
  name: string;
  options: readonly AdminListboxSelectOption[];
  id?: string;
  focusTargetId?: string;
  /** Additional field descriptions are retained alongside the current status. */
  ariaDescribedBy?: string;
  label?: ReactNode;
  /** Optional canonical title-row styling; does not alter control geometry. */
  labelClassName?: string;
  /** @deprecated Both values resolve to the canonical field presentation. */
  presentation?: "default" | "panel";
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  showPlaceholderForEmptyValue?: boolean;
  allowEmptySelection?: boolean;
  required?: boolean;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  loading?: boolean;
  loadingMessage?: string;
  emptyMessage?: string;
  error?: string | null;
  hint?: ReactNode;
  className?: string;
  inline?: boolean;
  inlineClassName?: AdminListboxSelectProps["inlineClassName"];
  inlineOptionsClassName?: AdminListboxSelectProps["inlineOptionsClassName"];
  inlineOptionClassName?: AdminListboxSelectProps["inlineOptionClassName"];
  dir?: "rtl" | "ltr";
  sizing?: AdminListboxSelectProps["sizing"];
};

export default function AdminFormListboxSelect({
  name,
  options,
  id,
  focusTargetId,
  ariaDescribedBy,
  label,
  labelClassName,
  value: controlledValue,
  defaultValue = "",
  onChange,
  placeholder = "اختر",
  showPlaceholderForEmptyValue = false,
  allowEmptySelection = false,
  required = false,
  disabled = false,
  searchable = false,
  searchPlaceholder = "ابحث في الخيارات",
  loading = false,
  loadingMessage = "جارٍ تحميل الخيارات…",
  emptyMessage = "لا توجد خيارات متاحة.",
  error = null,
  hint,
  className = "",
  inline = false,
  inlineClassName,
  inlineOptionsClassName,
  inlineOptionClassName,
  dir = "rtl",
  sizing = "content-relaxed",
}: AdminFormListboxSelectProps) {
  const generatedId = useId();
  const controlId = id ?? `admin-form-listbox-${generatedId}`;
  const nativeSelectRef = useRef<HTMLSelectElement>(null);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = controlledValue ?? internalValue;
  const previousValueRef = useRef(selectedValue);

  useEffect(() => {
    if (previousValueRef.current === selectedValue) return;
    previousValueRef.current = selectedValue;
    nativeSelectRef.current?.dispatchEvent(
      new Event("change", { bubbles: true }),
    );
  }, [selectedValue]);

  function updateValue(next: string) {
    if (next === selectedValue) return;
    if (controlledValue === undefined) setInternalValue(next);
    onChange?.(next);
  }

  const unavailable = options.length === 0;
  const statusId = `${controlId}-status`;
  const labelId = `${controlId}-label`;
  const describedBy = [
    ariaDescribedBy,
    loading || error || unavailable || hint ? statusId : undefined,
  ].filter(Boolean).join(" ") || undefined;
  const labelText = typeof label === "string" ? label : placeholder;
  const titleClassName = labelClassName ?? adminFormLabelClassName({ textInset: true });

  return (
    <div
      dir={dir}
      data-admin-form-field=""
      data-admin-form-listbox=""
      data-admin-form-listbox-state={
        loading ? "loading" : error ? "error" : unavailable ? "empty" : "ready"
      }
      className={`min-w-0 space-y-2 ${className}`.trim()}
    >
      {label ? (
        <span id={labelId} className={titleClassName}>
          <span data-admin-form-label-text>{label}{required ? <> <span className="text-red-400">*</span></> : null}</span>
        </span>
      ) : null}

      <select
        ref={nativeSelectRef}
        id={`${controlId}-source`}
        name={name}
        value={selectedValue}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        data-admin-form-listbox-source=""
        onChange={(event) => updateValue(event.currentTarget.value)}
        className="sr-only"
      >
        {options.some((option) => option.value === "") ? null : (
          <option value="">{placeholder}</option>
        )}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>

      <div data-admin-form-field-control="" className="min-w-0">
      <AdminListboxSelect
        id={controlId}
        triggerId={focusTargetId}
        value={selectedValue}
        options={options}
        onChange={updateValue}
        disabled={disabled || loading}
        placeholder={placeholder}
        showPlaceholderForEmptyValue={showPlaceholderForEmptyValue}
        allowEmptySelection={allowEmptySelection}
        ariaLabel={label ? undefined : labelText}
        ariaLabelledBy={label ? labelId : undefined}
        ariaDescribedBy={describedBy}
        ariaInvalid={Boolean(error)}
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
        emptyMessage={emptyMessage}
        inline={inline}
        inlineClassName={inlineClassName}
        inlineOptionsClassName={inlineOptionsClassName}
        inlineOptionClassName={inlineOptionClassName}
        dir={dir}
        sizing={sizing}
        className={sizing === "full" ? "w-full" : "max-w-full"}
      />
      </div>

      {loading ? (
        <p id={statusId} role="status" className="text-xs text-white/45">
          {loadingMessage}
        </p>
      ) : error ? (
        <p
          id={statusId}
          role="alert"
          className="text-xs font-semibold text-red-300"
        >
          {error}
        </p>
      ) : unavailable ? (
        <p id={statusId} role="status" className="text-xs text-white/45">
          {emptyMessage}
        </p>
      ) : hint ? (
        <p id={statusId} className={adminFormHintClassName({ textInset: true })}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
