"use client";
import { mediaContentSlot } from "../../../../../lib/media-center/detail-page-config";

import type { GlobalSeoSettings } from "../../../../../lib/seo/global-seo-types";
import type { TopicDraftSession } from "../../../../../lib/admin/content/topic-revision";
import { applyTopicFormDraftFields, getTopicDraftDisplayDate } from "../content-form-definition";

import { createAdminFormErrorState } from "../../../../../lib/admin/form-runtime";
import { adminFormFieldClassName } from "../../../../../lib/admin/admin-ui-styles";
import {
  getContentEditorAdapter,
  getContentTypeLabel,
  type MediaEditableContentType,
} from "../../../../../lib/admin/content/content-types";
import { VIDEO_PROVIDERS, normalizeVideoUrl, type MediaTopicPayload } from "../../../../../lib/admin/media-topic-payload";
import { mediaRowToPublishInput } from "../../../../../lib/admin/content-workflow/media-publish-validation";
import { saveContentForm } from "../../../../../app/admin/content/topics/editor-actions/save";
import { readMediaVideoEmbed } from "../../../../../app/admin/content/topics/media-actions/validation";
import ContentReviewPanel from "../../../content-workflow/ContentReviewPanel";
import ContentBasicDataPanel from "../ContentBasicDataPanel";
import ContentDisplaySettings from "../ContentDisplaySettings";
import ContentEditorShell, {
  type ContentEditorModel,
} from "../ContentEditorShell";
import ContentPublishingOptions from "../ContentPublishingOptions";
import { AdminFormError } from "../../../ui/AdminFormRuntime";
import AdminCard from "../../../ui/AdminCard";
import AdminMediaGalleryField from "../../../media/AdminMediaGalleryField";
import TopicMarkdownEditor from "../article/TopicMarkdownEditor";
import MediaEntitySeoPanel from "./MediaEntitySeoPanel";
import MediaVideoFields from "./MediaVideoFields";

export type MediaContentFormValues = {
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
  series?: string | null;
  series_slug?: string | null;
  status?: string | null;
  is_featured?: boolean | null;
  is_popular?: boolean | null;
  published_at?: string | null;
  date_label?: string | null;
  updated_at?: string | null;
  show_title_on_page?: boolean | null;
  show_image_on_page?: boolean | null;
  show_excerpt_on_page?: boolean | null;
  show_date_on_page?: boolean | null;
  show_category_on_page?: boolean | null;
  show_series_on_page?: boolean | null;
  show_intro_card_on_page?: boolean | null;
  media_payload?: MediaTopicPayload | null;
  media_project?: string | null;
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
  seoSettings?: GlobalSeoSettings;
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
  series: Array<{
    id: number;
    name: string;
    slug: string;
    status: string;
    deleted_at: string | null;
    category_id: number | null;
  }>;
  returnPath?: string;
  errorMessage?: string | null;
  draftSession?: TopicDraftSession;
};

const DEFAULT_CONTENT =
  "# عنوان المحتوى\n\nابدأ كتابة المحتوى هنا...\n\n## عنوان فرعي\n\nاكتب الفقرة هنا...";

function getVideoDefaults(payload?: MediaTopicPayload | null) {
  if (!payload || payload.kind !== "video") {
    return { videoUrl: "", provider: "youtube" as const, startSeconds: "", duration: "", thumbnail: "" };
  }
  return {
    videoUrl: payload.video_url,
    provider: payload.provider,
    startSeconds: payload.start_seconds ? String(payload.start_seconds) : "",
    duration: payload.duration ?? "",
    thumbnail: payload.thumbnail ?? "",
  };
}

function getGalleryDefaults(payload?: MediaTopicPayload | null) {
  return payload?.kind === "gallery" ? payload.images : [];
}

export default function MediaContentForm({
  seoSettings,
  mode,
  values,
  contentType,
  categories,
  series,
  returnPath = "/admin/content/topics",
  errorMessage,
  draftSession,
}: MediaContentFormProps) {
  const adapter = getContentEditorAdapter(contentType);
  const videoPanel = contentType === "video";
  const content = mode === "edit"
    ? values?.content ?? ""
    : values?.content?.trim() ? values.content : DEFAULT_CONTENT;
  const videoDefaults = getVideoDefaults(values?.media_payload);
  const formId = mode === "edit" ? "content-edit-form" : "content-create-form";
  const templateContext = { target: "media", mediaContentType: contentType } as const;
  const initialModelValue = {
    title: values?.title ?? "",
    excerpt: values?.excerpt ?? "",
    content: adapter.body === "markdown" ? content : "",
    seoTitle: values?.seo_title ?? "",
    seoDescription: values?.seo_description ?? "",
    focusKeyword: values?.focus_keyword ?? "",
    ...(videoPanel ? {
      videoUrl: videoDefaults.videoUrl,
      image: values?.image ?? "",
      videoProvider: videoDefaults.provider,
      videoStartSeconds: videoDefaults.startSeconds,
      videoThumbnail: videoDefaults.thumbnail,
    } : {}),
  };
  const availableSeries = series
    .filter(
      (item) =>
        (item.status === "published" && !item.deleted_at) ||
        item.id === values?.series_id,
    )
    .map(({ id, name, slug, category_id }) => ({
      id,
      name,
      slug,
      category_id,
    }));
  function renderTabs(model: ContentEditorModel) {
    const effectiveValues = applyTopicFormDraftFields<MediaContentFormValues>(values ?? {}, model.recoveryFields, contentType);
    const videoDefaults = getVideoDefaults(effectiveValues.media_payload);
    const galleryDefaults = getGalleryDefaults(effectiveValues.media_payload);
    const selectedCategory = categories.find(category => category.id === effectiveValues.category_id);
    const selectedSeries = availableSeries.find(item => item.id === effectiveValues.series_id);
    const publishInitial = mediaRowToPublishInput({
      title: effectiveValues.title,
      slug: effectiveValues.slug,
      excerpt: effectiveValues.excerpt,
      content: effectiveValues.content,
      image: effectiveValues.image,
      image_alt: effectiveValues.image_alt,
      category_slug: selectedCategory?.slug ?? effectiveValues.category_slug ?? "",
      content_type: contentType,
      media_payload: effectiveValues.media_payload,
      seo_title: effectiveValues.seo_title,
      seo_description: effectiveValues.seo_description,
      focus_keyword: effectiveValues.focus_keyword,
      canonical_url: effectiveValues.canonical_url,
      og_image: effectiveValues.og_image,
      og_image_alt: effectiveValues.og_image_alt,
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
      seoTitle: "",
      seoDescription: "",
      focusKeyword: "",
      canonicalUrl: "",
      ogImage: "",
      ogImageAlt: "",
    };

    const specializedBodyEditor =
      adapter.body === "video" ? (
        <div className="space-y-5">
          <MediaVideoFields
            requestMetaEmbed={readMediaVideoEmbed}
            presentation="panel"
            videoUrl={model.value.videoUrl ?? ""}
            onVideoUrlChange={(nextValue) => model.setField("videoUrl", nextValue)}
            videoProvider={model.value.videoProvider ?? "youtube"}
            onVideoProviderChange={(nextProvider) => {
              if (nextProvider === (model.value.videoProvider ?? "youtube")) return;
              model.setField("videoProvider", nextProvider);
              if (model.value.videoUrl && !normalizeVideoUrl(nextProvider, model.value.videoUrl)) {
                model.setField("videoUrl", "");
              }
              if (!VIDEO_PROVIDERS.find((provider) => provider.value === nextProvider)?.supportsStartTime) {
                model.setField("videoStartSeconds", "");
              }
            }}
            videoStartSeconds={model.value.videoStartSeconds ?? ""}
            onVideoStartSecondsChange={(nextValue) => model.setField("videoStartSeconds", nextValue)}
            videoThumbnail={model.value.videoThumbnail ?? ""}
            mainImage={model.value.image ?? ""}
            onVideoThumbnailChange={(nextValue) => model.setField("videoThumbnail", nextValue)}
            defaultVideoUrl={videoDefaults.videoUrl}
            defaultDuration={videoDefaults.duration}
            defaultThumbnail={videoDefaults.thumbnail}
          />
          <input type="hidden" name="content" value={model.value.content} readOnly />
        </div>
      ) : adapter.body === "gallery" ? (
        <div className="space-y-5">
          <AdminMediaGalleryField
            mediaSlot={mediaContentSlot("galleryImage")}
            valueMode="items"
            name="gallery_image_url"
            altName="gallery_image_alt"
            captionName="gallery_image_caption"
            label="صور المعرض"
            presentation="panel"
            actionPresentation="card"
            desktopColumns={4}
            allowAdd
            allowReplace
            allowRemove
            allowReorder
            showAlt
            showCaption
            enableDragDrop
            dragFromImage
            defaultItems={galleryDefaults}
            focusTargetId="gallery_image_url"
            altFocusTargetId="gallery_image_alt"
          />
          <input type="hidden" name="content" value={model.value.content} readOnly />
        </div>
      ) : (
        <TopicMarkdownEditor
          defaultValue={effectiveValues.content ?? content}
          value={model.value.content}
          onValueChange={(nextValue) => model.setField("content", nextValue)}
          variant="compact"
          presentation="panel"
          draftIdentity={`topic:${contentType}:${values?.id ?? "create"}`}
          baselineRevision={values?.updated_at ?? null}
          formDraftManaged={model.recoveryEnabled}
        />
      );
    const bodyEditor = (
      <div className="space-y-5">
        {specializedBodyEditor}
        {contentType === "news" || contentType === "site_update" ? (
          <AdminCard presentation="premium" className="min-w-0 p-3">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-white/75">المشروع المرتبط</span>
            <input
              name="media_project"
              defaultValue={effectiveValues.media_project ?? ""}
              placeholder="مثال: D174"
              className={adminFormFieldClassName()}
            />
            <AdminFormError name="media_project" />
          </label>
          </AdminCard>
        ) : (
          <input type="hidden" name="media_project" value={effectiveValues.media_project ?? ""} readOnly />
        )}
      </div>
    );

    return [
      {
        id: "basic",
        navigationLabel: "المحتوى",
        icon: adapter.body === "markdown" ? "content" as const : "media" as const,
        content: (
          <ContentBasicDataPanel
            presentation="panel"
            heading="البيانات الأساسية والمحتوى"
            description="حرر البيانات المشتركة ثم أكمل الحقول المتخصصة التي يملكها هذا النوع فقط."
            formId={formId}
            contentType={contentType}
            mode={mode}
            slugDraftRestored={Object.hasOwn(model.recoveryFields ?? {}, "slug")}
            categories={categories}
            series={availableSeries}
            contentEditor={adapter.body === "markdown" ? bodyEditor : null}
            controlledValues={{
              title: model.value.title,
              excerpt: model.value.excerpt,
            }}
            onControlledValueChange={model.setField}
            onImageValueChange={videoPanel ? (nextValue) => model.setField("image", nextValue) : undefined}
            values={{
              title: effectiveValues.title,
              slug: effectiveValues.slug,
              excerpt: effectiveValues.excerpt,
              image: effectiveValues.image,
              imageAlt: effectiveValues.image_alt,
              categoryId: effectiveValues.category_id,
              seriesId: effectiveValues.series_id,
              series: selectedSeries?.name ?? effectiveValues.series,
              seriesSlug: selectedSeries?.slug ?? effectiveValues.series_slug,
            }}
          />
        ),
      },
      ...(contentType === "video" || contentType === "gallery" ? [
        {
          id: contentType,
          navigationLabel: contentType === "video" ? "الفيديو" : "معرض الصور",
          icon: "media" as const,
          content: (
            <AdminCard presentation="premium" className="min-w-0 p-3">
              {bodyEditor}
            </AdminCard>
          ),
        },
      ] : []),
      {
        id: "display",
        navigationLabel: "إعدادات العرض",
        icon: "settings" as const,
        content: (
          <ContentDisplaySettings
            sectionHeading="إعدادات العرض"
            columns={4}
            introCardSpan={1}
            presentation="premium-inline"
            showTitle={effectiveValues.show_title_on_page}
            showImage={effectiveValues.show_image_on_page}
            showExcerpt={effectiveValues.show_excerpt_on_page}
            showDate={effectiveValues.show_date_on_page}
            showCategory={effectiveValues.show_category_on_page}
            showSeries={effectiveValues.show_series_on_page}
            showIntroCard={effectiveValues.show_intro_card_on_page}
          />
        ),
      },
      {
        id: "seo",
        navigationLabel: "SEO",
        icon: "seo" as const,
        content: (
          <MediaEntitySeoPanel seoSettings={seoSettings}
            presentation="panel"
            contentType={contentType}
            values={effectiveValues}
            controlledValues={{
              title: model.value.title,
              excerpt: model.value.excerpt,
              content: model.value.content,
              seoTitle: model.value.seoTitle,
              seoDescription: model.value.seoDescription,
              focusKeyword: model.value.focusKeyword,
            }}
            onControlledValueChange={model.setField}
          />
        ),
      },
      {
        id: "publish",
        navigationLabel: "المراجعة",
        sectionHeaderPresentation: "premium" as const,
        icon: "publish" as const,
        content: (
          <ContentReviewPanel
            presentation="panel"
            formId={formId}
            initial={publishInitial}
            controlledValues={{
              title: model.value.title,
              excerpt: model.value.excerpt,
              content: model.value.content,
              seoTitle: model.value.seoTitle,
              seoDescription: model.value.seoDescription,
              focusKeyword: model.value.focusKeyword,
            }}
            publishingOptions={
              <ContentPublishingOptions
                presentation="panel"
                status={effectiveValues.status ?? "unpublished"}
                featured={Boolean(effectiveValues.is_featured)}
                popular={Boolean(effectiveValues.is_popular)}
                publishedAt={values?.published_at}
                dateLabel={effectiveValues.date_label}
                draftDisplayDate={getTopicDraftDisplayDate(model.recoveryFields, values?.published_at)}
              />
            }
            status={effectiveValues.status ?? "unpublished"}
            publishedAt={values?.published_at}
            dateLabel={effectiveValues.date_label}
            featured={Boolean(effectiveValues.is_featured)}
            popular={Boolean(effectiveValues.is_popular)}
            updatedAt={values?.updated_at}
            contentTypeLabel={getContentTypeLabel(contentType)}
            categoryLabel={selectedCategory?.name ?? "—"}
            seriesLabel={selectedSeries?.name ?? effectiveValues.series ?? "—"}
            initialDisplay={{
              title: effectiveValues.show_title_on_page,
              image: effectiveValues.show_image_on_page,
              excerpt: effectiveValues.show_excerpt_on_page,
              date: effectiveValues.show_date_on_page,
              category: effectiveValues.show_category_on_page,
              series: effectiveValues.show_series_on_page,
              introCard: effectiveValues.show_intro_card_on_page,
            }}
          />
        ),
      },
    ];
  }

  return (
      <ContentEditorShell
        draftSession={draftSession}
        action={saveContentForm}
        contentType={contentType}
        mode={mode}
        entityId={values?.id}
        baselineRevision={mode === "edit" ? values?.updated_at ?? null : undefined}
        closeHref={returnPath}
        formId={formId}
        initialModelValue={initialModelValue}
        templateContext={templateContext}
        initialState={
          errorMessage
            ? createAdminFormErrorState(
                mode,
                "تعذر حفظ المحتوى",
                errorMessage,
              )
            : undefined
        }
        tabs={renderTabs}
      />
  );
}
