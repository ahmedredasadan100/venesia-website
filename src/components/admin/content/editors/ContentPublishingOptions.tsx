"use client";

import { useState } from "react";
import { AdminFormError } from "../../ui/AdminFormRuntime";
import AdminFormSwitch from "../../ui/AdminFormSwitch";
import { AdminEntityReviewDecisionCard } from "../../review/AdminEntityReviewPanel";
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
  status = "unpublished",
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
  const lastPublishTime = formatPublishTime(publishedAt);

  return (
    <>
      <AdminEntityReviewDecisionCard
        id="publication-schedule"
        title="حالة النشر والتاريخ"
        description="حالة المحتوى وموعد ظهوره العام."
      >
        <input
          type="hidden"
          name="status"
          value={published ? "published" : "unpublished"}
          data-content-publishing-options
        />
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
          غير المنشور لا يظهر للعامة ويمكن تحريره في أي وقت.
        </p>
        <AdminFormError name="status" />
      </AdminEntityReviewDecisionCard>

      <AdminEntityReviewDecisionCard
        id="featured-popular"
        title="التمييز والانتشار"
        description="تحكم مباشر في المميز والشائع."
      >
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
      </AdminEntityReviewDecisionCard>
    </>
  );
}
