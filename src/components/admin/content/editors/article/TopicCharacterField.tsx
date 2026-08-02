"use client";

import { useState } from "react";
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
  defaultValue?: string | null;
  placeholder: string;
  required?: boolean;
  rows?: number;
  dir?: "rtl" | "ltr";
};

export default function TopicCharacterField({
  as = "input",
  id,
  name,
  label,
  defaultValue = "",
  placeholder,
  required = false,
  rows = 3,
  dir = "rtl",
}: TopicCharacterFieldProps) {
  const initialValue = defaultValue ?? "";
  const [count, setCount] = useState(initialValue.length);
  const fieldErrors = useOptionalAdminFormRuntime()?.fieldErrors[name] ?? [];
  const hasError = fieldErrors.length > 0;
  const className = adminFormFieldClassName("h-11 rounded-xl px-3 py-2.5");
  const counter = <TopicFieldCounter count={count} />;
  const control =
    as === "textarea" ? (
      <textarea
        id={id}
        name={name}
        rows={rows}
        defaultValue={initialValue}
        placeholder={placeholder}
        required={required}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? `${name}-error` : undefined}
        dir={dir}
        onInput={(event) => setCount(event.currentTarget.value.length)}
        className={`${className} h-auto min-h-40 resize-y overflow-y-auto leading-6 ${ADMIN_SCROLLBAR_VISUAL_CLASSES}`}
      />
    ) : (
      <input
        id={id}
        name={name}
        defaultValue={initialValue}
        placeholder={placeholder}
        required={required}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? `${name}-error` : undefined}
        dir={dir}
        onInput={(event) => setCount(event.currentTarget.value.length)}
        className={className}
      />
    );

  return (
    <label htmlFor={id} className="block space-y-1.5">
      <span className="inline-flex items-center gap-2 text-xs font-medium text-white/58">
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
