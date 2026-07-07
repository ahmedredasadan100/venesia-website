"use client";

import { useState } from "react";
import AdminMediaImageField from "../../../../components/admin/media/AdminMediaImageField";
import {
  AdminActionButton,
  AdminFormField,
  AdminFormLayout,
  AdminFormSection,
  AdminStickyFormBar,
} from "../../../../components/admin/ui";
import type { MediaTopicPayload } from "../../../../lib/admin/media-topic-payload";
import TopicMarkdownEditor from "../../topics/TopicMarkdownEditor";
import TopicSlugInput from "../../topics/TopicSlugInput";
import { createMediaContent, updateMediaContent } from "./actions";
import MediaContentTypeBadge, { getSectionTypeHint } from "./MediaContentTypeBadge";
import MediaGalleryFields from "./MediaGalleryFields";
import { isTextMediaSectionSlug, MEDIA_SECTION_OPTIONS } from "./media-content-config";
import MediaVideoFields from "./MediaVideoFields";
import ContentTemplatePicker from "../../../../components/admin/content-workflow/ContentTemplatePicker";
import MediaPublishChecklistPanel from "../../../../components/admin/content-workflow/MediaPublishChecklistPanel";
import { mediaRowToPublishInput } from "../../../../lib/admin/content-workflow/media-publish-validation";

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
  const formId = mode === "edit" ? "media-content-form" : "media-content-form-create";
  const publishInitial =
    mediaRowToPublishInput({
      title: values?.title,
      slug: values?.slug,
      excerpt: values?.excerpt,
      content: values?.content,
      image: values?.image,
      category_slug: values?.category_slug ?? selectedSection,
      content_type: selectedOption?.contentType ?? "news",
      media_payload: values?.media_payload,
    }) ?? {
      title: "",
      slug: "",
      excerpt: "",
      content: "",
      image: "",
      categorySlug: selectedSection,
      contentType: "news" as const,
      mediaPayload: null,
    };

  return (
    <>
      {mode === "create" ? <ContentTemplatePicker target="media" formId={formId} /> : null}

      <form id={formId} action={action} className="space-y-7" noValidate>
      {values?.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <AdminFormLayout
        aside={
          <>
            <AdminFormSection eyebrow="PUBLISHING" title="القسم والنشر">
              <div className="space-y-4">
                <SectionTypeHint sectionSlug={selectedSection} />

                <AdminFormField label="قسم المركز الإعلامي" required>
                  <select
                    name="category_slug"
                    required
                    value={selectedSection}
                    onChange={(event) => setSelectedSection(event.currentTarget.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45"
                  >
                    <option value="">اختر القسم</option>
                    {MEDIA_SECTION_OPTIONS.map((option) => (
                      <option key={option.slug} value={option.slug}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </AdminFormField>

                <AdminFormField label="الحالة">
                  <select
                    name="status"
                    defaultValue={values?.status ?? "draft"}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45"
                  >
                    <option value="draft">مسودة</option>
                    <option value="published">منشور</option>
                    <option value="unpublished">مخفي</option>
                    <option value="archived">أرشيف</option>
                  </select>
                </AdminFormField>

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
            </AdminFormSection>

            <AdminFormSection eyebrow="COVER" title="الصورة الرئيسية">
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
            </AdminFormSection>

            <MediaPublishChecklistPanel formId={formId} initial={publishInitial} />
          </>
        }
      >
        <AdminFormSection
          eyebrow="CONTENT"
          title="البيانات الأساسية"
          actions={selectedOption ? <MediaContentTypeBadge contentType={selectedOption.contentType} compact /> : null}
        >
          <div className="grid gap-6">
            <AdminFormField label="العنوان" required>
              <input
                name="title"
                required
                defaultValue={values?.title ?? ""}
                placeholder="مثال: Venesia تطلق بيانًا صحفيًا جديدًا"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-xl font-semibold text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
              />
            </AdminFormField>

            <TopicSlugInput defaultValue={values?.slug ?? ""} />

            <AdminFormField label="الموجز">
              <textarea
                name="excerpt"
                rows={4}
                defaultValue={values?.excerpt ?? ""}
                placeholder="ملخص قصير يظهر في قائمة المركز الإعلامي وبطاقات المحتوى..."
                className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
              />
            </AdminFormField>
          </div>
        </AdminFormSection>

        {showVideoFields ? (
          <AdminFormSection
            eyebrow="VIDEO PAYLOAD"
            eyebrowClassName="text-rose-200/60"
            title="بيانات الفيديو"
            description="YouTube فقط — يُحفظ في media_payload داخل topics."
            compactHeader
            className="border-rose-400/12"
          >
            <MediaVideoFields
              defaultVideoUrl={videoDefaults.videoUrl}
              defaultDuration={videoDefaults.duration}
              defaultThumbnail={videoDefaults.thumbnail}
            />
            <input type="hidden" name="content" value="" />
          </AdminFormSection>
        ) : null}

        {showGalleryFields ? (
          <AdminFormSection
            eyebrow="GALLERY PAYLOAD"
            eyebrowClassName="text-amber-200/60"
            title="معرض الصور"
            description="أضف روابط الصور مع alt وcaption اختياريين."
            compactHeader
            className="border-amber-400/12"
          >
            <MediaGalleryFields defaultImages={galleryDefaults} />
            <input type="hidden" name="content" value="" />
          </AdminFormSection>
        ) : null}

        {showTextFields ? (
          <AdminFormSection
            eyebrow="MARKDOWN"
            eyebrowClassName="text-sky-200/60"
            title="المحتوى النصي"
            description="اكتب المحتوى بصيغة Markdown."
            compactHeader
            className="border-sky-400/12"
          >
            <TopicMarkdownEditor defaultValue={content} />
          </AdminFormSection>
        ) : null}
      </AdminFormLayout>

      <AdminStickyFormBar
        title={mode === "edit" ? "حفظ التعديلات" : "إنشاء المحتوى"}
        description="تأكد من اختيار القسم الصحيح قبل الحفظ — الحقول تتغير حسب نوع المحتوى."
      >
        <AdminActionButton href="/admin/content/media" variant="dark">
          {mode === "edit" ? "رجوع للقائمة" : "إلغاء"}
        </AdminActionButton>
        <button
          type="submit"
          className="rounded-full bg-[#D8B87A] px-6 py-3 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]"
        >
          {mode === "edit" ? "حفظ التعديلات" : "إنشاء المحتوى"}
        </button>
      </AdminStickyFormBar>
    </form>
    </>
  );
}
