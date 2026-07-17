import AdminNotice from "../../AdminNotice";
import { AdminActionButton, AdminPageContextHeader } from "../../ui";
import SeoPanel from "../../SeoPanel";
import FaqEditor from "./article/FaqEditor";
import TopicEditTabs from "./article/TopicEditTabs";
import TopicDateLabelField from "./article/TopicDateLabelField";
import TopicImageField from "./article/TopicImageField";
import TopicMarkdownEditor from "./article/TopicMarkdownEditor";
import TopicSeriesFields from "./article/TopicSeriesFields";
import TopicSlugInput from "./article/TopicSlugInput";
import { buildArticleTopicCategoryFilterGroups } from "../../../../lib/admin/article-topic-categories";
import ArticleTopicCategorySelect from "./article/ArticleTopicCategorySelect";
import TopicPublishChecklistPanel from "../../content-workflow/TopicPublishChecklistPanel";
import { topicRowToPublishInput } from "../../../../lib/admin/content-workflow/topic-publish-validation";
import { createTopic } from "../../../../app/admin/content/topics/article-actions";
import type { ArticleEditorCategory, ArticleEditorSeries } from "./ArticleEditor";

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
        <TopicEditTabs
          tabs={[
            {
              id: "basic",
              label: "بيانات أساسية",
              content: (
                <section className="rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                  <div className="grid gap-6 lg:grid-cols-2">
                    <label className="block lg:col-span-2">
                      <span className="text-sm font-medium text-white/70">عنوان الموضوع</span>
                      <input name="title" required placeholder="مثال: أفضل حي في بيت الوطن للسكن" className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-xl font-semibold text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45" />
                    </label>

                    <TopicSlugInput />

                    <label className="block">
                      <span className="text-sm font-medium text-white/70">التصنيف</span>
                      <ArticleTopicCategorySelect groups={categoryGroups} />
                    </label>

                    <label className="block lg:col-span-2">
                      <span className="text-sm font-medium text-white/70">الوصف المختصر</span>
                      <textarea name="excerpt" rows={4} placeholder="اكتب وصفًا مختصرًا واضحًا للمقال..." className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45" />
                    </label>

                    <TopicImageField formId="topic-create-form" />
                    <TopicSeriesFields options={safeSeries} />
                    <TopicDateLabelField />
                  </div>
                </section>
              ),
            },
            {
              id: "content",
              label: "المحتوى",
              content: <TopicMarkdownEditor defaultValue={defaultContent} />,
            },
            {
              id: "faq",
              label: "الأسئلة الشائعة (FAQ)",
              content: <FaqEditor />,
            },
            {
              id: "seo",
              label: "SEO",
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
                  faq={[]}
                  hideImageAltField
                />
              ),
            },
            {
              id: "publish",
              label: "النشر",
              content: (
                <div className="space-y-6">
                  <TopicPublishChecklistPanel formId="topic-create-form" initial={publishInput} />
                  <section className="max-w-xl rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                  <p className="font-en text-xs tracking-[0.34em] text-[#D8B87A]/70">PUBLISHING</p>
                  <h3 className="mt-3 text-xl font-semibold text-white">إعدادات الظهور</h3>
                  <div className="mt-6 space-y-4">
                    <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/70">
                      <span>موضوع مميز</span>
                      <input type="checkbox" name="is_featured" className="h-4 w-4 accent-[#D8B87A]" />
                    </label>
                    <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/70">
                      <span>موضوع شائع</span>
                      <input type="checkbox" name="is_popular" className="h-4 w-4 accent-[#D8B87A]" />
                    </label>
                  </div>
                </section>
                </div>
              ),
            },
          ]}
        />

        <div className="sticky bottom-5 z-40 mt-8 rounded-[26px] border border-white/10 bg-[#080B10]/95 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">إنشاء الموضوع</p>
              <p className="mt-1 text-xs text-white/45">المسودة تحتاج العنوان والتصنيف والـ Slug فقط. النشر يحتاج نسخة مكتملة.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" name="intent" value="draft" className="rounded-full bg-[#D8B87A] px-6 py-3 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]">إنشاء كمسودة</button>
              <button type="submit" name="intent" value="publish" className="rounded-full border border-emerald-400/30 px-6 py-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/10">إنشاء ونشر</button>
            </div>
          </div>
        </div>
      </form>
    </main>
  );
}
