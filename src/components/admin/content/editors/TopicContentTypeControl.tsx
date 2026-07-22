"use client";

import { useRouter } from "next/navigation";
import { adminFormFieldClassName } from "../../../../lib/admin/admin-ui-styles";
import {
  CONTENT_TYPE_OPTIONS,
  type ContentType,
} from "../../../../lib/admin/content/content-types";

export default function TopicContentTypeControl({
  value,
  mode,
}: {
  value: ContentType;
  mode: "create" | "edit";
}) {
  const router = useRouter();

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
