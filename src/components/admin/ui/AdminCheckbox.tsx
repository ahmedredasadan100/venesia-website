"use client";

import type { InputHTMLAttributes, RefObject } from "react";

export const ADMIN_CHECKBOX_CLASSES =
  "h-4 w-4 cursor-pointer accent-[#D8B87A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70 disabled:cursor-not-allowed disabled:opacity-45";

export const ADMIN_CHECKBOX_PREMIUM_CLASSES =
  "peer size-5 cursor-pointer appearance-none rounded-md border border-white/15 bg-black/30 transition checked:border-[#D8B87A] checked:bg-[#D8B87A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70 disabled:cursor-not-allowed disabled:opacity-45";

type AdminCheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "aria-label" | "type"
> & {
  label: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  presentation?: "native" | "premium";
};

export default function AdminCheckbox({
  checked,
  onChange,
  label,
  inputRef,
  presentation = "premium",
  className = "",
  style,
  ...props
}: AdminCheckboxProps) {
  const input = (
    <input
      {...props}
      ref={inputRef}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      data-admin-checkbox-presentation={presentation}
      className={`${presentation === "premium" ? ADMIN_CHECKBOX_PREMIUM_CLASSES : ADMIN_CHECKBOX_CLASSES} ${className}`.trim()}
      style={{ ...style, caretColor: "transparent" }}
    />
  );

  if (presentation === "native") return input;

  return (
    <span className="relative inline-flex size-5 shrink-0">
      {input}
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute inset-0 m-auto size-3.5 text-[#07101C] opacity-0 transition peer-checked:opacity-100"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m5 10 3 3 7-7" />
      </svg>
    </span>
  );
}
