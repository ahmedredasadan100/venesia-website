"use client";

import { useState } from "react";
import { AdminFormError } from "../../ui/AdminFormRuntime";
import AdminFormSwitch from "../../ui/AdminFormSwitch";
import TopicDateLabelField from "./article/TopicDateLabelField";
import TopicFormSwitch from "./article/TopicFormSwitch";

function formatPublishTime(value?: string | null) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Africa/Cairo",
    }).format(new Date(value));
  } catch {
    return null;
  }
}

export default function ContentPublishingOptions({
  status = "draft",
  featured = false,
  popular = false,
  publishedAt,
  dateLabel,
}: {
  status?: string | null;
  featured?: boolean;
  popular?: boolean;
  publishedAt?: string | null;
  dateLabel?: string | null;
}) {
  const [published, setPublished] = useState(status === "published");
  const unpublishedStatus = status === "archived"
    ? "archived"
    : status === "draft"
      ? "draft"
      : "unpublished";
  const lastPublishTime = formatPublishTime(publishedAt);

  return (
    <>
      <article
        className="flex min-w-0 flex-col rounded-[22px] border border-white/10 bg-[#090D13]/88 p-4"
        data-content-publishing-options
        data-content-review-decision="publication-schedule"
      >
        <input type="hidden" name="status" value={published ? "published" : unpublishedStatus} />
        <div>
          <p className="text-sm font-semibold text-white/82">حالة النشر والتاريخ</p>
          <p className="mt-1 text-xs leading-5 text-white/38">
            حالة المحتوى وموعد ظهوره العام.
          </p>
        </div>
        <AdminFormSwitch
          id="content-status"
          name="content_publication_toggle"
          label={published ? "منشور" : "غير منشور"}
          checked={published}
          onChange={(event) => setPublished(event.target.checked)}
          surface
          className="mt-3 border-white/8 bg-black/20 px-3 py-2.5"
          describedBy="content-publication-hint"
        />
        <div className="mt-2">
          <TopicDateLabelField
            defaultValue={dateLabel}
            publishedAt={publishedAt}
            disabled={Boolean(publishedAt)}
            className="border-white/8 bg-black/20 px-3 py-3"
          />
        </div>
        <p className="mt-2 text-[10px] leading-5 text-white/38">
          {lastPublishTime ? `آخر نشر · ${lastPublishTime}` : "لم يُنشر بعد"}
        </p>
        <p id="content-publication-hint" className="mt-1 text-[10px] leading-5 text-white/32">
          الأرشفة عملية مستقلة من إجراءات قائمة المحتوى.
        </p>
        <AdminFormError name="status" />
      </article>

      <article
        className="flex min-w-0 flex-col rounded-[22px] border border-white/10 bg-[#090D13]/88 p-4"
        data-content-review-decision="featured-popular"
      >
        <div>
          <p className="text-sm font-semibold text-white/82">التمييز والانتشار</p>
          <p className="mt-1 text-xs leading-5 text-white/38">تحكم مباشر في المميز والشائع.</p>
        </div>
        <div className="mt-3 space-y-2">
          <div data-content-review-field="featured">
            <TopicFormSwitch
              name="is_featured"
              label="مميز"
              defaultChecked={featured}
              surface
              className="border-white/8 bg-black/20 px-3 py-2.5"
            />
          </div>
          <div data-content-review-field="popular">
            <TopicFormSwitch
              name="is_popular"
              label="شائع"
              defaultChecked={popular}
              surface
              className="border-white/8 bg-black/20 px-3 py-2.5"
            />
          </div>
        </div>
      </article>
    </>
  );
}
