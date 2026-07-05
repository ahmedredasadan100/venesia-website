"use client";

import { useState } from "react";
import AdminMediaImageField from "../../../../components/admin/media/AdminMediaImageField";
import { AdminActionButton } from "../../../../components/admin/ui";
import type { MediaTopicPayload } from "../../../../lib/admin/media-topic-payload";
import TopicMarkdownEditor from "../../topics/TopicMarkdownEditor";
import TopicSlugInput from "../../topics/TopicSlugInput";
import { createMediaContent, updateMediaContent } from "./actions";
import MediaGalleryFields from "./MediaGalleryFields";
import { isTextMediaSectionSlug, MEDIA_SECTION_OPTIONS } from "./media-content-config";
import MediaVideoFields from "./MediaVideoFields";

type MediaContentFormValues = {
  id?: number;
  title?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  content?: string | null;
  image?: string | null;
  category_slug?: string | null;
  status?: string | null;
  is_featured?: boolean | null;
  media_payload?: MediaTopicPayload | null;
};

type MediaContentFormProps = {
  mode: "create" | "edit";
  values?: MediaContentFormValues | null;
};

const DEFAULT_CONTENT = "# عنوان المحتوى\n\nابدأ كتابة المحتوى هنا...\n\n## عنوان فرعي\n\nاكتب الفقرة هنا...";

function getInitialSection(values?: MediaContentFormValues | null) {
  return values?.category_slug ?? "";
}

function getVideoDefaults(payload?: MediaTopicPayload | null) {
  if (!payload || payload.kind !== "video") {
    return { videoUrl: "", duration: "", thumbnail: "" };
  }

  return {
    videoUrl: payload.video_url,
    duration: payload.duration ?? "",
    thumbnail: payload.thumbnail ?? "",
  };
}

function getGalleryDefaults(payload?: MediaTopicPayload | null) {
  if (!payload || payload.kind !== "gallery") return [];
  return payload.images;
}

export default function MediaContentForm({ mode, values }: MediaContentFormProps) {
  const action = mode === "edit" ? updateMediaContent : createMediaContent;
  const content = values?.content?.trim() ? values.content : DEFAULT_CONTENT;
  const [selectedSection, setSelectedSection] = useState(getInitialSection(values));
  const showTextFields = isTextMediaSectionSlug(selectedSection);
  const showVideoFields = selectedSection === "media-videos";
  const showGalleryFields = selectedSection === "media-gallery";
  const videoDefaults = getVideoDefaults(values?.media_payload);
  const galleryDefaults = getGalleryDefaults(values?.media_payload);

  return (
    <form action={action} className="space-y-7" noValidate>
      {values?.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <section className="rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="grid gap-6 lg:grid-cols-2">
          <label className="block lg:col-span-2">
            <span className="text-sm font-medium text-white/70">العنوان</span>
            <input
              name="title"
              required
              defaultValue={values?.title ?? ""}
              placeholder="اكتب عنوان المحتوى الإعلامي، مثل: Venesia تطلق بيانًا صحفيًا جديدًا"
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-xl font-semibold text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
            />
          </label>

          <TopicSlugInput defaultValue={values?.slug ?? ""} />

          <label className="block">
            <span className="text-sm font-medium text-white/70">قسم المركز الإعلامي</span>
            <select
              name="category_slug"
              required
              value={selectedSection}
              onChange={(event) => setSelectedSection(event.target.value)}
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45"
            >
              <option value="">اختر القسم</option>
              {MEDIA_SECTION_OPTIONS.map((option) => (
                <option key={option.slug} value={option.slug}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-white/70">الحالة</span>
            <select
              name="status"
              defaultValue={values?.status ?? "draft"}
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45"
            >
              <option value="draft">مسودة</option>
              <option value="published">منشور</option>
              <option value="unpublished">مخفي</option>
              <option value="archived">أرشيف</option>
            </select>
          </label>

          <label className="block lg:col-span-2">
            <span className="text-sm font-medium text-white/70">الموجز</span>
            <textarea
              name="excerpt"
              rows={4}
              defaultValue={values?.excerpt ?? ""}
              placeholder="ملخص قصير يظهر في قائمة المركز الإعلامي..."
              className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
            />
          </label>

          <div className="lg:col-span-2">
            <AdminMediaImageField
              name="image"
              label="الصورة الرئيسية"
              defaultValue={values?.image ?? ""}
              browseFolder="images/topics"
              dimensionHint="content"
              helperText={
                showGalleryFields
                  ? "اختياري — إن تُركت فارغة تُستخدم أول صورة من المعرض."
                  : showVideoFields
                    ? "اختياري — إن تُركت فارغة تُستخدم الصورة المصغّرة للفيديو."
                    : "اختر صورة من المكتبة أو ارفع صورة جديدة — يتم حفظ المسار تلقائيًا."
              }
            />
          </div>

          <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3 lg:col-span-2">
            <span className="text-sm font-medium text-white/70">مميز</span>
            <input
              type="checkbox"
              name="is_featured"
              defaultChecked={Boolean(values?.is_featured)}
              className="h-4 w-4 accent-[#D8B87A]"
            />
          </label>
        </div>
      </section>

      {showVideoFields ? (
        <section className="rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white">بيانات الفيديو</h2>
            <p className="mt-1 text-sm text-white/45">YouTube فقط — media_payload يُحفظ في topics.</p>
          </div>
          <MediaVideoFields
            defaultVideoUrl={videoDefaults.videoUrl}
            defaultDuration={videoDefaults.duration}
            defaultThumbnail={videoDefaults.thumbnail}
          />
          <input type="hidden" name="content" value="" />
        </section>
      ) : null}

      {showGalleryFields ? (
        <section className="rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white">معرض الصور</h2>
            <p className="mt-1 text-sm text-white/45">أضف روابط الصور مع alt وcaption اختياريين.</p>
          </div>
          <MediaGalleryFields defaultImages={galleryDefaults} />
          <input type="hidden" name="content" value="" />
        </section>
      ) : null}

      {showTextFields ? (
        <section className="rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white">المحتوى</h2>
            <p className="mt-1 text-sm text-white/45">اكتب المحتوى بصيغة Markdown.</p>
          </div>
          <TopicMarkdownEditor defaultValue={content} />
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <AdminActionButton href="/admin/content/media" variant="dark">
          إلغاء
        </AdminActionButton>
        <button
          type="submit"
          className="rounded-full bg-[#D8B87A] px-6 py-3 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]"
        >
          {mode === "edit" ? "حفظ التعديلات" : "إنشاء المحتوى"}
        </button>
      </div>
    </form>
  );
}
