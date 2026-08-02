"use client";

import type { ReactNode } from "react";

import { useOptionalAdminFormRuntime } from "../../../ui/AdminFormRuntime";
import TopicDateLabelField from "./TopicDateLabelField";
import TopicFormSwitch from "./TopicFormSwitch";

export default function TopicPublishingOptions({
  status,
  featured = false,
  popular = false,
  publishedAt,
  dateLabel,
  children,
}: {
  status?: string;
  featured?: boolean;
  popular?: boolean;
  publishedAt?: string | null;
  dateLabel?: string | null;
  children?: ReactNode;
}) {
  const pending = useOptionalAdminFormRuntime()?.pending ?? false;
  const isPublished = status === "published";

  return (
    <section
      className="rounded-[24px] border border-white/10 bg-[#080B10]/92 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.24)] md:p-6"
      data-topic-publishing-options
      data-topic-publishing-presentation="integrated"
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
          className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:items-stretch"
          data-topic-publishing-actions-row
        >
          <div className="contents" data-topic-publishing-simple-options>
            <TopicFormSwitch
              name="is_featured"
              label="موضوع مميز"
              defaultChecked={featured}
              disabled={pending}
              surface
              className="h-full"
            />
            <TopicFormSwitch
              name="is_popular"
              label="موضوع شائع"
              defaultChecked={popular}
              disabled={pending}
              surface
              className="h-full"
            />
          </div>

          <div className="contents" data-topic-publishing-decision-options>
            <TopicFormSwitch
              id="topic-published-switch"
              name="is_published"
              label="منشور"
              defaultChecked={isPublished}
              disabled={pending}
              surface
              className="h-full border-[#D8B87A]/30 bg-[#D8B87A]/[0.06] px-4 py-4"
            />
            <TopicDateLabelField
              defaultValue={dateLabel}
              publishedAt={publishedAt}
              disabled={pending || Boolean(publishedAt)}
              className="h-full border-[#D8B87A]/30 bg-[#D8B87A]/[0.06] px-4 py-4"
            />
          </div>
        </div>

        {children ? (
          <div className="mt-5 border-t border-white/10 pt-5" data-topic-publishing-review-slot>
            {children}
          </div>
        ) : null}
    </section>
  );
}
