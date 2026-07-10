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
import AdminMediaAltWarning from "../../../../components/admin/media-intelligence/AdminMediaAltWarning";
import { mediaRowToPublishInput } from "../../../../lib/admin/content-workflow/media-publish-validation";

type MediaContentFormValues = {
  id?: number;
  title?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  content?: string | null;
  image?: string | null;
  image_alt?: string | null;
  category_slug?: string | null;
  status?: string | null;
  is_featured?: boolean | null;
  media_payload?: MediaTopicPayload | null;
  seo_title?: string | null;
  seo_description?: string | null;
  focus_keyword?: string | null;
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
      image_alt: values?.image_alt,
      category_slug: values?.category_slug ?? selectedSection,
      content_type: selectedOption?.contentType ?? "news",
      media_payload: values?.media_payload,
    }) ?? {
      title: "",
      slug: "",
      excerpt: "",
      content: "",
      image: "",
      imageAlt: "",
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

                <AdminFormField
                  label="قسم المركز الإعلامي"
                  hint="يحدد نوع المحتوى والحقول المتاحة — لا يمكن تغييره بسهولة بعد الإنشاء."
                  required
                >
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

                <AdminFormField
                  label="الحالة"
                  hint="مسودة: غير مرئية. منشور: متاح للعرض. مخفي: محفوظ لكن غير معروض. أرشيف: غير نشط."
                >
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

                <AdminFormField
                  label="محتوى مميز"
                  hint="يُبرز هذا المحتوى في مواقع بارزة داخل المركز الإعلامي."
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white/70">تفعيل التمييز</span>
                    <input
                      type="checkbox"
                      name="is_featured"
                      defaultChecked={Boolean(values?.is_featured)}
                      aria-label="تفعيل التمييز"
                      className="h-4 w-4 accent-[#D8B87A]"
                    />
                  </div>
                </AdminFormField>
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

              {showTextFields ? (
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="text-sm font-medium text-white/70">وصف الصورة Alt Text</span>
                    <input
                      name="image_alt"
                      defaultValue={values?.image_alt ?? ""}
                      placeholder="وصف مختصر للصورة يساعد SEO وإتاحة الوصول"
                      className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
                    />
                  </label>
                  <AdminMediaAltWarning formId={formId} requiredForPublish={showTextFields} />
                </div>
              ) : null}
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

            <AdminFormField label="الموجز" hint="اختياري — يظهر في قوائم المركز الإعلامي وبطاقات المحتوى.">
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
            description="YouTube فقط — الرابط مطلوب عند النشر، والمدة والصورة المصغّرة اختياريان."
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
            description="أضف روابط الصور مع alt وcaption اختياريين. صورة واحدة على الأقل مطلوبة عند النشر."
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

      <AdminFormSection
        eyebrow="SEO"
        title="إعدادات السيو"
        description="حقول اختيارية لعنوان ووصف محركات البحث. إن تُركت فارغة يُستخدم العنوان والموجز."
        compactHeader
        className="border-[#D8B87A]/12"
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <AdminFormField label="SEO Title">
            <input
              name="seo_title"
              defaultValue={values?.seo_title ?? ""}
              placeholder="عنوان يظهر في نتائج البحث..."
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
            />
          </AdminFormField>

          <AdminFormField label="Focus Keyword">
            <input
              name="focus_keyword"
              defaultValue={values?.focus_keyword ?? ""}
              placeholder="الكلمة الرئيسية المستهدفة"
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
            />
          </AdminFormField>
        </div>

        <AdminFormField label="Meta Description">
          <textarea
            name="seo_description"
            rows={4}
            defaultValue={values?.seo_description ?? ""}
            placeholder="وصف مختصر يظهر في نتائج البحث..."
            className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
          />
        </AdminFormField>
      </AdminFormSection>

      <AdminStickyFormBar
        title={mode === "edit" ? "حفظ التعديلات" : "إنشاء المحتوى"}
        description={
          mode === "edit"
            ? "يُحفظ التعديل فورًا عند الضغط على «حفظ التعديلات» دون مغادرة الصفحة."
            : "يُنشأ المحتوى كمسودة ما لم تغيّر الحالة. تأكد من اختيار القسم الصحيح — الحقول تتغير حسب النوع."
        }
      >
        <AdminActionButton href="/admin/content/media" variant="dark">
          {mode === "edit" ? "رجوع للقائمة" : "إلغاء والعودة للقائمة"}
        </AdminActionButton>
        <button
          type="submit"
          aria-label={mode === "edit" ? "حفظ التعديلات" : "إنشاء المحتوى"}
          className="rounded-full bg-[#D8B87A] px-6 py-3 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]"
        >
          {mode === "edit" ? "حفظ التعديلات" : "إنشاء المحتوى"}
        </button>
      </AdminStickyFormBar>
    </form>
    </>
  );
}
