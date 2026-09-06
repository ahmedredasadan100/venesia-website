"use client";

import { createAdminFormErrorState } from "../../../../../lib/admin/form-runtime";
import { adminFormFieldClassName } from "../../../../../lib/admin/admin-ui-styles";
import {
  getContentEditorAdapter,
  getContentTypeLabel,
  type MediaEditableContentType,
} from "../../../../../lib/admin/content/content-types";
import type { MediaTopicPayload } from "../../../../../lib/admin/media-topic-payload";
import { mediaRowToPublishInput } from "../../../../../lib/admin/content-workflow/media-publish-validation";
import { saveContentForm } from "../../../../../app/admin/content/topics/editor-actions/save";
import ContentReviewPanel from "../../../content-workflow/ContentReviewPanel";
import ContentBasicDataPanel from "../ContentBasicDataPanel";
import ContentDisplaySettings from "../ContentDisplaySettings";
import ContentEditorShell, {
  type ContentEditorModel,
} from "../ContentEditorShell";
import ContentPublishingOptions from "../ContentPublishingOptions";
import { AdminFormError } from "../../../ui/AdminFormRuntime";
import TopicMarkdownEditor from "../article/TopicMarkdownEditor";
import MediaEntitySeoPanel from "./MediaEntitySeoPanel";
import MediaGalleryFields from "./MediaGalleryFields";
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
};

const DEFAULT_CONTENT =
  "# عنوان المحتوى\n\nابدأ كتابة المحتوى هنا...\n\n## عنوان فرعي\n\nاكتب الفقرة هنا...";

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
  return payload?.kind === "gallery" ? payload.images : [];
}

export default function MediaContentForm({
  mode,
  values,
  contentType,
  categories,
  series,
  returnPath = "/admin/content/topics",
  errorMessage,
}: MediaContentFormProps) {
  const adapter = getContentEditorAdapter(contentType);
  const content = values?.content?.trim() ? values.content : DEFAULT_CONTENT;
  const videoDefaults = getVideoDefaults(values?.media_payload);
  const galleryDefaults = getGalleryDefaults(values?.media_payload);
  const formId = mode === "edit" ? "content-edit-form" : "content-create-form";
  const templateContext = { target: "media", mediaContentType: contentType } as const;
  const initialModelValue = {
    title: values?.title ?? "",
    excerpt: values?.excerpt ?? "",
    content: adapter.body === "markdown" ? content : "",
    seoTitle: values?.seo_title ?? "",
    seoDescription: values?.seo_description ?? "",
    focusKeyword: values?.focus_keyword ?? "",
  };
  const selectedCategory = categories.find(
    (category) => category.id === values?.category_id,
  );
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
  const publishInitial = mediaRowToPublishInput({
    title: values?.title,
    slug: values?.slug,
    excerpt: values?.excerpt,
    content: values?.content,
    image: values?.image,
    image_alt: values?.image_alt,
    category_slug: selectedCategory?.slug ?? values?.category_slug ?? "",
    content_type: contentType,
    media_payload: values?.media_payload,
    seo_title: values?.seo_title,
    seo_description: values?.seo_description,
    focus_keyword: values?.focus_keyword,
    canonical_url: values?.canonical_url,
    og_image: values?.og_image,
    og_image_alt: values?.og_image_alt,
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

  function renderTabs(model: ContentEditorModel) {
    const specializedBodyEditor =
      adapter.body === "video" ? (
        <div className="space-y-5">
          <MediaVideoFields
            defaultVideoUrl={videoDefaults.videoUrl}
            defaultDuration={videoDefaults.duration}
            defaultThumbnail={videoDefaults.thumbnail}
          />
          <input type="hidden" name="content" value={model.value.content} readOnly />
        </div>
      ) : adapter.body === "gallery" ? (
        <div className="space-y-5">
          <MediaGalleryFields defaultImages={galleryDefaults} />
          <input type="hidden" name="content" value={model.value.content} readOnly />
        </div>
      ) : (
        <TopicMarkdownEditor
          defaultValue={content}
          value={model.value.content}
          onValueChange={(nextValue) => model.setField("content", nextValue)}
          variant="compact"
          draftIdentity={`topic:${contentType}:${values?.id ?? "create"}`}
          baselineRevision={values?.updated_at ?? null}
        />
      );
    const bodyEditor = (
      <div className="space-y-5">
        {specializedBodyEditor}
        {contentType === "news" || contentType === "site_update" ? (
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-white/75">المشروع المرتبط</span>
            <input
              name="media_project"
              defaultValue={values?.media_project ?? ""}
              placeholder="مثال: D174"
              className={adminFormFieldClassName()}
            />
            <AdminFormError name="media_project" />
          </label>
        ) : (
          <input type="hidden" name="media_project" value={values?.media_project ?? ""} readOnly />
        )}
      </div>
    );

    return [
      {
        id: "basic",
        navigationLabel: "المحتوى",
        sectionHeading: "البيانات الأساسية والمحتوى",
        sectionDescription:
          "حرر البيانات المشتركة ثم أكمل الحقول المتخصصة التي يملكها هذا النوع فقط.",
        icon: adapter.body === "markdown" ? "content" as const : "media" as const,
        content: (
          <ContentBasicDataPanel
            formId={formId}
            contentType={contentType}
            mode={mode}
            categories={categories}
            series={availableSeries}
            contentEditor={bodyEditor}
            controlledValues={{
              title: model.value.title,
              excerpt: model.value.excerpt,
            }}
            onControlledValueChange={model.setField}
            displaySettings={
              <ContentDisplaySettings
                showTitle={values?.show_title_on_page}
                showImage={values?.show_image_on_page}
                showExcerpt={values?.show_excerpt_on_page}
                showDate={values?.show_date_on_page}
                showCategory={values?.show_category_on_page}
                showSeries={values?.show_series_on_page}
                showIntroCard={values?.show_intro_card_on_page}
              />
            }
            values={{
              title: values?.title,
              slug: values?.slug,
              excerpt: values?.excerpt,
              image: values?.image,
              imageAlt: values?.image_alt,
              categoryId: values?.category_id,
              seriesId: values?.series_id,
              series: values?.series,
              seriesSlug: values?.series_slug,
            }}
          />
        ),
      },
      {
        id: "seo",
        navigationLabel: "SEO",
        sectionHeading: "تحسين محركات البحث والمشاركة",
        sectionDescription:
          "استخدم عقد Entity SEO الموحد ومعايناته ومسار التصحيح نفسه.",
        icon: "seo" as const,
        content: (
          <MediaEntitySeoPanel
            contentType={contentType}
            values={values}
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
        icon: "publish" as const,
        content: (
          <ContentReviewPanel
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
                status={values?.status ?? "unpublished"}
                featured={Boolean(values?.is_featured)}
                popular={Boolean(values?.is_popular)}
                publishedAt={values?.published_at}
                dateLabel={values?.date_label}
              />
            }
            status={values?.status ?? "unpublished"}
            publishedAt={values?.published_at}
            dateLabel={values?.date_label}
            featured={Boolean(values?.is_featured)}
            popular={Boolean(values?.is_popular)}
            updatedAt={values?.updated_at}
            contentTypeLabel={getContentTypeLabel(contentType)}
            categoryLabel={selectedCategory?.name ?? "—"}
            seriesLabel={values?.series ?? "—"}
            initialDisplay={{
              title: values?.show_title_on_page,
              image: values?.show_image_on_page,
              excerpt: values?.show_excerpt_on_page,
              date: values?.show_date_on_page,
              category: values?.show_category_on_page,
              series: values?.show_series_on_page,
              introCard: values?.show_intro_card_on_page,
            }}
          />
        ),
      },
    ];
  }

  return (
      <ContentEditorShell
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
