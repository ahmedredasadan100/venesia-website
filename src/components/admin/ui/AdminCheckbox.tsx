"use client";

import type {
  ChangeEventHandler,
  InputHTMLAttributes,
  RefObject,
} from "react";

export const ADMIN_CHECKBOX_CLASSES =
  "h-4 w-4 cursor-pointer accent-[#D8B87A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70 disabled:cursor-not-allowed disabled:opacity-45";

type AdminCheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "checked" | "onChange" | "type"
> & {
  checked: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
  label: string;
  inputRef?: RefObject<HTMLInputElement | null>;
};

export default function AdminCheckbox({
  checked,
  onChange,
  label,
  inputRef,
  className = "",
  style,
  ...props
}: AdminCheckboxProps) {
  return (
    <input
      {...props}
      ref={inputRef}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className={`${ADMIN_CHECKBOX_CLASSES} ${className}`.trim()}
      style={{ ...style, caretColor: "transparent" }}
    />
  );
}
