"use client";

import type { GlobalSeoSettings } from "../../../../lib/seo/global-seo-types";
import type { TopicDraftSession } from "../../../../lib/admin/content/topic-revision";
import { applyTopicFormDraftFields, getTopicDraftDisplayDate } from "./content-form-definition";

import {
  AdminActionButton,
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
import type { ArticleEditorCategory, ArticleEditorSeries, ArticleEditorTopic } from "./ArticleEditor";
import { createAdminFormErrorState } from "../../../../lib/admin/form-runtime";
import TopicMediaCatalogSyncSignal from "./article/TopicMediaCatalogSyncSignal";
import {
  buildAdminCategoryTree,
  flattenAdminCategoryTree,
} from "../../../../lib/admin/content/category-hierarchy";

export default function ArticleCreateEditor({
  seoSettings,
  categories,
  series,
  errorMessage,
  draftSession,
}: {
  seoSettings?: GlobalSeoSettings;
  categories: ArticleEditorCategory[];
  series: ArticleEditorSeries[];
  errorMessage?: string | null;
  draftSession?: TopicDraftSession;
}) {
  const safeCategories = categories;
  const categoryOptions = flattenAdminCategoryTree(
    buildAdminCategoryTree(safeCategories),
  );
  const safeSeries = series;
  const defaultContent = "# عنوان المقال\n\nابدأ كتابة المقال هنا...\n\n## عنوان فرعي\n\nاكتب الفقرة هنا...";
  const initialModelValue: ContentEditorModelValue = {
    title: "",
    excerpt: "",
    content: defaultContent,
    seoTitle: "",
    seoDescription: "",
    focusKeyword: "",
  };
  const templateContext = { target: "article" } as const;
  const defaultValues: Partial<ArticleEditorTopic> = { content: defaultContent };

  function renderTabs(model: ContentEditorModel) {
    const values = applyTopicFormDraftFields(defaultValues, model.recoveryFields, "article");
    const faq = Array.isArray(values.faq) ? values.faq : [];
    const seoKeywords = Array.isArray(values.seo_keywords) ? values.seo_keywords.map(String) : [];
    const selectedCategory = safeCategories.find(category => category.id === values.category_id);
    const selectedSeries = safeSeries.find(item => item.id === values.series_id);
    const status = values.status ?? "unpublished";
    const publishInput = topicRowToPublishInput({ ...values, category_slug: selectedCategory?.slug, faq });
    return [
      {
        id: "basic",
        navigationLabel: "المحتوى",
        icon: "content" as const,
        content: (
          <ContentBasicDataPanel
            presentation="panel"
            heading="بيانات الموضوع والمحتوى"
            description="اكتب المحتوى الأساسي واضبط التصنيف والصورة وإعدادات الظهور."
            formId="topic-create-form"
            contentType="article"
            mode="create"
            slugDraftRestored={Object.hasOwn(model.recoveryFields ?? {}, "slug")}
            categories={categoryOptions}
            series={safeSeries}
            contentEditor={(
              <TopicMarkdownEditor
                defaultValue={values.content ?? defaultContent}
                value={model.value.content}
                onValueChange={(nextValue) =>
                  model.setField("content", nextValue)
                }
                variant="compact"
                presentation="panel"
                draftIdentity="topic:article:create"
                baselineRevision={null}
                formDraftManaged={model.recoveryEnabled}
              />
            )}
            controlledValues={{
              title: model.value.title,
              excerpt: model.value.excerpt,
            }}
            onControlledValueChange={model.setField}
            values={{
              title: values.title,
              slug: values.slug,
              excerpt: values.excerpt,
              image: values.image,
              imageAlt: values.image_alt,
              categoryId: values.category_id,
              seriesId: values.series_id,
              series: selectedSeries?.name,
              seriesSlug: selectedSeries?.slug,
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
            sectionHeading="إعدادات العرض" columns={4} introCardSpan={1} presentation="premium-inline"
            showTitle={values.show_title_on_page}
            showImage={values.show_image_on_page}
            showExcerpt={values.show_excerpt_on_page}
            showDate={values.show_date_on_page}
            showCategory={values.show_category_on_page}
            showSeries={values.show_series_on_page}
            showIntroCard={values.show_intro_card_on_page}
          />
        ),
      },
      {
        id: "faq",
        navigationLabel: "الأسئلة",
        icon: "faq" as const,
        content: <FaqEditor presentation="panel" defaultFaq={faq} defaultVisible={values.show_faq_on_page} defaultTitleVisible={values.show_faq_title_on_page} />,
      },
      {
        id: "seo",
        navigationLabel: "SEO",
        icon: "seo" as const,
        content: (
          <SeoPanel seoSettings={seoSettings}
            title={values.title ?? ""}
            excerpt={values.excerpt ?? ""}
            slug={values.slug ?? ""}
            content={values.content ?? defaultContent}
            image={values.image ?? ""}
            imageAlt={values.image_alt ?? ""}
            seoTitle={values.seo_title ?? ""}
            seoDescription={values.seo_description ?? ""}
            seoKeywords={seoKeywords}
            focusKeyword={values.focus_keyword ?? ""}
            canonicalUrl={values.canonical_url ?? ""}
            robotsIndex={values.robots_index ?? null}
            robotsFollow={values.robots_follow ?? null}
            ogImage={values.og_image ?? ""}
            ogImageAlt={values.og_image_alt ?? ""}
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
            formId="topic-create-form"
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
                featured={Boolean(values.is_featured)}
                popular={Boolean(values.is_popular)}
                dateLabel={values.date_label}
                draftDisplayDate={getTopicDraftDisplayDate(model.recoveryFields)}
              />
            }
            status={status}
            dateLabel={values.date_label}
            featured={Boolean(values.is_featured)}
            popular={Boolean(values.is_popular)}
            contentTypeLabel="مقال"
            categoryLabel={selectedCategory?.name}
            seriesLabel={selectedSeries?.name}
            initialDisplay={{
              title: values.show_title_on_page ?? true,
              image: values.show_image_on_page ?? true,
              excerpt: values.show_excerpt_on_page ?? true,
              date: values.show_date_on_page ?? true,
              category: values.show_category_on_page ?? true,
              series: values.show_series_on_page ?? true,
              introCard: values.show_intro_card_on_page ?? true,
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
        eyebrow="CREATE TOPIC"
        title="إضافة موضوع جديد"
        description="أنشئ الموضوع كاملًا من البداية: المحتوى، السيو، الصورة، الأسئلة الشائعة، ثم احفظه كغير منشور أو انشره بعد اكتمال الجاهزية."
        actions={
          <>
            <AdminActionButton href="/admin/content/topics" variant="dark">عرض الموضوعات</AdminActionButton>
            <AdminActionButton href="/admin/content/categories" variant="dark">عرض التصنيفات</AdminActionButton>
            <AdminActionButton href="/admin/content/series" variant="dark">عرض السلاسل</AdminActionButton>
          </>
        }
      />

      <TopicMediaCatalogSyncSignal formId="topic-create-form" />

      <ContentEditorShell
        draftSession={draftSession}
        action={saveContentForm}
        initialState={
          errorMessage
            ? createAdminFormErrorState(
                "create",
                "تعذر إنشاء الموضوع",
                errorMessage,
              )
            : undefined
        }
        mode="create"
        contentType="article"
        closeHref="/admin/content/topics"
        formId="topic-create-form"
        initialModelValue={initialModelValue}
        templateContext={templateContext}
        tabs={renderTabs}
      />
    </AdminPageExperience>
  );
}
