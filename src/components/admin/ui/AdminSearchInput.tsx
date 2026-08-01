"use client";

import { forwardRef } from "react";
import type { KeyboardEventHandler } from "react";

export type AdminSearchInputProps = {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  onEscape?: () => void;
  onFocus?: () => void;
  onClear?: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  clearLabel?: string;
  autoComplete?: string;
  pending?: boolean;
  expanded?: boolean;
  controls?: string;
  activeDescendant?: string;
  inputLabel?: string;
  disabled?: boolean;
};

const AdminSearchInput = forwardRef<HTMLDivElement, AdminSearchInputProps>(function AdminSearchInput(
  {
    name = "q",
    value,
    onChange,
    onEnter,
    onEscape,
    onFocus,
    onClear,
    onKeyDown,
    placeholder = "بحث...",
    className = "",
    inputClassName = "",
    clearLabel = "مسح",
    autoComplete = "off",
    pending = false,
    expanded,
    controls,
    activeDescendant,
    inputLabel,
    disabled = false,
  },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`relative w-full min-w-[180px] overflow-visible sm:w-[220px] lg:w-[240px] lg:shrink-0 ${className}`}
    >
      <input
        type="search"
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === "Enter") {
            event.preventDefault();
            onEnter?.();
          }
          if (event.key === "Escape") {
            onEscape?.();
          }
        }}
        onFocus={onFocus}
        placeholder={placeholder}
        role="combobox"
        aria-label={inputLabel ?? placeholder}
        aria-autocomplete={expanded === undefined ? undefined : "list"}
        aria-expanded={expanded}
        aria-controls={controls}
        aria-activedescendant={activeDescendant}
        aria-busy={pending || undefined}
        disabled={disabled}
        className={`h-11 w-full appearance-none rounded-[11px] border border-white/10 bg-black/28 pe-10 ps-16 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[#D8B87A]/45 focus:ring-2 focus:ring-[#D8B87A]/10 ${inputClassName}`}
        autoComplete={autoComplete}
      />

      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#D8B87A]/75"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" />
      </svg>

      {value ? (
        <button
          type="button"
          onClick={onClear}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full px-1.5 py-0.5 text-[11px] text-white/45 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70"
        >
          {clearLabel}
        </button>
      ) : null}

      {pending ? (
        <span
          role="status"
          aria-label="جاري تحديث النتائج"
          className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border border-[#D8B87A]/25 border-t-[#D8B87A] ${value ? "left-12" : "left-3"}`}
        />
      ) : null}
    </div>
  );
});

export default AdminSearchInput;
