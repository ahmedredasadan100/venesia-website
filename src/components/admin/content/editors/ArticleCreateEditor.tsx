import AdminNotice from "../../AdminNotice";
import {
  AdminActionButton,
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
import type { ArticleEditorCategory, ArticleEditorSeries } from "./ArticleEditor";
import TopicPublishingOptions from "./article/TopicPublishingOptions";
import { TOPIC_FORM_NAVIGATION } from "./article/topic-form-definition";

export default function ArticleCreateEditor({
  categories,
  series,
  errorMessage,
}: {
  categories: ArticleEditorCategory[];
  series: ArticleEditorSeries[];
  errorMessage?: string | null;
}) {
  const safeCategories = categories;
  const categoryGroups = buildArticleTopicCategoryFilterGroups(safeCategories);
  const safeSeries = series;
  const defaultContent = "# عنوان المقال\n\nابدأ كتابة المقال هنا...\n\n## عنوان فرعي\n\nاكتب الفقرة هنا...";
  const publishInput = topicRowToPublishInput({ content: defaultContent });

  return (
    <main className="space-y-7">
      <AdminPageContextHeader
        eyebrow="CREATE TOPIC"
        title="إضافة موضوع جديد"
        description="أنشئ الموضوع كاملًا من البداية: المحتوى، السيو، الصورة، الأسئلة الشائعة، ثم احفظه كمسودة أو انشره بعد اكتمال الجاهزية."
        actions={
          <>
            <AdminActionButton href="/admin/content/topics" variant="dark">عرض الموضوعات</AdminActionButton>
            <AdminActionButton href="/admin/content/categories" variant="dark">عرض التصنيفات</AdminActionButton>
            <AdminActionButton href="/admin/content/series" variant="dark">عرض السلاسل</AdminActionButton>
          </>
        }
      />

      {errorMessage ? <AdminNotice variant="danger" title="تعذر إنشاء الموضوع" message={errorMessage} /> : null}

      <AdminFormRuntime
        action={saveTopicForm}
        mode="create"
        entityKey="topic"
        closeHref="/admin/content/topics"
        navigation={TOPIC_FORM_NAVIGATION}
        formId="topic-create-form"
        className="space-y-7"
      >
        <input type="hidden" name="content_type" value="article" />
        <TopicEditTabs
          tabs={[
            {
              id: "basic",
              label: "المحتوى الأساسي",
              content: <TopicBasicDataPanel formId="topic-create-form" contentType="article" contentTypeMode="create" categoryGroups={categoryGroups} series={safeSeries} contentEditor={<TopicMarkdownEditor defaultValue={defaultContent} variant="compact" />} />,
            },
            {
              id: "faq",
              label: "الأسئلة الشائعة",
              content: <FaqEditor />,
            },
            {
              id: "seo",
              label: "SEO والتحليل",
              content: (
                <SeoPanel
                  title=""
                  excerpt=""
                  slug=""
                  content={defaultContent}
                  image=""
                  imageAlt=""
                  seoTitle=""
                  seoDescription=""
                  seoKeywords={[]}
                  focusKeyword=""
                  canonicalUrl=""
                  robotsIndex={null}
                  robotsFollow={null}
                  faq={[]}
                  hideImageAltField
                />
              ),
            },
            {
              id: "publish",
              label: "المراجعة والنشر",
              content: (
                <div className="space-y-6">
                  <TopicPublishingOptions status="draft" />
                  <TopicPublishChecklistPanel formId="topic-create-form" initial={publishInput} status="draft" />
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
