import Link from "next/link";
import AdminNotice from "../../../components/admin/AdminNotice";
import AdminPageHeader from "../../../components/admin/AdminPageHeader";
import AdminTopicsFilters from "../../../components/admin/AdminTopicsFilters";
import { ADMIN_DATA_GRID_ACTION_COLUMNS } from "../../../components/admin/ui";
import { analyzeTopicSeo } from "../../../lib/admin/seo-score";
import { formatAdminListDate } from "../../../lib/content-dates";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { bulkUpdateTopics } from "./actions";
import TopicListControls from "./TopicListControls";
import TopicRowActions from "./TopicRowActions";
import CopySlugButton from "./CopySlugButton";

const TOPICS_TABLE_COLUMNS = `46px minmax(320px,1fr) 150px 125px 88px ${ADMIN_DATA_GRID_ACTION_COLUMNS.fiveCompact}`;

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  status?: string;
  category?: string;
  period?: string;
  sort?: string;
  featured?: string;
  popular?: string;
  limit?: string;
  page?: string;
  notice?: string;
};

type TopicFaq = {
  question?: string;
  answer?: string;
};

type TopicRow = {
  id: number;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  content: string | null;
  image: string | null;
  image_alt: string | null;
  category: string | null;
  category_slug: string | null;
  status: string | null;
  is_featured: boolean | null;
  is_popular: boolean | null;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  focus_keyword: string | null;
  faq: TopicFaq[] | null;
};

type CategoryRow = {
  name: string;
  slug: string;
};

const LIMIT_OPTIONS = ["10", "25", "50", "100", "all"];
const DEFAULT_LIMIT = "10";

function cleanSearch(value: string) {
  return value.replace(/[,%]/g, " ").replace(/\s+/g, " ").trim();
}

function getPositiveNumber(value: string | undefined, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function getDateFromPeriod(period: string) {
  const date = new Date();

  if (period === "today") {
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
  }

  if (period === "7days") {
    date.setDate(date.getDate() - 7);
    return date.toISOString();
  }

  if (period === "30days") {
    date.setDate(date.getDate() - 30);
    return date.toISOString();
  }

  return null;
}

function getNoticeText(notice?: string) {
  if (notice === "published") return "تم نشر الموضوع بنجاح.";
  if (notice === "unpublished") return "تم إخفاء الموضوع بنجاح.";
  if (notice === "deleted") return "تم حذف الموضوع حذفًا آمنًا.";
  if (notice === "saved") return "تم حفظ التعديلات بنجاح.";
  if (notice === "created") return "تم إنشاء الموضوع أو النسخة بنجاح.";
  if (notice === "error") return "تعذر تنفيذ العملية. راجع البيانات وحاول مرة أخرى.";
  return null;
}

function getSeoScore(topic: TopicRow) {
  return analyzeTopicSeo({
    title: topic.title ?? "",
    excerpt: topic.excerpt ?? "",
    slug: topic.slug ?? "",
    content: topic.content ?? "",
    image: topic.image ?? "",
    imageAlt: topic.image_alt ?? "",
    seoTitle: topic.seo_title ?? "",
    seoDescription: topic.seo_description ?? "",
    seoKeywords: Array.isArray(topic.seo_keywords) ? topic.seo_keywords : [],
    focusKeyword: topic.focus_keyword ?? "",
    faq: Array.isArray(topic.faq) ? topic.faq : [],
  });
}

function buildHref(params: URLSearchParams, patch: Record<string, string | null>) {
  const next = new URLSearchParams(params.toString());

  Object.entries(patch).forEach(([key, value]) => {
    if (!value) next.delete(key);
    else next.set(key, value);
  });

  const query = next.toString();
  return query ? `/admin/topics?${query}#topics-table` : "/admin/topics#topics-table";
}


function getNextSort(currentSort: string, column: "title" | "category" | "updated" | "status") {
  const map: Record<string, [string, string]> = {
    title: ["title_asc", "title_desc"],
    category: ["category_asc", "category_desc"],
    updated: ["updated_desc", "updated_asc"],
    status: ["status_asc", "status_desc"],
  };

  const [first, second] = map[column];
  return currentSort === first ? second : first;
}

function SortHeader({
  label,
  href,
}: {
  label: string;
  href: string;
}) {
  return (
    <Link href={href} className="inline-flex items-center justify-center gap-2 transition hover:text-[#D8B87A]">
      {label}
      <span className="font-en text-[10px] text-white/35">↕</span>
    </Link>
  );
}

function TopicFileIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M7 3.75h6.2L18 8.55v11.7H7V3.75Z" stroke="#E7B94F" fill="rgba(216,184,122,0.08)" />
      <path d="M13.1 4.1v4.75h4.65" stroke="#F1C668" />
      <path d="M9.7 12.3h5.4M9.7 15.3h4.2" stroke="#F1C668" strokeLinecap="round" />
    </svg>
  );
}

function StatusPill({ status }: { status?: string | null }) {
  const normalized = status || "draft";
  const label = normalized === "published" ? "منشور" : normalized === "unpublished" ? "مخفي" : normalized === "archived" ? "أرشيف" : "مسودة";
  const className =
    normalized === "published"
      ? "border-emerald-400/18 bg-emerald-500/18 text-emerald-100"
      : normalized === "unpublished"
      ? "border-orange-400/20 bg-orange-500/12 text-orange-100"
      : normalized === "archived"
      ? "border-white/12 bg-white/[0.08] text-white/58"
      : "border-white/12 bg-white/[0.08] text-white/64";

  return <span className={`inline-flex min-w-[56px] justify-center rounded-full border px-2.5 py-1.5 text-xs font-semibold ${className}`}>{label}</span>;
}

function BulkActionsBar({ categories, currentListPath }: { categories: CategoryRow[]; currentListPath: string }) {
  return (
    <form
      id="topics-bulk-form"
      action={bulkUpdateTopics}
      data-topic-bulk-bar
      hidden
      className="mb-3 rounded-[14px] border border-[#D8B87A]/16 bg-[#0B1016] p-3 shadow-[0_18px_55px_rgba(0,0,0,0.32)]"
    >
      <input type="hidden" name="redirect_to" value={currentListPath} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">
          تم تحديد <span data-topic-bulk-count className="font-en text-[#D8B87A]">0</span> موضوع
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            name="bulk_action"
            defaultValue="publish"
            className="h-10 rounded-[8px] border border-white/10 bg-black/22 px-3 text-sm text-white/72 outline-none focus:border-[#D8B87A]/35"
          >
            <option value="publish">نشر</option>
            <option value="unpublish">إخفاء</option>
            <option value="archive">أرشفة</option>
            <option value="delete">حذف آمن</option>
            <option value="move_category">نقل لتصنيف</option>
            <option value="feature">تعيين كمميز</option>
            <option value="unfeature">إلغاء التمييز</option>
          </select>

          <select
            name="category_slug"
            defaultValue=""
            className="h-10 rounded-[8px] border border-white/10 bg-black/22 px-3 text-sm text-white/72 outline-none focus:border-[#D8B87A]/35"
          >
            <option value="">اختر التصنيف عند النقل</option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>

          <button className="h-10 rounded-full bg-[#D8B87A] px-5 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]">
            تنفيذ
          </button>
          <button
            type="button"
            data-topic-clear-selection
            className="h-10 rounded-full border border-white/10 px-5 text-sm text-white/62 transition hover:border-white/20 hover:text-white"
          >
            إلغاء التحديد
          </button>
        </div>
      </div>
    </form>
  );
}

function AdminTopicsTotalBar({ count }: { count: number }) {
  return (
    <div className="mt-4 flex h-16 items-center justify-center gap-3 rounded-[10px] border border-white/8 bg-black/18 text-sm text-white/72">
      <TopicFileIcon />
      <span>إجمالي الموضوعات : {count}</span>
    </div>
  );
}

export default async function AdminTopicsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const q = cleanSearch(params?.q ?? "");
  const status = params?.status ?? "all";
  const category = params?.category ?? "all";
  const period = params?.period ?? "all";
  const sort = params?.sort ?? "created_desc";
  const featured = params?.featured ?? "all";
  const popular = params?.popular ?? "all";
  const rawLimit = params?.limit ?? DEFAULT_LIMIT;
  const limitValue = LIMIT_OPTIONS.includes(rawLimit) ? rawLimit : DEFAULT_LIMIT;
  const currentPage = getPositiveNumber(params?.page, 1);
  const notice = getNoticeText(params?.notice);

  const queryParams = new URLSearchParams();
  if (q) queryParams.set("q", q);
  if (status !== "all") queryParams.set("status", status);
  if (category !== "all") queryParams.set("category", category);
  if (period !== "all") queryParams.set("period", period);
  if (sort !== "created_desc") queryParams.set("sort", sort);
  if (featured !== "all") queryParams.set("featured", featured);
  if (popular !== "all") queryParams.set("popular", popular);
  if (limitValue !== DEFAULT_LIMIT) queryParams.set("limit", limitValue);
  if (currentPage > 1) queryParams.set("page", String(currentPage));

  const currentListPath = queryParams.toString()
    ? `/admin/topics?${queryParams.toString()}`
    : "/admin/topics";

  const dateFrom = getDateFromPeriod(period);

  let query = getSupabaseAdmin()
    .from("topics")
    .select(
      "id, title, slug, excerpt, content, image, image_alt, category, category_slug, status, is_featured, is_popular, published_at, created_at, updated_at, deleted_at, seo_title, seo_description, seo_keywords, focus_keyword, faq",
      { count: "exact" }
    )
    .is("deleted_at", null);

  if (q) {
    query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%,category.ilike.%${q}%,excerpt.ilike.%${q}%`);
  }

  if (status !== "all") query = query.eq("status", status);
  if (category !== "all") query = query.eq("category_slug", category);
  if (featured === "yes") query = query.eq("is_featured", true);
  if (featured === "no") query = query.eq("is_featured", false);
  if (popular === "yes") query = query.eq("is_popular", true);
  if (popular === "no") query = query.eq("is_popular", false);
  if (dateFrom) query = query.gte("created_at", dateFrom);

  if (sort === "created_asc") query = query.order("created_at", { ascending: true });
  else if (sort === "updated_desc") query = query.order("updated_at", { ascending: false });
  else if (sort === "updated_asc") query = query.order("updated_at", { ascending: true });
  else if (sort === "id_desc") query = query.order("id", { ascending: false });
  else if (sort === "id_asc") query = query.order("id", { ascending: true });
  else if (sort === "title_asc") query = query.order("title", { ascending: true });
  else if (sort === "title_desc") query = query.order("title", { ascending: false });
  else if (sort === "category_asc") query = query.order("category", { ascending: true });
  else if (sort === "category_desc") query = query.order("category", { ascending: false });
  else if (sort === "status_asc") query = query.order("status", { ascending: true });
  else if (sort === "status_desc") query = query.order("status", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  const perPage = limitValue === "all" ? null : Number(limitValue);
  const from = perPage ? (currentPage - 1) * perPage : 0;
  const to = perPage ? from + perPage - 1 : undefined;

  if (perPage) query = query.range(from, to as number);

  const [
    { data: topics, error, count },
    { data: categories },
    totalStats,
    publishedStats,
    draftStats,
    hiddenStats,
    archivedStats,
  ] = await Promise.all([
    query,
    getSupabaseAdmin()
      .from("topic_categories")
      .select("name, slug")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    getSupabaseAdmin().from("topics").select("id", { count: "exact", head: true }).is("deleted_at", null),
    getSupabaseAdmin()
      .from("topics")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .is("deleted_at", null),
    getSupabaseAdmin()
      .from("topics")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft")
      .is("deleted_at", null),
    getSupabaseAdmin()
      .from("topics")
      .select("id", { count: "exact", head: true })
      .eq("status", "unpublished")
      .is("deleted_at", null),
    getSupabaseAdmin().from("topics").select("id", { count: "exact", head: true }).not("deleted_at", "is", null),
  ]);

  const safeTopics = (topics ?? []) as TopicRow[];
  const safeCategories = (categories ?? []) as CategoryRow[];

  const totalCount = count ?? 0;
  const totalPages = perPage ? Math.max(1, Math.ceil(totalCount / perPage)) : 1;
  const allTopicsCount = totalStats.count ?? 0;
  const publishedCount = publishedStats.count ?? 0;
  const draftCount = draftStats.count ?? 0;
  const hiddenCount = hiddenStats.count ?? 0;
  const archivedCount = archivedStats.count ?? 0;
  const averageSeo =
    safeTopics.length > 0
      ? Math.round(
          safeTopics.reduce((sum, topic) => sum + getSeoScore(topic).overallScore, 0) /
            safeTopics.length
        )
      : 0;

  return (
    <main className="space-y-7">
      <TopicListControls />
      <AdminPageHeader
        eyebrow="TOPICS CONTROL"
        title="إدارة موضوعات تهمك"
        description="إدارة المقالات، الفلاتر، النشر، الإخفاء، الحذف الآمن، وقياس جودة السيو لكل صفحة من مكان واحد."
        actions={
          <>
            <Link
              href="/admin/topics/categories"
              className="rounded-full border border-[#D8B87A]/35 px-5 py-3 text-sm font-medium text-[#D8B87A] transition hover:bg-[#D8B87A]/10"
            >
              إدارة التصنيفات
            </Link>

            <Link
              href="/admin/topics/new"
              className="rounded-full bg-[#D8B87A] px-5 py-3 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]"
            >
              + موضوع جديد
            </Link>
          </>
        }
      />

      {notice ? <AdminNotice variant="success" message={notice} /> : null}

      {error ? (
        <AdminNotice variant="danger" title="تعذر تحميل الموضوعات" message={error.message} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-6">
        <AdminMetricCard label="إجمالي الموضوعات" value={allTopicsCount} />
        <AdminMetricCard label="منشور" value={publishedCount} />
        <AdminMetricCard label="مسودات" value={draftCount} />
        <AdminMetricCard label="مخفي" value={hiddenCount} />
        <AdminMetricCard label="أرشيف" value={archivedCount} />
        <AdminMetricCard label="متوسط SEO" value={averageSeo} suffix="/100" />
      </section>

      <AdminTopicsFilters
        q={q}
        status={status}
        category={category}
        period={period}
        sort={sort}
        featured={featured}
        popular={popular}
        limit={limitValue}
        categories={safeCategories}
        currentPage={currentPage}
        totalPages={totalPages}
      />

      <section id="topics-table" className="scroll-mt-6 rounded-[20px] border border-[#D8B87A]/12 bg-[#080B10]/86 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-xl">
        <BulkActionsBar categories={safeCategories} currentListPath={currentListPath} />
        <div className="overflow-hidden rounded-[14px] border border-white/8 bg-black/14">
          <div className={`grid items-center gap-4 border-b border-[#D8B87A]/12 bg-white/[0.045] px-5 py-4 text-sm font-bold text-white max-xl:hidden`} style={{ gridTemplateColumns: TOPICS_TABLE_COLUMNS }}>
            <label className="flex items-center justify-center">
              <input type="checkbox" data-topic-select-all className="h-4 w-4 accent-[#D8B87A]" />
            </label>
            <span className="text-right">
              <SortHeader label="الموضوع" href={buildHref(queryParams, { sort: getNextSort(sort, "title"), page: "1" })} />
            </span>
            <span className="text-center">
              <SortHeader label="التصنيف" href={buildHref(queryParams, { sort: getNextSort(sort, "category"), page: "1" })} />
            </span>
            <span className="text-center">
              <SortHeader label="تاريخ النشر" href={buildHref(queryParams, { sort: getNextSort(sort, "updated"), page: "1" })} />
            </span>
            <span className="text-center">
              <SortHeader label="الحالة" href={buildHref(queryParams, { sort: getNextSort(sort, "status"), page: "1" })} />
            </span>
            <span className="text-center">الإجراءات</span>
          </div>

          {safeTopics.length > 0 ? (
            <div className="divide-y divide-white/8">
              {safeTopics.map((topic) => {
                const slug = topic.slug ?? "";

                return (
                  <article
                    key={topic.id}
                    className="grid gap-4 px-5 py-4 transition hover:bg-white/[0.035] xl:items-center"
                    style={{ gridTemplateColumns: TOPICS_TABLE_COLUMNS }}
                  >
                    <label className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        name="topic_ids"
                        value={topic.id}
                        form="topics-bulk-form"
                        data-topic-checkbox
                        className="h-4 w-4 accent-[#D8B87A]"
                      />
                    </label>

                    <div className="flex items-center justify-start gap-4 text-right" dir="rtl">
                      <div className="shrink-0 text-[#E7B94F]">
                        <TopicFileIcon />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center justify-start gap-2">
                          <h3 className="truncate text-base font-bold text-white">
                            {topic.title || "بدون عنوان"}
                          </h3>

                          {topic.is_featured ? (
                            <span className="rounded-full border border-[#D8B87A]/30 bg-[#D8B87A]/10 px-2.5 py-1 text-[11px] text-[#D8B87A]">
                              مميز
                            </span>
                          ) : null}

                          {topic.is_popular ? (
                            <span className="rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/55">
                              شائع
                            </span>
                          ) : null}
                        </div>


                      </div>
                    </div>

                    <div className="text-center text-sm font-medium text-white/68 xl:text-center">
                      {topic.category || "غير مصنف"}
                    </div>

                    <div className="text-center font-en text-sm leading-6 text-white/55">
                      {formatAdminListDate(topic.published_at)}
                    </div>

                    <div className="flex justify-center">
                      <StatusPill status={topic.status} />
                    </div>

                    <TopicRowActions topic={topic} categories={safeCategories} currentListPath={currentListPath} />
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="px-6 py-14 text-center">
              <p className="text-lg font-semibold text-white">لا توجد موضوعات مطابقة.</p>

              <p className="mt-3 text-sm text-white/45">جرّب تصفير الفلاتر أو إنشاء موضوع جديد.</p>

              <Link
                href="/admin/topics/new"
                className="mt-6 inline-flex rounded-full bg-[#D8B87A] px-6 py-3 text-sm font-semibold text-[#06101C]"
              >
                + إنشاء موضوع جديد
              </Link>
            </div>
          )}
        </div>

        <AdminTopicsTotalBar count={totalCount} />
      </section>

      {perPage && totalPages > 1 ? (
        <nav className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href={buildHref(queryParams, { page: String(Math.max(1, currentPage - 1)) })}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:border-[#D8B87A]/35 hover:text-[#D8B87A]"
          >
            السابق
          </Link>

          {Array.from({ length: totalPages }).map((_, index) => {
            const page = index + 1;

            return (
              <Link
                key={page}
                href={buildHref(queryParams, { page: String(page) })}
                className={
                  page === currentPage
                    ? "rounded-full bg-[#D8B87A] px-4 py-2 text-sm font-semibold text-[#06101C]"
                    : "rounded-full border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:border-[#D8B87A]/35 hover:text-[#D8B87A]"
                }
              >
                {page}
              </Link>
            );
          })}

          <Link
            href={buildHref(queryParams, { page: String(Math.min(totalPages, currentPage + 1)) })}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:border-[#D8B87A]/35 hover:text-[#D8B87A]"
          >
            التالي
          </Link>
        </nav>
      ) : null}
    </main>
  );
}

function AdminMetricCard({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[#080B10]/90 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.25)]">
      <p className="font-en text-3xl font-semibold text-[#D8B87A]">
        {value}
        {suffix}
      </p>
      <p className="mt-2 text-sm text-white/50">{label}</p>
    </div>
  );
}
