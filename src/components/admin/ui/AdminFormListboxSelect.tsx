"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import AdminListboxSelect, {
  type AdminListboxSelectOption,
} from "./AdminListboxSelect";

export type AdminFormListboxSelectProps = {
  name: string;
  options: readonly AdminListboxSelectOption[];
  id?: string;
  label?: ReactNode;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
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
  dir?: "rtl" | "ltr";
};

export default function AdminFormListboxSelect({
  name,
  options,
  id,
  label,
  value: controlledValue,
  defaultValue = "",
  onChange,
  placeholder = "اختر",
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
  dir = "rtl",
}: AdminFormListboxSelectProps) {
  const generatedId = useId();
  const controlId = id ?? `admin-form-listbox-${generatedId}`;
  const nativeSelectRef = useRef<HTMLSelectElement>(null);
  const dispatchChangeRef = useRef(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [search, setSearch] = useState("");
  const selectedValue = controlledValue ?? internalValue;

  const visibleOptions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ar");
    if (!query) return options;
    return options.filter((option) =>
      option.label.toLocaleLowerCase("ar").includes(query),
    );
  }, [options, search]);

  useEffect(() => {
    if (!dispatchChangeRef.current) return;
    dispatchChangeRef.current = false;
    nativeSelectRef.current?.dispatchEvent(
      new Event("change", { bubbles: true }),
    );
  }, [selectedValue]);

  function updateValue(next: string) {
    if (next === selectedValue) return;
    dispatchChangeRef.current = true;
    if (controlledValue === undefined) setInternalValue(next);
    onChange?.(next);
  }

  const unavailable = loading || Boolean(error) || visibleOptions.length === 0;
  const statusId = `${controlId}-status`;
  const labelText = typeof label === "string" ? label : placeholder;

  return (
    <div
      dir={dir}
      data-admin-form-listbox=""
      data-admin-form-listbox-state={
        loading ? "loading" : error ? "error" : unavailable ? "empty" : "ready"
      }
      className={`space-y-2 ${className}`.trim()}
    >
      {label ? (
        <span id={`${controlId}-label`} className="block text-sm font-medium text-white/70">
          {label}
          {required ? " *" : null}
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
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {searchable ? (
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          disabled={disabled || loading || Boolean(error)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-10 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#D8B87A]/45 disabled:cursor-not-allowed disabled:opacity-55"
        />
      ) : null}

      <AdminListboxSelect
        id={controlId}
        value={selectedValue}
        options={visibleOptions}
        onChange={updateValue}
        disabled={disabled || unavailable}
        placeholder={placeholder}
        ariaLabel={labelText}
        inline={inline}
        dir={dir}
        className="w-full"
      />

      {loading ? (
        <p id={statusId} role="status" className="text-xs text-white/45">
          {loadingMessage}
        </p>
      ) : error ? (
        <p id={statusId} role="alert" className="text-xs font-semibold text-red-300">
          {error}
        </p>
      ) : unavailable ? (
        <p id={statusId} role="status" className="text-xs text-white/45">
          {emptyMessage}
        </p>
      ) : hint ? (
        <p className="text-xs leading-5 text-white/40">{hint}</p>
      ) : null}
    </div>
  );
}
