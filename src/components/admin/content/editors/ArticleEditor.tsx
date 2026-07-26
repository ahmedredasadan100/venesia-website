import {
  AdminActionButton,
  AdminEntityPreviewActions,
  AdminFormActions,
  AdminPageContextHeader,
} from "../../ui";
import AdminFormRuntime from "../../ui/AdminFormRuntime";
import SeoPanel from "../../SeoPanel";
import FaqEditor from "./article/FaqEditor";
import TopicEditTabs from "./article/TopicEditTabs";
import TopicBasicDataPanel from "./article/TopicBasicDataPanel";
import TopicMarkdownEditor from "./article/TopicMarkdownEditor";
import { buildArticleTopicCategoryFilterGroups } from "../../../../lib/admin/article-topic-categories";
import TopicPublishChecklistPanel from "../../content-workflow/TopicPublishChecklistPanel";
import { topicRowToPublishInput } from "../../../../lib/admin/content-workflow/topic-publish-validation";
import { saveTopicForm } from "../../../../app/admin/content/topics/article-actions";
import TopicPublishingOptions from "./article/TopicPublishingOptions";
import { TOPIC_FORM_NAVIGATION } from "./article/topic-form-definition";
import { buildAdminContentPreviewCapability } from "../../../../lib/admin/content/entity-preview-capabilities";
import { createAdminFormErrorState } from "../../../../lib/admin/form-runtime";
import TopicMediaCatalogSyncSignal from "./article/TopicMediaCatalogSyncSignal";

type TopicFaqItem = { question?: string; answer?: string };
export type ArticleEditorCategory = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  sort_order: number | null;
  is_active: boolean | null;
};
export type ArticleEditorSeries = { id: number; name: string; slug: string };
export type ArticleEditorTopic = {
  id: number;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  content: string | null;
  image: string | null;
  image_alt: string | null;
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
  status: string | null;
  published_at: string | null;
  updated_at: string | null;
  is_featured: boolean | null;
  is_popular: boolean | null;
  show_title_on_page?: boolean | null;
  show_image_on_page?: boolean | null;
  show_excerpt_on_page?: boolean | null;
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
  topic,
  categories,
  series,
  errorMessage,
  returnPath = "/admin/content/topics",
}: {
  topic: ArticleEditorTopic;
  categories: ArticleEditorCategory[];
  series: ArticleEditorSeries[];
  errorMessage?: string | null;
  returnPath?: string;
}) {
  const safeCategories = categories;
  const categoryGroups = buildArticleTopicCategoryFilterGroups(safeCategories);
  const safeSeries = series;
  const faq = getFaq(topic.faq);
  const seoKeywords = getSeoKeywords(topic.seo_keywords);
  const status = topic.status || "draft";
  const previewCapability = buildAdminContentPreviewCapability({
    entityType: "topic",
    id: topic.id,
    contentType: "article",
    slug: topic.slug,
    publicationStatus: status,
    allowedActions: ["internal-preview", "public-view"],
  });
  const publishInput = topicRowToPublishInput({ ...topic, faq });
  const selectedCategory = safeCategories.find((category) => category.slug === topic.category_slug)?.name ?? topic.category_slug ?? "—";

  return (
    <main className="space-y-7">
      <AdminPageContextHeader
        eyebrow="EDIT TOPIC"
        contextLine="تعديل موضوع:"
        title={truncateWords(topic.title || "بدون عنوان")}
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

      <AdminFormRuntime
        key={topic.id}
        action={saveTopicForm}
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
        entityKey="topic"
        closeHref={returnPath}
        navigation={TOPIC_FORM_NAVIGATION}
        formId="topic-edit-form"
        className="space-y-7"
      >
        <input type="hidden" name="id" value={topic.id} />
        <input type="hidden" name="content_type" value="article" />

        <TopicEditTabs
          tabs={[
            {
              id: "basic",
              label: "المحتوى الأساسي",
              content: (
                <TopicBasicDataPanel
                  formId="topic-edit-form"
                  contentType="article"
                  contentTypeMode="edit"
                  categoryGroups={categoryGroups}
                  series={safeSeries}
                  contentEditor={<TopicMarkdownEditor defaultValue={topic.content ?? ""} variant="compact" />}
                  values={{
                    title: topic.title,
                    slug: topic.slug,
                    excerpt: topic.excerpt,
                    image: topic.image,
                    imageAlt: topic.image_alt,
                    categorySlug: topic.category_slug,
                    seriesId: topic.series_id,
                    series: topic.series,
                    seriesSlug: topic.series_slug,
                    dateLabel: topic.date_label,
                    publishedAt: topic.published_at,
                    showTitle: topic.show_title_on_page,
                    showImage: topic.show_image_on_page,
                    showExcerpt: topic.show_excerpt_on_page,
                  }}
                />
              ),
            },
            {
              id: "faq",
              label: "الأسئلة الشائعة",
              content: <FaqEditor defaultFaq={faq} defaultVisible={topic.show_faq_on_page} defaultTitleVisible={topic.show_faq_title_on_page} />,
            },
            {
              id: "seo",
              label: "SEO والتحليل",
              content: (
                <SeoPanel
                  title={topic.title ?? ""}
                  excerpt={topic.excerpt ?? ""}
                  slug={topic.slug ?? ""}
                  content={topic.content ?? ""}
                  image={topic.image ?? ""}
                  imageAlt={topic.image_alt ?? ""}
                  seoTitle={topic.seo_title ?? ""}
                  seoDescription={topic.seo_description ?? ""}
                  seoKeywords={seoKeywords}
                  focusKeyword={topic.focus_keyword ?? ""}
                  canonicalUrl={topic.canonical_url ?? ""}
                  robotsIndex={topic.robots_index ?? null}
                  robotsFollow={topic.robots_follow ?? null}
                  faq={faq}
                  hideImageAltField
                />
              ),
            },
            {
              id: "publish",
              label: "المراجعة والنشر",
              content: (
                <div className="space-y-6">
                  <TopicPublishingOptions status={status} featured={Boolean(topic.is_featured)} popular={Boolean(topic.is_popular)} publishedAt={topic.published_at} dateLabel={topic.date_label} />
                  <TopicPublishChecklistPanel formId="topic-edit-form" initial={publishInput} status={status} publishedAt={topic.published_at} dateLabel={topic.date_label} categoryLabel={selectedCategory} seriesLabel={topic.series ?? "—"} initialDisplay={{ title: topic.show_title_on_page, image: topic.show_image_on_page, excerpt: topic.show_excerpt_on_page, faq: topic.show_faq_on_page }} />
                </div>
              ),
            },
          ]}
        />
        <AdminFormActions />
      </AdminFormRuntime>
    </main>
  );
}
