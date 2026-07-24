"use client";

import { useOptionalAdminFormRuntime } from "../../../ui/AdminFormRuntime";
import TopicDateLabelField from "./TopicDateLabelField";
import TopicFormSwitch from "./TopicFormSwitch";

export default function TopicPublishingOptions({
  status,
  featured = false,
  popular = false,
  publishedAt,
  dateLabel,
}: {
  status?: string;
  featured?: boolean;
  popular?: boolean;
  publishedAt?: string | null;
  dateLabel?: string | null;
}) {
  const pending = useOptionalAdminFormRuntime()?.pending ?? false;
  const isPublished = status === "published";

  return (
    <section
      className="rounded-2xl border border-white/10 bg-[#080B10]/92 p-5"
      data-topic-publishing-options
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">إجراءات النشر</h3>
          <p className="mt-1 text-xs text-white/40">
            تُطبّق حالة النشر مع باقي بيانات الموضوع عند الضغط على حفظ.
          </p>
        </div>
        {status ? (
          <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55">
            الحالة: {status}
          </span>
        ) : null}
      </div>

      <div
        className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:items-stretch"
        data-topic-publishing-actions-row
      >
        <TopicFormSwitch
          name="is_featured"
          label="موضوع مميز"
          defaultChecked={featured}
          disabled={pending}
          surface
        />
        <TopicFormSwitch
          name="is_popular"
          label="موضوع شائع"
          defaultChecked={popular}
          disabled={pending}
          surface
        />
        <TopicFormSwitch
          id="topic-published-switch"
          name="is_published"
          label="منشور"
          defaultChecked={isPublished}
          disabled={pending}
          surface
        />
        <TopicDateLabelField
          defaultValue={dateLabel}
          publishedAt={publishedAt}
          disabled={pending || Boolean(publishedAt)}
        />
      </div>

    </section>
  );
}
