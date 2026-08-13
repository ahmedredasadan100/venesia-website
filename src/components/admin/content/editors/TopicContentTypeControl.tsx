"use client";

import { useRouter } from "next/navigation";
import AdminListboxSelect from "../../ui/AdminListboxSelect";
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
