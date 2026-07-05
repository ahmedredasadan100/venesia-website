import AdminNotice from "../../../../components/admin/AdminNotice";
import {
  ADMIN_DATA_GRID_ACTION_COLUMNS,
  ADMIN_DATA_GRID_COLUMNS,
  ADMIN_FILTER_ROW_CLASSES,
  ADMIN_FILTER_SHELL_CLASSES,
  ADMIN_FILTER_SHELL_GLOW_STYLE,
  AdminDataGrid,
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
  AdminDataGridCenterCell,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridPrimaryCell,
  AdminDataGridRow,
  AdminDataGridStatusCell,
  AdminInfoBar,
  AdminPageContextHeader,
  AdminStatusPill,
  AdminActionButton,
} from "../../../../components/admin/ui";
import { applyAdminListTextSearch } from "../../../../lib/admin/admin-list-search";
import { formatAdminListDate } from "../../../../lib/content-dates";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { PlusIcon } from "../../../../components/admin/AdminRowActions";
import {
  getContentTypeLabel,
  isMediaEditableContentType,
  MEDIA_EDITABLE_CONTENT_TYPES,
  MEDIA_LIST_CONTENT_TYPES,
  type MediaListContentType,
} from "./media-content-config";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  content_type?: string;
  status?: string;
  featured?: string;
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

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "كل الحالات" },
  { value: "published", label: "منشور" },
  { value: "draft", label: "مسودة" },
  { value: "unpublished", label: "مخفي" },
  { value: "archived", label: "أرشيف" },
] as const;

const FEATURED_FILTER_OPTIONS = [
  { value: "all", label: "الكل" },
  { value: "yes", label: "مميز" },
  { value: "no", label: "غير مميز" },
] as const;

const FILTER_FIELD_CLASS =
  "h-12 w-full rounded-[8px] border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition placeholder:text-white/36 focus:border-[#D8B87A]/35";

/** Date column width — matches Topics list published/updated column (125px). */
const MEDIA_GRID_COLUMNS = `${ADMIN_DATA_GRID_COLUMNS.primaryStandard} ${ADMIN_DATA_GRID_COLUMNS.slugCompact} ${ADMIN_DATA_GRID_COLUMNS.slug} ${ADMIN_DATA_GRID_COLUMNS.statusStandard} ${ADMIN_DATA_GRID_COLUMNS.count} 125px ${ADMIN_DATA_GRID_ACTION_COLUMNS.one}`;

function cleanSearch(value: string) {
  return value.replace(/[,%]/g, " ").replace(/\s+/g, " ").trim();
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
    status: STATUS_FILTER_OPTIONS.some((option) => option.value === status) ? status : "all",
    featured: FEATURED_FILTER_OPTIONS.some((option) => option.value === params?.featured)
      ? (params?.featured as string)
      : "all",
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

function hasActiveFilters(filters: MediaListFilterState) {
  return Boolean(
    filters.q ||
      filters.contentType !== "all" ||
      filters.status !== "all" ||
      filters.featured !== "all",
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

function buildContentTypeFilterOptions() {
  return [
    { value: "all", label: "كل الأنواع" },
    ...MEDIA_EDITABLE_CONTENT_TYPES.map((type) => ({
      value: type,
      label: getContentTypeLabel(type),
    })),
  ];
}

export default async function AdminUnifiedMediaContentPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters = normalizeFilters(params);

  const baseQuery = getSupabaseAdmin()
    .from("topics")
    .select("id", { count: "exact", head: true })
    .in("content_type", [...MEDIA_LIST_CONTENT_TYPES])
    .is("deleted_at", null);

  const [
    { data: rows, error },
    { count: totalCount },
    { count: publishedCount },
    { count: featuredCount },
  ] = await Promise.all([
    applyMediaListFilters(
      getSupabaseAdmin()
        .from("topics")
        .select("id, title, slug, content_type, category, category_slug, status, is_featured, updated_at")
        .order("updated_at", { ascending: false }),
      filters,
    ),
    baseQuery,
    baseQuery.eq("status", "published"),
    baseQuery.eq("is_featured", true),
  ]);

  const safeRows = (rows ?? []) as MediaTopicRow[];
  const contentTypeOptions = buildContentTypeFilterOptions();
  const filteredCount = safeRows.length;
  const allCount = totalCount ?? 0;
  const filtersActive = hasActiveFilters(filters);

  return (
    <main className="space-y-7">
      <AdminPageContextHeader
        eyebrow="UNIFIED MEDIA CONTENT"
        title="محتوى المركز الإعلامي"
        description="قائمة المحتوى الإعلامي الجديد من جدول topics فقط. هذه الواجهة إدارية بالتوازي مع النظام القديم — لا تؤثر على الواجهة العامة أو media_items."
        actions={
          <>
            <AdminActionButton href="/admin/content/media/new" variant="primary">
              <PlusIcon />
              إضافة محتوى جديد
            </AdminActionButton>
            <AdminActionButton href="/admin/topics" variant="dark">
              عرض المقالات
            </AdminActionButton>
            <AdminActionButton href="/admin/topics/categories" variant="dark">
              عرض التصنيفات
            </AdminActionButton>
          </>
        }
      />

      <AdminInfoBar
        label="محتوى المركز الإعلامي — Unified"
        description="الإنشاء والتعديل متاحان للأخبار والبيانات الصحفية ومن أرض التنفيذ والفيديو ومعرض الصور. الفيديو والمعرض يُحفظان في media_payload داخل topics — بدون تأثير على الواجهة العامة."
        meta={`${allCount} إجمالي المحتوى / ${publishedCount ?? 0} منشور / ${featuredCount ?? 0} مميز`}
      />

      {error ? (
        <AdminNotice variant="danger" title="تعذر تحميل المحتوى الإعلامي" message={error.message} />
      ) : null}

      <section className={ADMIN_FILTER_SHELL_CLASSES} style={ADMIN_FILTER_SHELL_GLOW_STYLE}>
        <form method="get" action="/admin/content/media" className={ADMIN_FILTER_ROW_CLASSES}>
          <label className="min-w-[220px] flex-1">
            <span className="sr-only">بحث</span>
            <input
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder="ابحث في العنوان أو slug..."
              className={FILTER_FIELD_CLASS}
            />
          </label>

          <label className="min-w-[170px]">
            <span className="sr-only">نوع المحتوى</span>
            <select name="content_type" defaultValue={filters.contentType} className={FILTER_FIELD_CLASS}>
              {contentTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[150px]">
            <span className="sr-only">الحالة</span>
            <select name="status" defaultValue={filters.status} className={FILTER_FIELD_CLASS}>
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[150px]">
            <span className="sr-only">مميز</span>
            <select name="featured" defaultValue={filters.featured} className={FILTER_FIELD_CLASS}>
              {FEATURED_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="h-12 shrink-0 rounded-full bg-[#D8B87A] px-5 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]"
          >
            تطبيق
          </button>

          {filtersActive ? (
            <AdminActionButton href="/admin/content/media" variant="dark">
              مسح الفلاتر
            </AdminActionButton>
          ) : null}
        </form>
      </section>

      <AdminDataGrid
        summary={
          filtersActive || filteredCount > 0
            ? `عرض ${filteredCount} عنصرًا من ${allCount} — الإنشاء والتعديل متاحان لجميع أقسام المركز الإعلامي الخمسة.`
            : undefined
        }
      >
        <AdminDataGridHeader columns={MEDIA_GRID_COLUMNS}>
          <span className="text-right">العنوان</span>
          <span className="text-center">نوع المحتوى</span>
          <span className="text-center">التصنيف</span>
          <span className="text-center">الحالة</span>
          <span className="text-center">مميز</span>
          <span className="text-center">آخر تحديث</span>
          <span className="text-center">الإجراءات</span>
        </AdminDataGridHeader>

        {safeRows.length > 0 ? (
          safeRows.map((row, index) => (
            <AdminDataGridRow key={row.id} columns={MEDIA_GRID_COLUMNS} divided={index > 0}>
              <AdminDataGridPrimaryCell>
                <div className="space-y-1">
                  <h3 className="truncate text-base font-bold text-white">{row.title || "بدون عنوان"}</h3>
                  {row.slug ? <p className="truncate font-en text-xs text-white/35">{row.slug}</p> : null}
                </div>
              </AdminDataGridPrimaryCell>

              <AdminDataGridCenterCell>
                <span className="text-sm text-white/72">{getContentTypeLabel(row.content_type)}</span>
              </AdminDataGridCenterCell>

              <AdminDataGridCenterCell>
                <span className="truncate text-sm text-white/72">{row.category || "—"}</span>
              </AdminDataGridCenterCell>

              <AdminDataGridStatusCell>
                <AdminStatusPill tone={getStatusTone(row.status)}>{getStatusLabel(row.status)}</AdminStatusPill>
              </AdminDataGridStatusCell>

              <AdminDataGridCenterCell>
                <span className="font-en text-sm text-white/62">{row.is_featured ? "نعم" : "—"}</span>
              </AdminDataGridCenterCell>

              <AdminDataGridCenterCell>
                <span className="font-en text-sm text-white/62">{formatAdminListDate(row.updated_at)}</span>
              </AdminDataGridCenterCell>

              <AdminDataGridActionsCell>
                {isMediaEditableContentType(row.content_type) ? (
                  <AdminDataGridActionButton action="edit" href={`/admin/content/media/${row.id}`} title="تعديل" />
                ) : (
                  <AdminDataGridActionButton action="edit" disabled title="التعديل غير متاح لهذا النوع" />
                )}
              </AdminDataGridActionsCell>
            </AdminDataGridRow>
          ))
        ) : (
          <AdminDataGridEmpty>
            {filtersActive
              ? "لا توجد نتائج مطابقة للفلاتر الحالية."
              : "لا يوجد محتوى إعلامي في topics بعد. أنشئ عنصرًا جديدًا من «إضافة محتوى جديد» للأقسام: الأخبار، البيانات الصحفية، من أرض التنفيذ، الفيديو، معرض الصور."}
          </AdminDataGridEmpty>
        )}
      </AdminDataGrid>
    </main>
  );
}
