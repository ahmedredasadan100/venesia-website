"use client";

import { useState } from "react";
import AdminMediaImageField from "../../../media/AdminMediaImageField";
import {
  AdminActionButton,
  AdminFormField,
  AdminFormLayout,
  AdminFormListboxSelect,
  AdminFormSection,
  AdminFormSwitch,
  AdminStickyFormBar,
  ADMIN_FORM_STACK_CLASS_NAME,
  adminFormFieldClassName,
} from "../../../ui";
import type { MediaTopicPayload } from "../../../../../lib/admin/media-topic-payload";
import TopicMarkdownEditor from "../article/TopicMarkdownEditor";
import TopicSlugInput from "../article/TopicSlugInput";
import { createMediaContent, updateMediaContent } from "../../../../../app/admin/content/topics/media-actions";
import MediaContentTypeBadge, { getSectionTypeHint } from "./MediaContentTypeBadge";
import MediaGalleryFields from "./MediaGalleryFields";
import {
  type MediaEditableContentType,
} from "./media-content-config";
import MediaVideoFields from "./MediaVideoFields";
import ContentTemplatePicker from "../../../content-workflow/ContentTemplatePicker";
import MediaPublishChecklistPanel from "../../../content-workflow/MediaPublishChecklistPanel";
import MediaEntitySeoPanel from "./MediaEntitySeoPanel";
import AdminMediaAltWarning from "../../../media-intelligence/AdminMediaAltWarning";
import { mediaRowToPublishInput } from "../../../../../lib/admin/content-workflow/media-publish-validation";

type MediaContentFormValues = {
  id?: number;
  title?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  content?: string | null;
  image?: string | null;
  image_alt?: string | null;
  category_id?: number | null;
  category_slug?: string | null;
  series_id?: number | null;
  status?: string | null;
  is_featured?: boolean | null;
  media_payload?: MediaTopicPayload | null;
  seo_title?: string | null;
  seo_description?: string | null;
  focus_keyword?: string | null;
  seo_keywords?: string[] | null;
  canonical_url?: string | null;
  robots_index?: boolean | null;
  robots_follow?: boolean | null;
  og_image?: string | null;
  og_image_alt?: string | null;
};

type MediaContentFormProps = {
  mode: "create" | "edit";
  values?: MediaContentFormValues | null;
  contentType: MediaEditableContentType;
  categories: Array<{
    id: number;
    name: string;
    slug: string;
    depth: number;
    is_active: boolean | null;
  }>;
  series: Array<{ id: number; name: string; status: string; deleted_at: string | null }>;
  returnPath?: string;
};

const DEFAULT_CONTENT = "# عنوان المحتوى\n\nابدأ كتابة المحتوى هنا...\n\n## عنوان فرعي\n\nاكتب الفقرة هنا...";

const MEDIA_STATUS_OPTIONS = [
  { value: "draft", label: "مسودة" },
  { value: "published", label: "منشور" },
  { value: "unpublished", label: "مخفي" },
  { value: "archived", label: "أرشيف" },
] as const;

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

function SectionTypeHint({ contentType }: { contentType: MediaEditableContentType }) {
  const hint = getSectionTypeHint(contentType);
  if (!hint) {
    return (
      <div className="rounded-[22px] border border-dashed border-white/12 bg-black/15 px-4 py-4 text-sm text-white/42">
        نوع المحتوى غير مدعوم.
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

export default function MediaContentForm({
  mode,
  values,
  contentType,
  categories,
  series,
  returnPath = "/admin/content/topics",
}: MediaContentFormProps) {
  const action = mode === "edit" ? updateMediaContent : createMediaContent;
  const content = values?.content?.trim() ? values.content : DEFAULT_CONTENT;
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    values?.category_id ? String(values.category_id) : "",
  );
  const showTextFields = contentType === "news" || contentType === "press" || contentType === "site_update";
  const showVideoFields = contentType === "video";
  const showGalleryFields = contentType === "gallery";
  const videoDefaults = getVideoDefaults(values?.media_payload);
  const galleryDefaults = getGalleryDefaults(values?.media_payload);
  const selectedCategory = categories.find((category) => String(category.id) === selectedCategoryId);
  const categoryOptions = categories.map((category) => ({
    value: String(category.id),
    label: `${"— ".repeat(category.depth)}${category.name}${!category.is_active ? " (غير مفعل)" : ""}`,
    disabled: !category.is_active && category.id !== values?.category_id,
  }));
  const seriesOptions = [
    { value: "", label: "بدون سلسلة" },
    ...series
      .filter(
        (item) =>
          (item.status === "published" && !item.deleted_at) ||
          item.id === values?.series_id,
      )
      .map((item) => ({
        value: String(item.id),
        label: item.name,
        disabled:
          (item.status !== "published" || Boolean(item.deleted_at)) &&
          item.id !== values?.series_id,
      })),
  ];
  const formId = mode === "edit" ? "media-content-form" : "media-content-form-create";
  const publishInitial =
    mediaRowToPublishInput({
      title: values?.title,
      slug: values?.slug,
      excerpt: values?.excerpt,
      content: values?.content,
      image: values?.image,
      image_alt: values?.image_alt,
      category_slug: selectedCategory?.slug ?? values?.category_slug ?? "",
      content_type: contentType,
      media_payload: values?.media_payload,
    }) ?? {
      title: "",
      slug: "",
      excerpt: "",
      content: "",
      image: "",
      imageAlt: "",
      categorySlug: selectedCategory?.slug ?? "",
      contentType,
      mediaPayload: null,
    };

  return (
    <>
      {mode === "create" ? <ContentTemplatePicker target="media" formId={formId} /> : null}

      <form id={formId} action={action} className={ADMIN_FORM_STACK_CLASS_NAME} noValidate>
      {values?.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <input type="hidden" name="content_type" value={contentType} />

      <AdminFormLayout
        aside={
          <>
            <AdminFormSection eyebrow="PUBLISHING" title="القسم والنشر">
              <div className="space-y-4">
                <SectionTypeHint contentType={contentType} />

                <AdminFormListboxSelect
                  name="category_id"
                  focusTargetId="media-category"
                  label="التصنيف"
                  hint="التصنيف تنظيمي ومستقل عن نوع المحرر، وتأتي الخيارات من قاعدة البيانات."
                  options={categoryOptions}
                  value={selectedCategoryId}
                  onChange={setSelectedCategoryId}
                  placeholder="اختر التصنيف"
                  required
                  searchable={categoryOptions.length > 7}
                  searchPlaceholder="ابحث في التصنيفات"
                  emptyMessage="لا توجد تصنيفات متاحة."
                />

                <AdminFormListboxSelect
                  name="series_id"
                  focusTargetId="media-series"
                  label="السلسلة"
                  hint="اختياري — ترتبط السلاسل بالمحتوى من قاعدة البيانات."
                  options={seriesOptions}
                  defaultValue={values?.series_id ? String(values.series_id) : ""}
                  placeholder="بدون سلسلة"
                  searchable={seriesOptions.length > 8}
                  searchPlaceholder="ابحث في السلاسل"
                />

                <AdminFormListboxSelect
                  name="status"
                  focusTargetId="media-status"
                  label="الحالة"
                  hint="مسودة: غير مرئية. منشور: متاح للعرض. مخفي: محفوظ لكن غير معروض. أرشيف: غير نشط."
                  options={MEDIA_STATUS_OPTIONS}
                  defaultValue={values?.status ?? "draft"}
                />

                <AdminFormSwitch
                  name="is_featured"
                  defaultChecked={Boolean(values?.is_featured)}
                  surface
                  label={
                    <>
                      <span className="block text-sm font-medium text-white/70">محتوى مميز</span>
                      <span className="mt-1 block text-xs text-white/42">
                        يُبرز هذا المحتوى في مواقع بارزة داخل المركز الإعلامي.
                      </span>
                    </>
                  }
                />
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
                  <AdminFormField label="وصف الصورة Alt Text">
                    <input
                      id="media-image-alt"
                      name="image_alt"
                      defaultValue={values?.image_alt ?? ""}
                      placeholder="وصف مختصر للصورة يساعد SEO وإتاحة الوصول"
                      className={adminFormFieldClassName()}
                    />
                  </AdminFormField>
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
          actions={<MediaContentTypeBadge contentType={contentType} compact />}
        >
          <div className="grid gap-6">
            <AdminFormField label="العنوان" required>
              <input
                name="title"
                required
                defaultValue={values?.title ?? ""}
                placeholder="مثال: Venesia تطلق بيانًا صحفيًا جديدًا"
                className={adminFormFieldClassName("py-4 text-xl font-semibold")}
              />
            </AdminFormField>

            <TopicSlugInput defaultValue={values?.slug ?? ""} />

            <AdminFormField label="الموجز" hint="اختياري — يظهر في قوائم المركز الإعلامي وبطاقات المحتوى.">
              <textarea
                name="excerpt"
                rows={4}
                defaultValue={values?.excerpt ?? ""}
                placeholder="ملخص قصير يظهر في قائمة المركز الإعلامي وبطاقات المحتوى..."
                className={adminFormFieldClassName("resize-none leading-7")}
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

      <MediaEntitySeoPanel contentType={contentType} values={values} />

      <AdminStickyFormBar
        title={mode === "edit" ? "حفظ التعديلات" : "إنشاء المحتوى"}
        description={
          mode === "edit"
            ? "يُحفظ التعديل فورًا عند الضغط على «حفظ التعديلات» دون مغادرة الصفحة."
            : "يُنشأ المحتوى كمسودة ما لم تغيّر الحالة. تأكد من اختيار القسم الصحيح — الحقول تتغير حسب النوع."
        }
      >
        <AdminActionButton href={returnPath} variant="dark">
          {mode === "edit" ? "رجوع للقائمة" : "إلغاء والعودة للقائمة"}
        </AdminActionButton>
        <AdminActionButton
          type="submit"
          variant="primary"
        >
          {mode === "edit" ? "حفظ التعديلات" : "إنشاء المحتوى"}
        </AdminActionButton>
      </AdminStickyFormBar>
    </form>
    </>
  );
}
