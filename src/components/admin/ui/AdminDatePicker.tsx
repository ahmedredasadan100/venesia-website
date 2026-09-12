"use client";

import type { ComponentPropsWithRef } from "react";

/**
 * Admin Form date presentation owner. Values stay native strings: YYYY-MM-DD
 * or a local date/time without an offset. No UTC conversion, parsing through
 * Date, hidden value, or change to the consumer's storage/filter semantics.
 * Native validity, min/max/step, clearing, focus, and keyboard behavior apply.
 */
export type AdminDatePickerProps = Omit<ComponentPropsWithRef<"input">, "type"> & {
  type?: "date" | "datetime-local";
};

export function openAdminDatePicker(input: HTMLInputElement | null) {
  if (!input || input.disabled || input.readOnly) return;
  input.focus({ preventScroll: true });
  try {
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
  } catch {
    // Unsupported picker contexts retain the focused native input and keyboard.
  }
  input.click();
}

export default function AdminDatePicker({ type = "date", ...props }: AdminDatePickerProps) {
  return <input {...props} type={type} data-admin-date-picker="" />;
}
