"use client";

import { useState, type ReactNode } from "react";
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
  children,
}: {
  status?: string | null;
  featured?: boolean;
  popular?: boolean;
  publishedAt?: string | null;
  dateLabel?: string | null;
  children?: ReactNode;
}) {
  const [published, setPublished] = useState(status === "published");
  const unpublishedStatus = status === "archived"
    ? "archived"
    : status === "draft"
      ? "draft"
      : "unpublished";

  return (
    <section
      className="rounded-[24px] border border-white/10 bg-[#080B10]/92 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.24)] md:p-6"
      data-content-publishing-options
      data-content-publishing-presentation="integrated"
    >
      <input type="hidden" name="status" value={published ? "published" : unpublishedStatus} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:items-stretch">
        <div>
          <AdminFormSwitch
            id="content-status"
            name="content_publication_toggle"
            label={published ? "منشور" : "غير منشور"}
            checked={published}
            onChange={(event) => setPublished(event.target.checked)}
            surface
            className="h-full"
            describedBy="content-publication-hint"
          />
          <p id="content-publication-hint" className="mt-2 px-1 text-[11px] leading-5 text-white/38">
            الأرشفة عملية مستقلة من إجراءات قائمة المحتوى.
          </p>
          <AdminFormError name="status" />
        </div>
        <TopicFormSwitch
          name="is_featured"
          label="محتوى مميز"
          defaultChecked={featured}
          surface
          className="h-full"
        />
        <TopicFormSwitch
          name="is_popular"
          label="محتوى شائع"
          defaultChecked={popular}
          surface
          className="h-full"
        />
        <TopicDateLabelField
          defaultValue={dateLabel}
          publishedAt={publishedAt}
          disabled={Boolean(publishedAt)}
          className="h-full border-[#D8B87A]/30 bg-[#D8B87A]/[0.06] px-4 py-4"
        />
      </div>

      {children ? (
        <div className="mt-5 border-t border-white/10 pt-5">
          {children}
        </div>
      ) : null}
    </section>
  );
}
