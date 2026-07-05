"use client";

import { useState } from "react";
import AdminMediaImageField from "../../../../components/admin/media/AdminMediaImageField";
import { AdminActionButton } from "../../../../components/admin/ui";
import type { MediaTopicPayload } from "../../../../lib/admin/media-topic-payload";
import TopicMarkdownEditor from "../../topics/TopicMarkdownEditor";
import TopicSlugInput from "../../topics/TopicSlugInput";
import { createMediaContent, updateMediaContent } from "./actions";
import MediaContentTypeBadge, { getSectionTypeHint } from "./MediaContentTypeBadge";
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

function SectionTypeHint({ sectionSlug }: { sectionSlug: string }) {
  const hint = getSectionTypeHint(sectionSlug);
  if (!hint) {
    return (
      <div className="rounded-[22px] border border-dashed border-white/12 bg-black/15 px-4 py-4 text-sm text-white/42">
        اختر قسم المركز الإعلامي لعرض الحقول المناسبة لهذا النوع.
      </div>
    );
  }

  const toneClass =
    hint.tone === "video"
      ? "border-rose-400/18 bg-rose-500/8"
      : hint.tone === "gallery"
        ? "border-amber-400/18 bg-amber-500/8"
        : "border-sky-400/18 bg-sky-500/8";

  return (
    <div className={`rounded-[22px] border px-4 py-4 ${toneClass}`}>
      <p className="text-sm font-semibold text-white">{hint.title}</p>
      <p className="mt-1 text-xs leading-6 text-white/48">{hint.description}</p>
    </div>
  );
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
  const selectedOption = MEDIA_SECTION_OPTIONS.find((option) => option.slug === selectedSection);

  return (
    <form action={action} className="space-y-7" noValidate>
      {values?.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <section className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-7">
          <section className="rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-en text-xs tracking-[0.28em] text-[#D8B87A]/70">CONTENT</p>
                <h2 className="mt-2 text-xl font-semibold text-white">البيانات الأساسية</h2>
              </div>
              {selectedOption ? <MediaContentTypeBadge contentType={selectedOption.contentType} compact /> : null}
            </div>

            <div className="grid gap-6">
              <label className="block">
                <span className="text-sm font-medium text-white/70">العنوان</span>
                <input
                  name="title"
                  required
                  defaultValue={values?.title ?? ""}
                  placeholder="مثال: Venesia تطلق بيانًا صحفيًا جديدًا"
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-xl font-semibold text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
                />
              </label>

              <TopicSlugInput defaultValue={values?.slug ?? ""} />

              <label className="block">
                <span className="text-sm font-medium text-white/70">الموجز</span>
                <textarea
                  name="excerpt"
                  rows={4}
                  defaultValue={values?.excerpt ?? ""}
                  placeholder="ملخص قصير يظهر في قائمة المركز الإعلامي وبطاقات المحتوى..."
                  className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
                />
              </label>
            </div>
          </section>

          {showVideoFields ? (
            <section className="rounded-[28px] border border-rose-400/12 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
              <div className="mb-4">
                <p className="font-en text-xs tracking-[0.28em] text-rose-200/60">VIDEO PAYLOAD</p>
                <h2 className="mt-2 text-lg font-bold text-white">بيانات الفيديو</h2>
                <p className="mt-1 text-sm text-white/45">YouTube فقط — يُحفظ في media_payload داخل topics.</p>
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
            <section className="rounded-[28px] border border-amber-400/12 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
              <div className="mb-4">
                <p className="font-en text-xs tracking-[0.28em] text-amber-200/60">GALLERY PAYLOAD</p>
                <h2 className="mt-2 text-lg font-bold text-white">معرض الصور</h2>
                <p className="mt-1 text-sm text-white/45">أضف روابط الصور مع alt وcaption اختياريين.</p>
              </div>
              <MediaGalleryFields defaultImages={galleryDefaults} />
              <input type="hidden" name="content" value="" />
            </section>
          ) : null}

          {showTextFields ? (
            <section className="rounded-[28px] border border-sky-400/12 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
              <div className="mb-4">
                <p className="font-en text-xs tracking-[0.28em] text-sky-200/60">MARKDOWN</p>
                <h2 className="mt-2 text-lg font-bold text-white">المحتوى النصي</h2>
                <p className="mt-1 text-sm text-white/45">اكتب المحتوى بصيغة Markdown.</p>
              </div>
              <TopicMarkdownEditor defaultValue={content} />
            </section>
          ) : null}
        </div>

        <aside className="space-y-7">
          <section className="rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <p className="font-en text-xs tracking-[0.28em] text-[#D8B87A]/70">PUBLISHING</p>
            <h3 className="mt-2 text-xl font-semibold text-white">القسم والنشر</h3>

            <div className="mt-6 space-y-4">
              <SectionTypeHint sectionSlug={selectedSection} />

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

              <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
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

          <section className="rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <p className="font-en text-xs tracking-[0.28em] text-[#D8B87A]/70">COVER</p>
            <h3 className="mt-2 text-xl font-semibold text-white">الصورة الرئيسية</h3>
            <div className="mt-6">
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
          </section>
        </aside>
      </section>

      <div className="sticky bottom-5 z-40 rounded-[26px] border border-white/10 bg-[#080B10]/95 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">
              {mode === "edit" ? "حفظ التعديلات" : "إنشاء المحتوى"}
            </p>
            <p className="mt-1 text-xs text-white/45">
              تأكد من اختيار القسم الصحيح قبل الحفظ — الحقول تتغير حسب نوع المحتوى.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <AdminActionButton href="/admin/content/media" variant="dark">
              {mode === "edit" ? "رجوع للقائمة" : "إلغاء"}
            </AdminActionButton>
            <button
              type="submit"
              className="rounded-full bg-[#D8B87A] px-6 py-3 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]"
            >
              {mode === "edit" ? "حفظ التعديلات" : "إنشاء المحتوى"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
