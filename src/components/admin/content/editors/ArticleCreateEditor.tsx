import AdminNotice from "../../AdminNotice";
import { AdminActionButton, AdminPageContextHeader } from "../../ui";
import SeoPanel from "../../SeoPanel";
import FaqEditor from "./article/FaqEditor";
import TopicEditTabs from "./article/TopicEditTabs";
import TopicBasicDataPanel from "./article/TopicBasicDataPanel";
import TopicMarkdownEditor from "./article/TopicMarkdownEditor";
import { buildArticleTopicCategoryFilterGroups } from "../../../../lib/admin/article-topic-categories";
import TopicPublishChecklistPanel from "../../content-workflow/TopicPublishChecklistPanel";
import { topicRowToPublishInput } from "../../../../lib/admin/content-workflow/topic-publish-validation";
import { createTopic } from "../../../../app/admin/content/topics/article-actions";
import type { ArticleEditorCategory, ArticleEditorSeries } from "./ArticleEditor";
import TopicPublishingOptions from "./article/TopicPublishingOptions";
import SaveBar from "../../SaveBar";

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

      <form id="topic-create-form" action={createTopic} className="space-y-7" noValidate>
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
                  <TopicPublishingOptions status="draft">
                    <SaveBar mode="create" />
                  </TopicPublishingOptions>
                  <TopicPublishChecklistPanel formId="topic-create-form" initial={publishInput} status="draft" />
                </div>
              ),
            },
          ]}
        />

      </form>
    </main>
  );
}
