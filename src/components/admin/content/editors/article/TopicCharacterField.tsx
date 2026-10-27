"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { adminFormFieldClassName } from "../../../../../lib/admin/admin-ui-styles";
import {
  AdminFormError,
  useOptionalAdminFormRuntime,
} from "../../../ui/AdminFormRuntime";
import { ADMIN_SCROLLBAR_VISUAL_CLASSES } from "../../../ui/admin-scrollbar-styles";
import TopicFieldCounter from "./TopicFieldCounter";

type TopicCharacterFieldProps = {
  as?: "input" | "textarea";
  id?: string;
  name: string;
  label: string;
  /** Optional shared label/stack classes; omitted consumers retain their current presentation. */
  labelClassName?: string;
  defaultValue?: string | null;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder: string;
  required?: boolean;
  rows?: number;
  /** Honor authored rows without the legacy textarea floor in compact panels. */
  textareaSizing?: "default" | "rows";
  dir?: "rtl" | "ltr";
};

export default function TopicCharacterField({
  as = "input",
  id,
  name,
  label,
  labelClassName,
  defaultValue = "",
  value,
  onValueChange,
  placeholder,
  required = false,
  rows = 3,
  textareaSizing = "default",
  dir = "rtl",
}: TopicCharacterFieldProps) {
  const initialValue = defaultValue ?? "";
  const [count, setCount] = useState(initialValue.length);
  const controlled = value !== undefined;
  const currentValue = controlled ? value : undefined;
  const currentCount = controlled ? value.length : count;
  const fieldErrors = useOptionalAdminFormRuntime()?.fieldErrors[name] ?? [];
  const hasError = fieldErrors.length > 0;
  const className = adminFormFieldClassName("h-11 rounded-xl px-3 py-2.5");
  const counter = <TopicFieldCounter count={currentCount} />;
  const valueProps = controlled
    ? {
        value: currentValue,
        onChange: (
          event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
        ) => onValueChange?.(event.currentTarget.value),
      }
    : {
        defaultValue: initialValue,
        onInput: (
          event: FormEvent<HTMLInputElement | HTMLTextAreaElement>,
        ) => setCount(event.currentTarget.value.length),
      };
  const control =
    as === "textarea" ? (
      <textarea
        id={id}
        name={name}
        rows={rows}
        {...valueProps}
        placeholder={placeholder}
        required={required}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? `${name}-error` : undefined}
        dir={dir}
        className={`${className} h-auto${textareaSizing === "rows" ? "" : " min-h-40"} resize-y overflow-y-auto leading-6 ${ADMIN_SCROLLBAR_VISUAL_CLASSES}`}
      />
    ) : (
      <input
        id={id}
        name={name}
        {...valueProps}
        placeholder={placeholder}
        required={required}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? `${name}-error` : undefined}
        dir={dir}
        className={className}
      />
    );

  return (
    <label htmlFor={id} className={labelClassName ?? "block space-y-1.5"}>
      <span data-admin-form-label-text className={`inline-flex items-center gap-2${labelClassName === undefined ? " text-xs font-medium text-white/58" : ""}`}>
        <span>
          {label} {required ? <span className="text-red-400">*</span> : null}
        </span>
        {counter}
      </span>
      <div className="min-w-0">{control}</div>
      <AdminFormError name={name} />
    </label>
  );
}
