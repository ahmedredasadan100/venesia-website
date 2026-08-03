"use client";

import { useState } from "react";
import { AdminFormError } from "../../ui/AdminFormRuntime";
import AdminFormSwitch from "../../ui/AdminFormSwitch";
import TopicDateLabelField from "./article/TopicDateLabelField";
import TopicFormSwitch from "./article/TopicFormSwitch";

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

  return (
    <>
      <input type="hidden" name="status" value={published ? "published" : unpublishedStatus} />
      <div className="min-w-0" data-content-publishing-options data-content-review-decision="publication-status">
        <AdminFormSwitch
          id="content-status"
          name="content_publication_toggle"
          label={published ? "منشور" : "غير منشور"}
          checked={published}
          onChange={(event) => setPublished(event.target.checked)}
          surface
          className="min-h-40"
          describedBy="content-publication-hint"
        />
        <p id="content-publication-hint" className="mt-2 px-1 text-[11px] leading-5 text-white/38">
          الأرشفة عملية مستقلة من إجراءات قائمة المحتوى.
        </p>
        <AdminFormError name="status" />
      </div>
      <div className="min-w-0" data-content-review-decision="featured">
        <TopicFormSwitch
          name="is_featured"
          label="مميز"
          defaultChecked={featured}
          surface
          className="min-h-40"
        />
      </div>
      <div className="min-w-0" data-content-review-decision="popular">
        <TopicFormSwitch
          name="is_popular"
          label="شائع"
          defaultChecked={popular}
          surface
          className="min-h-40"
        />
      </div>
      <div className="min-w-0" data-content-review-decision="publish-date">
        <TopicDateLabelField
          defaultValue={dateLabel}
          publishedAt={publishedAt}
          disabled={Boolean(publishedAt)}
          className="min-h-40 border-[#D8B87A]/30 bg-[#D8B87A]/[0.06] px-4 py-4"
        />
      </div>
    </>
  );
}
