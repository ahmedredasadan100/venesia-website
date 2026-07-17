import AdminNotice from "../../../../components/admin/AdminNotice";
import {
  AdminActionButton,
  AdminMetricCardsGrid,
  AdminPageContextHeader,
  AdminTablePagination,
} from "../../../../components/admin/ui";
import UnifiedContentFilters from "../../../../components/admin/content/UnifiedContentFilters";
import UnifiedContentList from "../../../../components/admin/content/UnifiedContentList";
import { DEFAULT_UNIFIED_CONTENT_COLUMN_KEYS } from "../../../../components/admin/content/unified-content-columns";
import {
  buildAdminCategoryTree,
  flattenAdminCategoryTree,
  type AdminContentCategory,
} from "../../../../lib/admin/content/category-hierarchy";
import {
  CONTENT_LIST_PAGE_SIZES,
  CONTENT_LIST_VIEW_KEY,
  DEFAULT_CONTENT_LIST_SORT,
  loadUnifiedContentList,
  loadUnifiedContentMetrics,
  normalizeUnifiedContentFilters,
  type ContentListSearchParams,
} from "../../../../lib/admin/content/load-unified-content";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { ADMIN_CONTENT_ROUTES } from "../../../../lib/admin/content-routes";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

type SearchParams = ContentListSearchParams & {
  notice?: string;
  message?: string;
};

type SeriesRow = {
  id: number;
  name: string;
  status: string;
  deleted_at: string | null;
};

function buildCurrentListPath(filters: ReturnType<typeof normalizeUnifiedContentFilters>) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.contentType !== "all") params.set("content_type", filters.contentType);
  if (filters.categoryId) params.set("category", String(filters.categoryId));
  if (filters.seriesId) params.set("series", String(filters.seriesId));
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.featured !== "all") params.set("featured", filters.featured);
  if (filters.sort !== DEFAULT_CONTENT_LIST_SORT) params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  if (filters.pageSize !== 10) params.set("limit", String(filters.pageSize));
  const query = params.toString();
  return query ? `${ADMIN_CONTENT_ROUTES.topics}?${query}` : ADMIN_CONTENT_ROUTES.topics;
}

function noticeText(notice?: string, message?: string) {
  if (message) return message;
  if (notice === "published") return "تم نشر المحتوى بنجاح.";
  if (notice === "unpublished") return "تم إخفاء المحتوى مع الحفاظ على بيانات النشر.";
  if (notice === "saved") return "تم حفظ التغيير بنجاح.";
  if (notice === "created") return "تم إنشاء نسخة مسودة بنجاح.";
  if (notice === "deleted") return "تم حذف المحتوى حذفًا آمنًا.";
  if (notice === "error") return "تعذر تنفيذ العملية.";
  return null;
}

export default async function UnifiedContentTopicsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const actor = await requireAdminSession();
  const params = await searchParams;
  const filters = normalizeUnifiedContentFilters(params);
  const supabase = getSupabaseAdmin();
  const [
    { data: categoryRows, error: categoriesError },
    { data: seriesRows, error: seriesError },
    { data: preference, error: preferenceError },
    metrics,
  ] = await Promise.all([
    supabase
      .from("topic_categories")
      .select("id,name,slug,parent_id,sort_order,is_active,color_token")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("topic_series")
      .select("id,name,status,deleted_at")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("admin_user_preferences")
      .select("preferences")
      .eq("admin_user_id", actor.id)
      .eq("view_key", CONTENT_LIST_VIEW_KEY)
      .maybeSingle<{ preferences: { visibleColumns?: string[] } }>(),
    loadUnifiedContentMetrics(),
  ]);

  const categories = (categoryRows ?? []) as AdminContentCategory[];
  const categoryTree = buildAdminCategoryTree(categories);
  const flattenedCategories = flattenAdminCategoryTree(categoryTree);
  const series = (seriesRows ?? []) as SeriesRow[];
  const list = await loadUnifiedContentList(filters, categories);
  const currentListPath = buildCurrentListPath({ ...filters, page: list.page });
  const listClientStateKey = buildCurrentListPath({
    ...filters,
    page: list.page,
    sort: DEFAULT_CONTENT_LIST_SORT,
  });
  const notice = noticeText(params?.notice, params?.message);
  const visibleColumns = Array.isArray(preference?.preferences?.visibleColumns)
    ? preference.preferences.visibleColumns
    : [...DEFAULT_UNIFIED_CONTENT_COLUMN_KEYS];
  const rangeStart = list.totalCount ? (list.page - 1) * list.pageSize + 1 : 0;
  const rangeEnd = list.totalCount ? Math.min(list.page * list.pageSize, list.totalCount) : 0;
  const loadError =
    categoriesError?.message ??
    seriesError?.message ??
    preferenceError?.message ??
    metrics.error ??
    list.error;
  const listLoadError =
    categoriesError?.message ??
    seriesError?.message ??
    preferenceError?.message ??
    list.error;

  return (
    <main className="min-w-0 space-y-7">
      <AdminPageContextHeader
        eyebrow="UNIFIED CONTENT ENGINE"
        title="إدارة الموضوعات"
        description="قائمة موحدة لكل المقالات والأخبار والبيانات الصحفية وتحديثات التنفيذ والفيديوهات ومعارض الصور."
        actions={
          <>
            <AdminActionButton href={ADMIN_CONTENT_ROUTES.newTopic} variant="primary">
              + إضافة موضوع جديد
            </AdminActionButton>
            <AdminActionButton href={ADMIN_CONTENT_ROUTES.categories} variant="dark">
              إدارة التصنيفات
            </AdminActionButton>
            <AdminActionButton href={ADMIN_CONTENT_ROUTES.series} variant="dark">
              سلاسل المحتوى
            </AdminActionButton>
          </>
        }
      />

      {notice ? (
        <AdminNotice
          variant={params?.notice === "error" ? "danger" : "success"}
          message={notice}
        />
      ) : null}
      {loadError ? (
        <AdminNotice
          variant="danger"
          title="تعذر تحميل بيانات المحتوى"
          message={loadError}
        />
      ) : null}

      <AdminMetricCardsGrid
        items={[
          { label: "إجمالي الموضوعات", value: metrics.error ? "—" : metrics.total, tone: "gold", compact: true },
          { label: "منشور", value: metrics.error ? "—" : metrics.published, tone: "green", compact: true },
          { label: "مسودات", value: metrics.error ? "—" : metrics.draft, tone: "amber", compact: true },
          { label: "مخفي", value: metrics.error ? "—" : metrics.unpublished, tone: "violet", compact: true },
          { label: "أرشيف", value: metrics.error ? "—" : metrics.archived, tone: "cyan", compact: true },
          { label: "متوسط SEO", value: metrics.error ? "—" : metrics.seoAverage, suffix: metrics.error ? undefined : "/100", tone: "blue", compact: true },
        ]}
      />

      {!listLoadError ? (
        <>
          <UnifiedContentFilters
            initial={{
              q: filters.q,
              contentType: filters.contentType,
              category: filters.categoryId ? String(filters.categoryId) : "all",
              series: filters.seriesId ? String(filters.seriesId) : "all",
              status: filters.status,
              featured: filters.featured,
            }}
            categories={flattenedCategories}
            series={series}
          />

          <UnifiedContentList
            key={listClientStateKey}
            rows={list.rows}
            categories={flattenedCategories}
            currentListPath={currentListPath}
            sort={filters.sort}
            initialVisibleColumns={visibleColumns}
          />

          <AdminTablePagination
            basePath={ADMIN_CONTENT_ROUTES.topics}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            totalCount={list.totalCount}
            pageSize={String(list.pageSize)}
            pageSizeOptions={CONTENT_LIST_PAGE_SIZES.map(String)}
            currentPage={list.page}
            totalPages={list.totalPages}
            emptySummaryText="لا توجد موضوعات مطابقة"
          />
        </>
      ) : null}
    </main>
  );
}
