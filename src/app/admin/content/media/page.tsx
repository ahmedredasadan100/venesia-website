import AdminNotice from "../../../../components/admin/AdminNotice";
import {
  AdminActionButton,
  AdminMetricCardsGrid,
  AdminPageContextHeader,
  AdminTablePagination,
} from "../../../../components/admin/ui";
import { applyAdminListTextSearch } from "../../../../lib/admin/admin-list-search";
import { countMediaTopicsByStatus } from "../../../../lib/admin/topics/count-media-topics-by-status";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { PlusIcon } from "../../../../components/admin/AdminRowActions";
import MediaListFilters from "./MediaListFilters";
import MediaTableClient from "./MediaTableClient";
import {
  MEDIA_LIST_CONTENT_TYPES,
  type MediaListContentType,
} from "./media-content-config";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  content_type?: string;
  status?: string;
  featured?: string;
  sort?: string;
  limit?: string;
  page?: string;
  notice?: string;
  bulk_partial?: string;
  bulk_skipped?: string;
};

type MediaTopicRow = {
  id: number;
  title: string | null;
  slug: string | null;
  content_type: MediaListContentType | string | null;
  category: string | null;
  category_slug: string | null;
  status: string | null;
  is_featured: boolean | null;
  updated_at: string | null;
};

type MediaListFilterState = {
  q: string;
  contentType: string;
  status: string;
  featured: string;
};

const LIMIT_OPTIONS = ["10", "20", "30"];
const DEFAULT_LIMIT = "10";
const DEFAULT_SORT = "updated_desc";
const VISIBLE_SORT_VALUES = new Set(["title_asc", "title_desc", "status_asc", "status_desc"]);

function cleanSearch(value: string) {
  return value.replace(/[,%]/g, " ").replace(/\s+/g, " ").trim();
}

function getPositiveNumber(value: string | undefined, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function isMediaListContentType(value: string): value is MediaListContentType {
  return MEDIA_LIST_CONTENT_TYPES.includes(value as MediaListContentType);
}

function normalizeFilters(params?: SearchParams): MediaListFilterState {
  const contentType = params?.content_type ?? "all";
  const status = params?.status ?? "all";

  return {
    q: cleanSearch(params?.q ?? ""),
    contentType: isMediaListContentType(contentType) || contentType === "all" ? contentType : "all",
    status: ["all", "published", "draft", "unpublished", "archived"].includes(status) ? status : "all",
    featured: ["all", "yes", "no"].includes(params?.featured ?? "all") ? (params?.featured ?? "all") : "all",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyMediaListFilters(query: any, filters: MediaListFilterState) {
  let next = query.in("content_type", [...MEDIA_LIST_CONTENT_TYPES]).is("deleted_at", null);

  if (filters.q) {
    next = applyAdminListTextSearch(next, filters.q, ["title", "slug"]);
  }

  if (filters.contentType !== "all") {
    next = next.eq("content_type", filters.contentType);
  }

  if (filters.status !== "all") {
    next = next.eq("status", filters.status);
  }

  if (filters.featured === "yes") next = next.eq("is_featured", true);
  if (filters.featured === "no") next = next.eq("is_featured", false);

  return next;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyMediaListSort(query: any, sort: string) {
  if (sort === "title_asc") return query.order("title", { ascending: true });
  if (sort === "title_desc") return query.order("title", { ascending: false });
  if (sort === "content_type_asc") return query.order("content_type", { ascending: true });
  if (sort === "content_type_desc") return query.order("content_type", { ascending: false });
  if (sort === "status_asc") return query.order("status", { ascending: true });
  if (sort === "status_desc") return query.order("status", { ascending: false });
  if (sort === "featured_asc") return query.order("is_featured", { ascending: true });
  if (sort === "featured_desc") return query.order("is_featured", { ascending: false });
  if (sort === "updated_asc") return query.order("updated_at", { ascending: true });
  if (sort === "updated_desc") return query.order("updated_at", { ascending: false });
  return query.order("updated_at", { ascending: false });
}

function normalizeSort(sort?: string | null) {
  const value = sort?.trim() || DEFAULT_SORT;
  if (VISIBLE_SORT_VALUES.has(value)) return value;
  if (value === DEFAULT_SORT || value === "updated_asc") return DEFAULT_SORT;
  return DEFAULT_SORT;
}

function buildHref(params: URLSearchParams, patch: Record<string, string | null>) {
  const next = new URLSearchParams(params.toString());

  Object.entries(patch).forEach(([key, value]) => {
    if (!value) next.delete(key);
    else next.set(key, value);
  });

  const query = next.toString();
  return query ? `/admin/content/media?${query}#media-table` : "/admin/content/media#media-table";
}

function getNextSort(currentSort: string, column: "title" | "status") {
  const map: Record<string, [string, string]> = {
    title: ["title_asc", "title_desc"],
    status: ["status_asc", "status_desc"],
  };

  const [first, second] = map[column];
  return currentSort === first ? second : first;
}

function getSortMeta(sort: string, column: "title" | "status") {
  const asc = `${column}_asc`;
  const desc = `${column}_desc`;
  if (sort === asc) return { active: true, direction: "asc" as const };
  if (sort === desc) return { active: true, direction: "desc" as const };
  return { active: false, direction: "asc" as const };
}

function getNoticeText(params?: Pick<SearchParams, "notice" | "bulk_partial" | "bulk_skipped">) {
  const notice = params?.notice;
  const partial = params?.bulk_partial;
  const skipped = params?.bulk_skipped;

  if (partial && skipped) {
    return `تم نشر ${partial} عنصرًا. تُرك ${skipped} عنصرًا لعدم اكتمال متطلبات النشر.`;
  }

  if (notice === "published") return "تم نشر المحتوى بنجاح.";
  if (notice === "unpublished") return "تم إخفاء المحتوى بنجاح.";
  if (notice === "deleted") return "تم حذف المحتوى حذفًا آمنًا.";
  if (notice === "created") return "تم إنشاء النسخة بنجاح.";
  if (notice === "saved") return "تم تنفيذ الإجراء على العناصر المحددة بنجاح.";
  if (notice === "error") return "تعذر تنفيذ العملية. راجع البيانات وحاول مرة أخرى.";
  return null;
}

export default async function AdminUnifiedMediaContentPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters = normalizeFilters(params);
  const sort = normalizeSort(params?.sort);
  const rawLimit = params?.limit ?? DEFAULT_LIMIT;
  const limitValue = LIMIT_OPTIONS.includes(rawLimit) ? rawLimit : DEFAULT_LIMIT;
  const currentPage = getPositiveNumber(params?.page, 1);
  const notice = getNoticeText(params);
  const perPage = Number(limitValue);

  const { count: rawTotalCount } = await applyMediaListFilters(
    getSupabaseAdmin().from("topics").select("id", { count: "exact", head: true }),
    filters,
  );

  const totalCount = rawTotalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const from = (safePage - 1) * perPage;
  const to = from + perPage - 1;
  const rangeStart = totalCount === 0 ? 0 : from + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min(safePage * perPage, totalCount);

  const queryParams = new URLSearchParams();
  if (filters.q) queryParams.set("q", filters.q);
  if (filters.contentType !== "all") queryParams.set("content_type", filters.contentType);
  if (filters.status !== "all") queryParams.set("status", filters.status);
  if (filters.featured !== "all") queryParams.set("featured", filters.featured);
  if (sort !== DEFAULT_SORT) queryParams.set("sort", sort);
  if (limitValue !== DEFAULT_LIMIT) queryParams.set("limit", limitValue);
  if (safePage > 1) queryParams.set("page", String(safePage));

  const currentListPath = queryParams.toString()
    ? `/admin/content/media?${queryParams.toString()}`
    : "/admin/content/media";

  let query = applyMediaListSort(
    applyMediaListFilters(
      getSupabaseAdmin().from("topics").select("id, title, slug, content_type, category, category_slug, status, is_featured, updated_at"),
      filters,
    ),
    sort,
  );

  query = query.range(from, to);

  const [{ data: rows, error }, mediaStatusCounts] = await Promise.all([query, countMediaTopicsByStatus()]);

  const safeRows = (rows ?? []) as MediaTopicRow[];
  const titleSort = getSortMeta(sort, "title");
  const statusSort = getSortMeta(sort, "status");

  return (
    <main className="space-y-7">
      <AdminPageContextHeader
        eyebrow="MEDIA CENTER CONTROL"
        title="إدارة محتوى المركز الإعلامي"
        description="أنشئ وحرّر الأخبار والبيانات الصحفية وتحديثات التنفيذ والفيديو ومعرض الصور من مكان واحد. استخدم الفلاتر للبحث بالعنوان أو الرابط، أو حسب النوع والحالة والتمييز."
        actions={
          <>
            <AdminActionButton href="/admin/content/media/new" variant="primary">
              <PlusIcon />
              إضافة محتوى جديد
            </AdminActionButton>
            <AdminActionButton href="/admin/topics/categories" variant="dark">
              إدارة التصنيفات
            </AdminActionButton>
            <AdminActionButton href="/admin/topics" variant="dark">
              عرض المقالات
            </AdminActionButton>
          </>
        }
      />

      {notice ? (
        <div role="status" aria-live="polite">
          <AdminNotice variant={params?.notice === "error" ? "danger" : "success"} message={notice} />
        </div>
      ) : null}

      {error ? (
        <AdminNotice variant="danger" title="تعذر تحميل المحتوى الإعلامي" message={error.message} />
      ) : null}

      <AdminMetricCardsGrid
        items={[
          { label: "إجمالي المحتوى", value: totalCount, tone: "gold", compact: true },
          { label: "منشور", value: mediaStatusCounts.published, tone: "green", compact: true },
          { label: "مسودات", value: mediaStatusCounts.draft, tone: "amber", compact: true },
          { label: "محتوى مميز", value: mediaStatusCounts.featured, tone: "violet", compact: true },
          { label: "في هذه الصفحة", value: safeRows.length, tone: "blue", compact: true },
          { label: "الأقسام", value: 5, suffix: "أنواع", tone: "cyan", compact: true },
        ]}
      />

      <MediaListFilters
        q={filters.q}
        contentType={filters.contentType}
        status={filters.status}
        featured={filters.featured}
      />

      <section id="media-table" className="scroll-mt-6" aria-label="جدول المحتوى الإعلامي">
        <MediaTableClient
          key={currentListPath}
          rows={safeRows}
          currentListPath={currentListPath}
          titleSortHref={buildHref(queryParams, { sort: getNextSort(sort, "title"), page: "1" })}
          statusSortHref={buildHref(queryParams, { sort: getNextSort(sort, "status"), page: "1" })}
          titleSort={titleSort}
          statusSort={statusSort}
        />

        <AdminTablePagination
          basePath="/admin/content/media"
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          totalCount={totalCount}
          pageSize={limitValue}
          currentPage={safePage}
          totalPages={totalPages}
          emptySummaryText="لا يوجد محتوى مطابق للفلاتر الحالية"
        />
      </section>
    </main>
  );
}
