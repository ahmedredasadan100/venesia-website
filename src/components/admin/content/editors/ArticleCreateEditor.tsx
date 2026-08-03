import {
  AdminActionButton,
  AdminFormActions,
  AdminPageContextHeader,
  AdminPageExperience,
  ADMIN_FORM_STACK_CLASS_NAME,
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
import { createAdminFormErrorState } from "../../../../lib/admin/form-runtime";
import TopicMediaCatalogSyncSignal from "./article/TopicMediaCatalogSyncSignal";

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
    <AdminPageExperience dir="rtl">
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

      <TopicMediaCatalogSyncSignal formId="topic-create-form" />

      <AdminFormRuntime
        action={saveTopicForm}
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
        entityKey="topic"
        closeHref="/admin/content/topics"
        navigation={TOPIC_FORM_NAVIGATION}
        formId="topic-create-form"
        className={ADMIN_FORM_STACK_CLASS_NAME}
      >
        <input type="hidden" name="content_type" value="article" />
        <TopicEditTabs
          tabs={[
            {
              id: "basic",
              navigationLabel: "المحتوى",
              sectionHeading: "بيانات الموضوع والمحتوى",
              sectionDescription: "اكتب المحتوى الأساسي واضبط التصنيف والصورة وإعدادات الظهور.",
              icon: "content",
              content: <TopicBasicDataPanel formId="topic-create-form" contentType="article" contentTypeMode="create" categoryGroups={categoryGroups} series={safeSeries} contentEditor={<TopicMarkdownEditor defaultValue={defaultContent} variant="compact" />} />,
            },
            {
              id: "faq",
              navigationLabel: "الأسئلة",
              sectionHeading: "الأسئلة الشائعة وإعدادات الظهور",
              sectionDescription: "أضف الأسئلة والأجوبة وحدد طريقة ظهور القسم في صفحة الموضوع.",
              icon: "faq",
              content: <FaqEditor />,
            },
            {
              id: "seo",
              navigationLabel: "SEO",
              sectionHeading: "تحسين محركات البحث والمشاركة",
              sectionDescription: "راجع الأساسيات والمشاركة الاجتماعية والتحليل من عرض واحد منظم.",
              icon: "seo",
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
                />
              ),
            },
            {
              id: "publish",
              navigationLabel: "المراجعة",
              sectionHeading: "مراجعة الجاهزية والنشر",
              sectionDescription: "راجع الحالة والملخص والتحذيرات قبل حفظ قرار النشر.",
              icon: "publish",
              content: (
                <TopicPublishingOptions status="draft">
                  <TopicPublishChecklistPanel
                    formId="topic-create-form"
                    initial={publishInput}
                    status="draft"
                  />
                </TopicPublishingOptions>
              ),
            },
          ]}
        />
        <AdminFormActions />
      </AdminFormRuntime>
    </AdminPageExperience>
  );
}
