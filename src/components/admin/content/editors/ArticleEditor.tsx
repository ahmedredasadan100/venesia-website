import Link from "next/link";
import AdminNotice from "../../AdminNotice";
import { AdminActionButton, AdminPageContextHeader } from "../../ui";
import SaveBar from "../../SaveBar";
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
import {
  publishTopic,
  saveDraftTopic,
  saveTopic,
  saveTopicAndClose,
  unpublishTopic,
} from "../../../../app/admin/content/topics/article-actions";

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
  status: string | null;
  published_at: string | null;
  updated_at: string | null;
  is_featured: boolean | null;
  is_popular: boolean | null;
};
function getNoticeText(notice?: string) {
  if (notice === "created") return "تم إنشاء الموضوع كمسودة بنجاح.";
  if (notice === "saved") return "تم حفظ التعديلات بنجاح.";
  if (notice === "draft") return "تم حفظ الموضوع كمسودة بنجاح.";
  if (notice === "published") return "تم نشر الموضوع بنجاح.";
  if (notice === "unpublished") return "تم إخفاء الموضوع بنجاح مع الحفاظ على تاريخ أول نشر.";
  return null;
}

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
  notice,
  errorMessage,
}: {
  topic: ArticleEditorTopic;
  categories: ArticleEditorCategory[];
  series: ArticleEditorSeries[];
  notice?: string;
  errorMessage?: string | null;
}) {
  const safeCategories = categories;
  const categoryGroups = buildArticleTopicCategoryFilterGroups(safeCategories);
  const safeSeries = series;
  const faq = getFaq(topic.faq);
  const seoKeywords = getSeoKeywords(topic.seo_keywords);
  const noticeText = getNoticeText(notice);
  const status = topic.status || "draft";
  const publishInput = topicRowToPublishInput({ ...topic, faq });

  return (
    <main className="space-y-7">
      <AdminPageContextHeader
        eyebrow="EDIT TOPIC"
        contextLine="تعديل موضوع:"
        title={truncateWords(topic.title || "بدون عنوان")}
        actions={
          <>
            <AdminActionButton href="/admin/content/topics" variant="dark">عرض الموضوعات</AdminActionButton>
            <AdminActionButton href="/admin/content/categories" variant="dark">عرض التصنيفات</AdminActionButton>
            <AdminActionButton href="/admin/content/series" variant="dark">عرض السلاسل</AdminActionButton>
            <Link href={`/admin/content/topics/${topic.id}/preview`} target="_blank" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#080B10]/70 px-4 py-2.5 text-sm font-semibold text-white/72 transition hover:border-white/18 hover:bg-white/[0.05]">معاينة داخلية</Link>
          </>
        }
      />

      {noticeText ? <AdminNotice variant="success" message={noticeText} /> : null}
      {errorMessage ? <AdminNotice variant="danger" title="تعذر تنفيذ العملية" message={errorMessage} /> : null}

      <form id="topic-edit-form" key={topic.id} action={saveTopic} className="space-y-7" noValidate>
        <input type="hidden" name="id" value={topic.id} />
        <input type="hidden" name="status" value={status} />

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
                      <input name="title" required defaultValue={topic.title ?? ""} placeholder="مثال: أفضل حي في بيت الوطن للسكن" className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-xl font-semibold text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45" />
                    </label>

                    <TopicSlugInput defaultValue={topic.slug ?? ""} />

                    <label className="block">
                      <span className="text-sm font-medium text-white/70">التصنيف</span>
                      <ArticleTopicCategorySelect groups={categoryGroups} defaultValue={topic.category_slug ?? ""} />
                    </label>

                    <label className="block lg:col-span-2">
                      <span className="text-sm font-medium text-white/70">الوصف المختصر</span>
                      <textarea name="excerpt" rows={4} defaultValue={topic.excerpt ?? ""} placeholder="اكتب وصفًا مختصرًا واضحًا للمقال..." className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45" />
                    </label>

                    <TopicImageField defaultImage={topic.image ?? ""} defaultAlt={topic.image_alt ?? ""} formId="topic-edit-form" />
                    <TopicSeriesFields options={safeSeries} defaultSeriesId={topic.series_id ?? ""} defaultSeries={topic.series ?? ""} defaultSeriesSlug={topic.series_slug ?? ""} />
                    <TopicDateLabelField defaultValue={topic.date_label ?? ""} publishedAt={topic.published_at} />
                  </div>
                </section>
              ),
            },
            {
              id: "content",
              label: "المحتوى",
              content: <TopicMarkdownEditor defaultValue={topic.content ?? ""} />,
            },
            {
              id: "faq",
              label: "الأسئلة الشائعة (FAQ)",
              content: <FaqEditor defaultFaq={faq} />,
            },
            {
              id: "seo",
              label: "SEO",
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
                  faq={faq}
                  hideImageAltField
                />
              ),
            },
            {
              id: "publish",
              label: "النشر",
              content: (
                <div className="space-y-6">
                  <TopicPublishChecklistPanel formId="topic-edit-form" initial={publishInput} />
                  <section className="max-w-xl rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                  <p className="font-en text-xs tracking-[0.34em] text-[#D8B87A]/70">PUBLISHING</p>
                  <h3 className="mt-3 text-xl font-semibold text-white">إعدادات الظهور</h3>
                  <div className="mt-6 space-y-4">
                    <InfoLine label="الحالة الحالية" value={status} />
                    <InfoLine label="أول نشر" value={topic.published_at ? new Date(topic.published_at).toLocaleDateString("ar-EG") : "لم ينشر بعد"} />
                    <InfoLine label="آخر تعديل" value={topic.updated_at ? new Date(topic.updated_at).toLocaleString("ar-EG") : "غير متاح"} />
                    <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/70">
                      <span>موضوع مميز</span>
                      <input type="checkbox" name="is_featured" defaultChecked={Boolean(topic.is_featured)} className="h-4 w-4 accent-[#D8B87A]" />
                    </label>
                    <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/70">
                      <span>موضوع شائع</span>
                      <input type="checkbox" name="is_popular" defaultChecked={Boolean(topic.is_popular)} className="h-4 w-4 accent-[#D8B87A]" />
                    </label>
                  </div>
                </section>
                </div>
              ),
            },
          ]}
        />

        <SaveBar topicId={topic.id} slug={topic.slug} status={status} saveAction={saveTopic} saveAndCloseAction={saveTopicAndClose} draftAction={saveDraftTopic} publishAction={publishTopic} unpublishAction={unpublishTopic} />
      </form>
    </main>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
      <p className="text-xs text-white/35">{label}</p>
      <p className="mt-1 text-sm text-white/70">{value}</p>
    </div>
  );
}
