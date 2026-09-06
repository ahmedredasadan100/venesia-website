"use client";

import AdminListboxSelect from "../../ui/AdminListboxSelect";
import {
  CONTENT_TYPE_OPTIONS,
  isContentType,
  type ContentType,
} from "../../../../lib/admin/content/content-types";
import { adminContentNewTopicPath } from "../../../../lib/admin/content-routes";
import {
  AdminFormError,
  useAdminFormRuntime,
} from "../../ui/AdminFormRuntime";

export default function TopicContentTypeControl({
  value,
  mode,
}: {
  value: ContentType;
  mode: "create" | "edit";
}) {
  const { fieldErrors, requestInternalNavigation } = useAdminFormRuntime();
  const hasError = Boolean(fieldErrors.content_type?.length);

  return (
    <label className="inline-grid min-w-0 max-w-full shrink-0 space-y-1.5">
      <span className="text-xs font-medium text-white/58">نوع المحتوى</span>
      <AdminListboxSelect
        id="topic-content-type-popover"
        triggerId="topic-content-type-popover-trigger"
        value={value}
        options={CONTENT_TYPE_OPTIONS}
        disabled={mode === "edit"}
        sizing="content-relaxed"
        ariaLabel="نوع المحتوى"
        ariaInvalid={hasError}
        ariaDescribedBy={hasError ? "content_type-error" : undefined}
        onChange={(next) => {
          if (!isContentType(next) || next === value) return;
          requestInternalNavigation(adminContentNewTopicPath(next));
        }}
      />
      <AdminFormError name="content_type" />
    </label>
  );
}
