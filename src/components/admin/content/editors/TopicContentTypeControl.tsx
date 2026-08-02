"use client";

import { useRouter } from "next/navigation";
import { adminFormFieldClassName } from "../../../../lib/admin/admin-ui-styles";
import AdminListboxSelect from "../../ui/AdminListboxSelect";
import {
  CONTENT_TYPE_OPTIONS,
  type ContentType,
} from "../../../../lib/admin/content/content-types";

export default function TopicContentTypeControl({
  value,
  mode,
  presentation = "default",
}: {
  value: ContentType;
  mode: "create" | "edit";
  presentation?: "default" | "compact";
}) {
  const router = useRouter();

  if (presentation === "compact") {
    return (
      <label className="inline-grid min-w-0 max-w-full shrink-0 space-y-1.5">
        <span className="text-xs font-medium text-white/58">نوع المحتوى</span>
        <AdminListboxSelect
          id="topic-content-type-popover"
          value={value}
          options={CONTENT_TYPE_OPTIONS}
          disabled={mode === "edit"}
          sizing="content-relaxed"
          ariaLabel="نوع المحتوى"
          onChange={(next) => {
            router.push(`/admin/content/topics/new?type=${next}`);
          }}
        />
      </label>
    );
  }

  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="text-xs font-medium text-white/58">نوع المحتوى</span>
      <select
        aria-label="نوع المحتوى"
        value={value}
        disabled={mode === "edit"}
        onChange={(event) => {
          router.push(`/admin/content/topics/new?type=${event.target.value}`);
        }}
        className={adminFormFieldClassName("h-11 w-full rounded-xl px-3 py-2.5 disabled:cursor-not-allowed disabled:opacity-60")}
      >
        {CONTENT_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
