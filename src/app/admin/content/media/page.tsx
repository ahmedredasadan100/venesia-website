import Link from "next/link";
import AdminNotice from "../../../../components/admin/AdminNotice";
import {
  ADMIN_DATA_GRID_COLUMNS,
  AdminActionButton,
  AdminDataGrid,
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
  adminDataGridActionsColumn,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridRow,
  AdminMetricCardsGrid,
  AdminPageContextHeader,
  AdminStatusPill,
  AdminTablePagination,
} from "../../../../components/admin/ui";
import { applyAdminListTextSearch } from "../../../../lib/admin/admin-list-search";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { PlusIcon } from "../../../../components/admin/AdminRowActions";
import { bulkUpdateMediaContent } from "./actions";
import MediaCategoryBadge from "./MediaCategoryBadge";
import MediaListControls from "./MediaListControls";
import MediaListFilters from "./MediaListFilters";
import {
  isMediaEditableContentType,
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
};

type MediaTopicRow = {
  id: number;
  title: string | null;
  slug: string | null;
  content_type: MediaListContentType | string | null;
  category: string | null;
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

const MEDIA_TABLE_COLUMNS = `${ADMIN_DATA_GRID_COLUMNS.checkbox} ${ADMIN_DATA_GRID_COLUMNS.primaryStandard} ${ADMIN_DATA_GRID_COLUMNS.slug} ${ADMIN_DATA_GRID_COLUMNS.statusStandard} ${adminDataGridActionsColumn(1, "compact")}`;

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

function SortHeader({ label, href }: { label: string; href: string }) {
  return (
    <Link href={href} className="inline-flex items-center justify-center gap-2 transition hover:text-[#D8B87A]">
      {label}
      <span className="font-en text-[10px] text-white/35">↕</span>
    </Link>
  );
}

function getStatusTone(status?: string | null): "green" | "gold" | "muted" | "red" {
  if (status === "published") return "green";
  if (status === "unpublished") return "red";
  if (status === "archived") return "muted";
  return "gold";
}

function getStatusLabel(status?: string | null) {
  if (status === "published") return "منشور";
  if (status === "unpublished") return "مخفي";
  if (status === "archived") return "أرشيف";
  return "مسودة";
}

function getNoticeText(notice?: string) {
  if (notice === "saved") return "تم تنفيذ الإجراء على العناصر المحددة بنجاح.";
  if (notice === "error") return "تعذر تنفيذ العملية. راجع البيانات وحاول مرة أخرى.";
  return null;
}

function MediaBulkActionsBar({ currentListPath }: { currentListPath: string }) {
  return (
    <form
      id="media-bulk-form"
      action={bulkUpdateMediaContent}
      data-media-bulk-bar
      hidden
      className="mb-3 rounded-[14px] border border-[#D8B87A]/16 bg-[#0B1016] p-3 shadow-[0_18px_55px_rgba(0,0,0,0.32)]"
    >
      <input type="hidden" name="redirect_to" value={currentListPath} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">
          تم تحديد <span data-media-bulk-count className="font-en text-[#D8B87A]">0</span> عنصر
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
            <option value="feature">تعيين كمميز</option>
            <option value="unfeature">إلغاء التمييز</option>
          </select>

          <button className="h-10 rounded-full bg-[#D8B87A] px-5 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]">
            تنفيذ
          </button>
          <button
            type="button"
            data-media-clear-selection
            className="h-10 rounded-full border border-white/10 px-5 text-sm text-white/62 transition hover:border-white/20 hover:text-white"
          >
            إلغاء التحديد
          </button>
        </div>
      </div>
    </form>
  );
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
  const notice = getNoticeText(params?.notice);
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

  const baseStatsQuery = getSupabaseAdmin()
    .from("topics")
    .select("id", { count: "exact", head: true })
    .in("content_type", [...MEDIA_LIST_CONTENT_TYPES])
    .is("deleted_at", null);

  let query = applyMediaListSort(
    applyMediaListFilters(
      getSupabaseAdmin()
        .from("topics")
        .select("id, title, slug, content_type, category, status, is_featured, updated_at", { count: "exact" }),
      filters,
    ),
    sort,
  );

  query = query.range(from, to);

  const [
    { data: rows, error },
    { count: publishedCount },
    { count: draftCount },
    { count: featuredCount },
  ] = await Promise.all([
    query,
    baseStatsQuery.eq("status", "published"),
    baseStatsQuery.eq("status", "draft"),
    baseStatsQuery.eq("is_featured", true),
  ]);

  const safeRows = (rows ?? []) as MediaTopicRow[];

  return (
    <main className="space-y-7">
      <MediaListControls />

      <AdminPageContextHeader
        eyebrow="MEDIA CENTER CONTROL"
        title="إدارة محتوى المركز الإعلامي"
        description="أنشئ وحرّر الأخبار والبيانات الصحفية وتحديثات التنفيذ والفيديو ومعرض الصور من مكان واحد — مع ربط واضح بالتصنيفات والنشر."
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

      {notice ? <AdminNotice variant={params?.notice === "error" ? "danger" : "success"} message={notice} /> : null}

      {error ? (
        <AdminNotice variant="danger" title="تعذر تحميل المحتوى الإعلامي" message={error.message} />
      ) : null}

      <AdminMetricCardsGrid
        items={[
          { label: "إجمالي المحتوى", value: totalCount, tone: "gold", compact: true },
          { label: "منشور", value: publishedCount ?? 0, tone: "green", compact: true },
          { label: "مسودات", value: draftCount ?? 0, tone: "amber", compact: true },
          { label: "مميز", value: featuredCount ?? 0, tone: "violet", compact: true },
          { label: "المعروض الآن", value: safeRows.length, tone: "blue", compact: true },
          { label: "الأقسام", value: 5, suffix: "أنواع", tone: "cyan", compact: true },
        ]}
      />

      <MediaListFilters
        q={filters.q}
        contentType={filters.contentType}
        status={filters.status}
        featured={filters.featured}
      />

      <section id="media-table" className="scroll-mt-6">
        <MediaBulkActionsBar currentListPath={currentListPath} />

        <AdminDataGrid>
          <AdminDataGridHeader columns={MEDIA_TABLE_COLUMNS}>
            <label className="flex items-center justify-center">
              <input type="checkbox" data-media-select-all className="h-4 w-4 accent-[#D8B87A]" />
            </label>
            <span className="text-right">
              <SortHeader label="العنوان" href={buildHref(queryParams, { sort: getNextSort(sort, "title"), page: "1" })} />
            </span>
            <span className="text-center">التصنيف</span>
            <span className="text-center">
              <SortHeader label="الحالة" href={buildHref(queryParams, { sort: getNextSort(sort, "status"), page: "1" })} />
            </span>
            <span className="text-center">الإجراءات</span>
          </AdminDataGridHeader>

          {safeRows.length > 0 ? (
            safeRows.map((row, index) => {
              const editable = isMediaEditableContentType(row.content_type);
              const editHref = editable ? `/admin/content/media/${row.id}` : undefined;

              return (
                <AdminDataGridRow key={row.id} columns={MEDIA_TABLE_COLUMNS} divided={index > 0}>
                  <label className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      name="media_ids"
                      value={row.id}
                      form="media-bulk-form"
                      data-media-checkbox
                      className="h-4 w-4 accent-[#D8B87A]"
                    />
                  </label>

                  <div className="min-w-0 text-right">
                    {editHref ? (
                      <Link href={editHref} className="block truncate text-base font-bold text-white transition hover:text-[#F4D99A]">
                        {row.title || "بدون عنوان"}
                      </Link>
                    ) : (
                      <h3 className="truncate text-base font-bold text-white">{row.title || "بدون عنوان"}</h3>
                    )}
                    {row.slug ? <p className="truncate font-en text-xs text-white/35">{row.slug}</p> : null}
                  </div>

                  <div className="flex justify-center">
                    <MediaCategoryBadge label={row.category} contentType={row.content_type} />
                  </div>

                  <div className="flex justify-center">
                    <AdminStatusPill tone={getStatusTone(row.status)}>{getStatusLabel(row.status)}</AdminStatusPill>
                  </div>

                  <AdminDataGridActionsCell compact>
                    {editable && editHref ? (
                      <AdminDataGridActionButton action="edit" href={editHref} size="compact" title="تعديل" />
                    ) : (
                      <AdminDataGridActionButton action="edit" size="compact" disabled title="التعديل غير متاح" />
                    )}
                  </AdminDataGridActionsCell>
                </AdminDataGridRow>
              );
            })
          ) : (
            <AdminDataGridEmpty>
              <p className="text-lg font-semibold text-white">لا توجد عناصر مطابقة.</p>
              <p className="mt-3 text-sm text-white/45">جرّب تصفير الفلاتر أو إنشاء محتوى جديد.</p>
              <Link
                href="/admin/content/media/new"
                className="mt-6 inline-flex rounded-full bg-[#D8B87A] px-6 py-3 text-sm font-semibold text-[#06101C]"
              >
                + إضافة محتوى جديد
              </Link>
            </AdminDataGridEmpty>
          )}
        </AdminDataGrid>

        <AdminTablePagination
          basePath="/admin/content/media"
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          totalCount={totalCount}
          pageSize={limitValue}
          currentPage={safePage}
          totalPages={totalPages}
          emptySummaryText="لا توجد عناصر مطابقة"
        />
      </section>
    </main>
  );
}
