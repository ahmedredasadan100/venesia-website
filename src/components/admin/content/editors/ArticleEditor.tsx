"use client";

import type { GlobalSeoSettings } from "../../../../lib/seo/global-seo-types";
import type { TopicDraftSession } from "../../../../lib/admin/content/topic-revision";
import { applyTopicFormDraftFields, getTopicDraftDisplayDate } from "./content-form-definition";

import {
  AdminActionButton,
  AdminEntityPreviewActions,
  AdminPageContextHeader,
  AdminPageExperience,
} from "../../ui";
import SeoPanel from "../../SeoPanel";
import FaqEditor from "./article/FaqEditor";
import ContentBasicDataPanel from "./ContentBasicDataPanel";
import ContentEditorShell, {
  type ContentEditorModel,
  type ContentEditorModelValue,
} from "./ContentEditorShell";
import ContentPublishingOptions from "./ContentPublishingOptions";
import ContentDisplaySettings from "./ContentDisplaySettings";
import TopicMarkdownEditor from "./article/TopicMarkdownEditor";
import ContentReviewPanel from "../../content-workflow/ContentReviewPanel";
import { topicRowToPublishInput } from "../../../../lib/admin/content-workflow/topic-publish-validation";
import { saveContentForm } from "../../../../app/admin/content/topics/editor-actions/save";
import { buildAdminContentPreviewCapability } from "../../../../lib/admin/content/entity-preview-capabilities";
import { createAdminFormErrorState } from "../../../../lib/admin/form-runtime";
import TopicMediaCatalogSyncSignal from "./article/TopicMediaCatalogSyncSignal";
import {
  buildAdminCategoryTree,
  flattenAdminCategoryTree,
} from "../../../../lib/admin/content/category-hierarchy";

type TopicFaqItem = { question?: string; answer?: string };
export type ArticleEditorCategory = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  sort_order: number | null;
  is_active: boolean | null;
};
export type ArticleEditorSeries = {
  id: number;
  name: string;
  slug: string;
  category_id: number | null;
};
export type ArticleEditorTopic = {
  id: number;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  content: string | null;
  image: string | null;
  image_alt: string | null;
  category_id: number | null;
  category_slug: string | null;
  series_id: number | null;
  series: string | null;
  series_slug: string | null;
  date_label: string | null;
  faq: unknown;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: unknown;
  focus_keyword: string | null;
  canonical_url?: string | null;
  robots_index?: boolean | null;
  robots_follow?: boolean | null;
  og_image?: string | null;
  og_image_alt?: string | null;
  status: string | null;
  published_at: string | null;
  updated_at: string | null;
  is_featured: boolean | null;
  is_popular: boolean | null;
  show_title_on_page?: boolean | null;
  show_image_on_page?: boolean | null;
  show_excerpt_on_page?: boolean | null;
  show_date_on_page?: boolean | null;
  show_category_on_page?: boolean | null;
  show_series_on_page?: boolean | null;
  show_intro_card_on_page?: boolean | null;
  show_faq_on_page?: boolean | null;
  show_faq_title_on_page?: boolean | null;
};
function truncateWords(value: string, limit = 4) {
  const words = value.trim().split(/\s+/);
  if (words.length <= limit) return value;
  return `${words.slice(0, limit).join(" ")}...`;
}

function getSeoKeywords(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function getFaq(value: unknown): TopicFaqItem[] {
  return Array.isArray(value) ? value : [];
}

export default function ArticleEditor({
  seoSettings,
  topic,
  categories,
  series,
  errorMessage,
  returnPath = "/admin/content/topics",
  draftSession,
}: {
  seoSettings?: GlobalSeoSettings;
  topic: ArticleEditorTopic;
  categories: ArticleEditorCategory[];
  series: ArticleEditorSeries[];
  errorMessage?: string | null;
  returnPath?: string;
  draftSession?: TopicDraftSession;
}) {
  const safeCategories = categories;
  const categoryOptions = flattenAdminCategoryTree(
    buildAdminCategoryTree(safeCategories),
  );
  const safeSeries = series;
  const status = topic.status || "unpublished";
  const previewCapability = buildAdminContentPreviewCapability({
    entityType: "topic",
    id: topic.id,
    contentType: "article",
    slug: topic.slug,
    publicationStatus: status,
    allowedActions: ["internal-preview", "public-view"],
  });
  const initialModelValue: ContentEditorModelValue = {
    title: topic.title ?? "",
    excerpt: topic.excerpt ?? "",
    content: topic.content ?? "",
    seoTitle: topic.seo_title ?? "",
    seoDescription: topic.seo_description ?? "",
    focusKeyword: topic.focus_keyword ?? "",
  };
  const templateContext = { target: "article" } as const;

  function renderTabs(model: ContentEditorModel) {
    const effectiveTopic = applyTopicFormDraftFields(topic, model.recoveryFields, "article");
    const faq = getFaq(effectiveTopic.faq);
    const seoKeywords = getSeoKeywords(effectiveTopic.seo_keywords);
    const status = effectiveTopic.status || "unpublished";
    const selectedCategory = safeCategories.find(category => category.id === effectiveTopic.category_id);
    const selectedSeries = safeSeries.find(item => item.id === effectiveTopic.series_id);
    const publishInput = topicRowToPublishInput({
      ...effectiveTopic,
      category_slug: selectedCategory?.slug ?? effectiveTopic.category_slug,
      faq,
    });
    return [
      {
        id: "basic",
        navigationLabel: "المحتوى",
        icon: "content" as const,
        content: (
          <ContentBasicDataPanel
            presentation="panel"
            heading="بيانات الموضوع والمحتوى"
            formId="topic-edit-form"
            contentType="article"
            mode="edit"
            slugDraftRestored={Object.hasOwn(model.recoveryFields ?? {}, "slug")}
            categories={categoryOptions}
            series={safeSeries}
            contentEditor={(
              <TopicMarkdownEditor
                defaultValue={effectiveTopic.content ?? ""}
                value={model.value.content}
                onValueChange={(nextValue) =>
                  model.setField("content", nextValue)
                }
                variant="compact"
                presentation="panel"
                draftIdentity={`topic:article:${topic.id}`}
                baselineRevision={topic.updated_at}
                formDraftManaged={model.recoveryEnabled}
              />
            )}
            controlledValues={{
              title: model.value.title,
              excerpt: model.value.excerpt,
            }}
            onControlledValueChange={model.setField}
            values={{
              title: effectiveTopic.title,
              slug: effectiveTopic.slug,
              excerpt: effectiveTopic.excerpt,
              image: effectiveTopic.image,
              imageAlt: effectiveTopic.image_alt,
              categoryId: effectiveTopic.category_id,
              seriesId: effectiveTopic.series_id,
              series: selectedSeries?.name ?? effectiveTopic.series,
              seriesSlug: selectedSeries?.slug ?? effectiveTopic.series_slug,
            }}
          />
        ),
      },
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
            showTitle={effectiveTopic.show_title_on_page}
            showImage={effectiveTopic.show_image_on_page}
            showExcerpt={effectiveTopic.show_excerpt_on_page}
            showDate={effectiveTopic.show_date_on_page}
            showCategory={effectiveTopic.show_category_on_page}
            showSeries={effectiveTopic.show_series_on_page}
            showIntroCard={effectiveTopic.show_intro_card_on_page}
          />
        ),
      },
      {
        id: "faq",
        navigationLabel: "الأسئلة",
        icon: "faq" as const,
        content: (
          <FaqEditor
            presentation="panel"
            defaultFaq={faq}
            defaultVisible={effectiveTopic.show_faq_on_page}
            defaultTitleVisible={effectiveTopic.show_faq_title_on_page}
          />
        ),
      },
      {
        id: "seo",
        navigationLabel: "SEO",
        icon: "seo" as const,
        content: (
          <SeoPanel seoSettings={seoSettings}
            title={effectiveTopic.title ?? ""}
            excerpt={effectiveTopic.excerpt ?? ""}
            slug={effectiveTopic.slug ?? ""}
            content={effectiveTopic.content ?? ""}
            image={effectiveTopic.image ?? ""}
            imageAlt={effectiveTopic.image_alt ?? ""}
            seoTitle={effectiveTopic.seo_title ?? ""}
            seoDescription={effectiveTopic.seo_description ?? ""}
            seoKeywords={seoKeywords}
            focusKeyword={effectiveTopic.focus_keyword ?? ""}
            canonicalUrl={effectiveTopic.canonical_url ?? ""}
            robotsIndex={effectiveTopic.robots_index ?? null}
            robotsFollow={effectiveTopic.robots_follow ?? null}
            ogImage={effectiveTopic.og_image ?? ""}
            ogImageAlt={effectiveTopic.og_image_alt ?? ""}
            faq={faq}
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
            formId="topic-edit-form"
            initial={{
              ...publishInput,
              contentType: "article",
              canonicalUrl: publishInput.canonicalUrl ?? "",
              ogImage: publishInput.ogImage ?? "",
              ogImageAlt: publishInput.ogImageAlt ?? "",
              mediaPayload: null,
            }}
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
                status={status}
                featured={Boolean(effectiveTopic.is_featured)}
                popular={Boolean(effectiveTopic.is_popular)}
                publishedAt={topic.published_at}
                dateLabel={effectiveTopic.date_label}
                draftDisplayDate={getTopicDraftDisplayDate(model.recoveryFields, topic.published_at)}
              />
            }
            status={status}
            publishedAt={topic.published_at}
            dateLabel={effectiveTopic.date_label}
            featured={Boolean(effectiveTopic.is_featured)}
            popular={Boolean(effectiveTopic.is_popular)}
            updatedAt={topic.updated_at}
            contentTypeLabel="مقال"
            categoryLabel={selectedCategory?.name ?? effectiveTopic.category_slug ?? "—"}
            seriesLabel={selectedSeries?.name ?? effectiveTopic.series ?? "—"}
            initialDisplay={{
              title: effectiveTopic.show_title_on_page,
              image: effectiveTopic.show_image_on_page,
              excerpt: effectiveTopic.show_excerpt_on_page,
              date: effectiveTopic.show_date_on_page,
              category: effectiveTopic.show_category_on_page,
              series: effectiveTopic.show_series_on_page,
              introCard: effectiveTopic.show_intro_card_on_page,
            }}
          />
        ),
      },
    ];
  }

  return (
    <AdminPageExperience dir="rtl">
      <AdminPageContextHeader
        visualPreset="topics"
        eyebrow="EDIT TOPIC"
        title={truncateWords(topic.title || "بدون عنوان")}
        description="تعديل موضوع."
        actions={
          <>
            <AdminActionButton href={returnPath} variant="dark">عرض الموضوعات</AdminActionButton>
            <AdminActionButton href="/admin/content/categories" variant="dark">عرض التصنيفات</AdminActionButton>
            <AdminActionButton href="/admin/content/series" variant="dark">عرض السلاسل</AdminActionButton>
            <AdminEntityPreviewActions capability={previewCapability} />
          </>
        }
      />

      <TopicMediaCatalogSyncSignal formId="topic-edit-form" />

      <ContentEditorShell
        draftSession={draftSession}
        action={saveContentForm}
        initialState={
          errorMessage
            ? createAdminFormErrorState(
                "edit",
                "تعذر تنفيذ العملية",
                errorMessage,
              )
            : undefined
        }
        mode="edit"
        contentType="article"
        entityId={topic.id}
        baselineRevision={topic.updated_at}
        closeHref={returnPath}
        formId="topic-edit-form"
        initialModelValue={initialModelValue}
        templateContext={templateContext}
        tabs={renderTabs}
      />
    </AdminPageExperience>
  );
}
