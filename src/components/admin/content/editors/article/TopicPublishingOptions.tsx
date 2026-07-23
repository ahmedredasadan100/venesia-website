"use client";

import Link from "next/link";

import { useOptionalAdminFormRuntime } from "../../../ui/AdminFormRuntime";
import TopicDateLabelField from "./TopicDateLabelField";
import TopicFormSwitch from "./TopicFormSwitch";

export default function TopicPublishingOptions({
  status,
  featured = false,
  popular = false,
  publishedAt,
  dateLabel,
  topicId,
  slug,
}: {
  status?: string;
  featured?: boolean;
  popular?: boolean;
  publishedAt?: string | null;
  dateLabel?: string | null;
  topicId?: number;
  slug?: string | null;
}) {
  const pending = useOptionalAdminFormRuntime()?.pending ?? false;
  const isPublished = status === "published";
  const previewLinkClassName = `inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/70 transition ${
    pending
      ? "pointer-events-none opacity-45"
      : "hover:border-white/30 hover:text-white"
  }`;

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
        <div id="topic-published-switch" className="min-w-0">
          <TopicFormSwitch
            name="is_published"
            label="منشور"
            defaultChecked={isPublished}
            disabled={pending}
            surface
          />
        </div>
        <TopicDateLabelField
          defaultValue={dateLabel}
          publishedAt={publishedAt}
          disabled={pending}
        />
      </div>

      {topicId ? (
        <div className="mt-5 flex flex-wrap gap-3" data-topic-preview-links>
          <Link
            href={`/admin/content/topics/${topicId}/preview`}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={pending || undefined}
            tabIndex={pending ? -1 : undefined}
            onClick={pending ? (event) => event.preventDefault() : undefined}
            className={previewLinkClassName}
          >
            معاينة داخلية
          </Link>
          {isPublished && slug ? (
            <Link
              href={`/topics/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={pending || undefined}
              tabIndex={pending ? -1 : undefined}
              onClick={pending ? (event) => event.preventDefault() : undefined}
              className={previewLinkClassName}
            >
              النسخة العامة
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
