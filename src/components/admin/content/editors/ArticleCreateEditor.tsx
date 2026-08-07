import {
  AdminActionButton,
  AdminPageContextHeader,
  AdminPageExperience,
} from "../../ui";
import SeoPanel from "../../SeoPanel";
import FaqEditor from "./article/FaqEditor";
import ContentBasicDataPanel from "./ContentBasicDataPanel";
import ContentEditorShell from "./ContentEditorShell";
import ContentPublishingOptions from "./ContentPublishingOptions";
import ContentDisplaySettings from "./ContentDisplaySettings";
import TopicMarkdownEditor from "./article/TopicMarkdownEditor";
import ContentReviewPanel from "../../content-workflow/ContentReviewPanel";
import { topicRowToPublishInput } from "../../../../lib/admin/content-workflow/topic-publish-validation";
import { saveContentForm } from "../../../../app/admin/content/topics/editor-actions/save";
import type { ArticleEditorCategory, ArticleEditorSeries } from "./ArticleEditor";
import { createAdminFormErrorState } from "../../../../lib/admin/form-runtime";
import TopicMediaCatalogSyncSignal from "./article/TopicMediaCatalogSyncSignal";
import {
  buildAdminCategoryTree,
  flattenAdminCategoryTree,
} from "../../../../lib/admin/content/category-hierarchy";

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
  const categoryOptions = flattenAdminCategoryTree(
    buildAdminCategoryTree(safeCategories),
  );
  const safeSeries = series;
  const defaultContent = "# عنوان المقال\n\nابدأ كتابة المقال هنا...\n\n## عنوان فرعي\n\nاكتب الفقرة هنا...";
  const publishInput = topicRowToPublishInput({ content: defaultContent });

  return (
    <AdminPageExperience dir="rtl">
      <AdminPageContextHeader
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
        tabs={[
            {
              id: "basic",
              navigationLabel: "المحتوى",
              sectionHeading: "بيانات الموضوع والمحتوى",
              sectionDescription: "اكتب المحتوى الأساسي واضبط التصنيف والصورة وإعدادات الظهور.",
              icon: "content",
              content: (
                <ContentBasicDataPanel
                  formId="topic-create-form"
                  contentType="article"
                  mode="create"
                  categories={categoryOptions}
                  series={safeSeries}
                  contentEditor={<TopicMarkdownEditor defaultValue={defaultContent} variant="compact" />}
                  displaySettings={<ContentDisplaySettings />}
                />
              ),
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
                  ogImage=""
                  ogImageAlt=""
                  faq={[]}
                />
              ),
            },
            {
              id: "publish",
              navigationLabel: "المراجعة",
              icon: "publish",
              content: (
                <ContentReviewPanel
                  formId="topic-create-form"
                  initial={{
                    ...publishInput,
                    contentType: "article",
                    canonicalUrl: publishInput.canonicalUrl ?? "",
                    ogImage: publishInput.ogImage ?? "",
                    ogImageAlt: publishInput.ogImageAlt ?? "",
                    mediaPayload: null,
                  }}
                  publishingOptions={
                    <ContentPublishingOptions
                      status="unpublished"
                      popular={false}
                      dateLabel={null}
                    />
                  }
                  status="unpublished"
                  contentTypeLabel="مقال"
                />
              ),
            },
        ]}
      />
    </AdminPageExperience>
  );
}
