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
  },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`relative w-full min-w-[180px] overflow-visible sm:w-[220px] lg:w-[240px] lg:shrink-0 ${className}`}
    >
      <input
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
        className={`h-10 w-full rounded-[10px] border border-white/10 bg-black/25 px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#4A8DFF]/35 ${inputClassName}`}
        autoComplete={autoComplete}
      />

      {value ? (
        <button
          type="button"
          onClick={onClear}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full px-1.5 py-0.5 text-[11px] text-white/45 transition hover:text-white"
        >
          {clearLabel}
        </button>
      ) : null}
    </div>
  );
});

export default AdminSearchInput;
