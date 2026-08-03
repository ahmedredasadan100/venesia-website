"use client";

import type { ReactNode } from "react";
import { AdminFormError } from "../../ui/AdminFormRuntime";
import { AdminFormListboxSelect } from "../../ui";
import TopicDateLabelField from "./article/TopicDateLabelField";
import TopicFormSwitch from "./article/TopicFormSwitch";

const CONTENT_STATUS_OPTIONS = [
  { value: "draft", label: "مسودة" },
  { value: "published", label: "منشور" },
  { value: "unpublished", label: "مخفي" },
  { value: "archived", label: "أرشيف" },
] as const;

export default function ContentPublishingOptions({
  status = "draft",
  featured = false,
  popular,
  publishedAt,
  dateLabel,
  children,
}: {
  status?: string | null;
  featured?: boolean;
  popular?: boolean;
  publishedAt?: string | null;
  dateLabel?: string | null;
  children?: ReactNode;
}) {
  return (
    <section
      className="rounded-[24px] border border-white/10 bg-[#080B10]/92 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.24)] md:p-6"
      data-content-publishing-options
      data-content-publishing-presentation="integrated"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:items-stretch">
        <div>
          <AdminFormListboxSelect
            name="status"
            focusTargetId="content-status"
            label="الحالة"
            hint="تتحقق قواعد الجاهزية قبل قبول حالة منشور."
            options={CONTENT_STATUS_OPTIONS}
            defaultValue={status ?? "draft"}
          />
          <AdminFormError name="status" />
        </div>
        <TopicFormSwitch
          name="is_featured"
          label="محتوى مميز"
          defaultChecked={featured}
          surface
          className="h-full"
        />
        {popular !== undefined ? (
          <TopicFormSwitch
            name="is_popular"
            label="محتوى شائع"
            defaultChecked={popular}
            surface
            className="h-full"
          />
        ) : null}
        {dateLabel !== undefined || publishedAt ? (
          <TopicDateLabelField
            defaultValue={dateLabel}
            publishedAt={publishedAt}
            disabled={Boolean(publishedAt)}
            className="h-full border-[#D8B87A]/30 bg-[#D8B87A]/[0.06] px-4 py-4"
          />
        ) : null}
      </div>

      {children ? (
        <div className="mt-5 border-t border-white/10 pt-5">
          {children}
        </div>
      ) : null}
    </section>
  );
}
