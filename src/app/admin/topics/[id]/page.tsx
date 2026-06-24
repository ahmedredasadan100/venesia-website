import Link from "next/link";
import { notFound } from "next/navigation";
import AdminNotice from "../../../../components/admin/AdminNotice";
import AdminPageHeader from "../../../../components/admin/AdminPageHeader";
import AdminStatusBadge from "../../../../components/admin/AdminStatusBadge";
import SaveBar from "../../../../components/admin/SaveBar";
import SeoPanel from "../../../../components/admin/SeoPanel";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import FaqEditor from "../FaqEditor";
import TopicEditTabs from "../TopicEditTabs";
import TopicDateLabelField from "../TopicDateLabelField";
import TopicImageField from "../TopicImageField";
import TopicMarkdownEditor from "../TopicMarkdownEditor";
import TopicSeriesFields from "../TopicSeriesFields";
import TopicSlugInput from "../TopicSlugInput";
import { filterEditorTopicCategories } from "../../../../lib/admin/cms-test-data";
import { publishTopic, saveDraftTopic, saveTopic, saveTopicAndClose, unpublishTopic } from "../actions";

export const dynamic = "force-dynamic";

type TopicFaqItem = { question?: string; answer?: string };
type CategoryRow = { name: string; slug: string };
function getNoticeText(notice?: string) {
  if (notice === "created") return "تم إنشاء الموضوع كمسودة بنجاح.";
  if (notice === "saved") return "تم حفظ التعديلات بنجاح.";
  if (notice === "draft") return "تم حفظ الموضوع كمسودة بنجاح.";
  if (notice === "published") return "تم نشر الموضوع بنجاح.";
  if (notice === "unpublished") return "تم إخفاء الموضوع بنجاح مع الحفاظ على تاريخ أول نشر.";
  return null;
}

function getAdminStatus(status?: string | null) {
  if (status === "unpublished") return "hidden";
  return status || "draft";
}

function getSeoKeywords(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function getFaq(value: unknown): TopicFaqItem[] {
  return Array.isArray(value) ? value : [];
}

export default async function EditTopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ notice?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const [{ data: topic }, { data: categories }, { data: seriesRows }] = await Promise.all([
    getSupabaseAdmin().from("topics").select("*").eq("id", id).maybeSingle(),
    getSupabaseAdmin().from("topic_categories").select("name, slug").eq("is_active", true).order("sort_order", { ascending: true }),
    getSupabaseAdmin().from("topic_series").select("id, name, slug").eq("status", "published").order("sort_order", { ascending: true }).order("name", { ascending: true }),
  ]);

  if (!topic) notFound();

  const safeCategories = filterEditorTopicCategories((categories ?? []) as CategoryRow[]);
  const safeSeries = (seriesRows ?? []) as { id: number; name: string; slug: string }[];
  const faq = getFaq(topic.faq);
  const seoKeywords = getSeoKeywords(topic.seo_keywords);
  const notice = getNoticeText(query?.notice);
  const errorMessage = query?.error ? decodeURIComponent(query.error) : null;
  const status = topic.status || "draft";

  return (
    <main className="space-y-7">
      <AdminPageHeader
        eyebrow="EDIT TOPIC"
        title={topic.title || "تحرير موضوع"}
        description="تحرير المقال، إعدادات النشر، السيو، الصورة، الأسئلة الشائعة، وحالة الظهور من صفحة واحدة منظمة."
        actions={
          <>
            <AdminStatusBadge status={getAdminStatus(status)} />
            <Link href="/admin/topics" className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white/65 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A]">رجوع للقائمة</Link>
            <Link href={`/admin/topics/${topic.id}/preview`} target="_blank" className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white/70 transition hover:border-white/30 hover:text-white">معاينة داخلية</Link>
            {topic.slug ? <Link href={`/topics/${topic.slug}`} target="_blank" className="rounded-full border border-[#D8B87A]/35 px-5 py-3 text-sm font-medium text-[#D8B87A] transition hover:bg-[#D8B87A]/10">النسخة العامة</Link> : null}
          </>
        }
      />

      {notice ? <AdminNotice variant="success" message={notice} /> : null}
      {errorMessage ? <AdminNotice variant="danger" title="تعذر تنفيذ العملية" message={errorMessage} /> : null}

      <form action={saveTopic} className="space-y-7" noValidate>
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
                      <select name="category_slug" required defaultValue={topic.category_slug ?? ""} className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45">
                        <option value="">اختر التصنيف</option>
                        {safeCategories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}
                      </select>
                    </label>

                    <label className="block lg:col-span-2">
                      <span className="text-sm font-medium text-white/70">الوصف المختصر</span>
                      <textarea name="excerpt" rows={4} defaultValue={topic.excerpt ?? ""} placeholder="اكتب وصفًا مختصرًا واضحًا للمقال..." className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45" />
                    </label>

                    <TopicImageField defaultImage={topic.image ?? ""} defaultAlt={topic.image_alt ?? ""} />
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
