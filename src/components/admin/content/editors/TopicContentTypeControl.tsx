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
  labelClassName,
}: {
  value: ContentType;
  mode: "create" | "edit";
  /** Optional shared label/stack classes; omitted consumers retain their current presentation. */
  labelClassName?: string;
}) {
  const { fieldErrors, requestInternalNavigation } = useAdminFormRuntime();
  const hasError = Boolean(fieldErrors.content_type?.length);

  return (
    <label className={labelClassName ?? "inline-grid min-w-0 max-w-full shrink-0 space-y-1.5"}>
      <span data-admin-form-label-text className={labelClassName === undefined ? "text-xs font-medium text-white/58" : undefined}>نوع المحتوى</span>
      <AdminListboxSelect
        id="topic-content-type-popover"
        triggerId="topic-content-type-popover-trigger"
        value={value}
        options={CONTENT_TYPE_OPTIONS}
        disabled={mode === "edit"}
        sizing="full"
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
