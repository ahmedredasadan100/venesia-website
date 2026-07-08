import Link from "next/link";
import AdminNotice from "../../../../components/admin/AdminNotice";
import AdminPageHeader from "../../../../components/admin/AdminPageHeader";
import { EyeIcon, actionClassName } from "../../../../components/admin/AdminRowActions";
import {
  ADMIN_DATA_GRID_RULES,
  AdminActionButton,
  AdminDataGrid,
  AdminMetricCardsGrid,
  ADMIN_DATA_GRID_ACTION_COLUMNS,
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridRow,
  AdminStatusPill,
} from "../../../../components/admin/ui";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { formatAdminListDate } from "../../../../lib/content-dates";
import MediaListControls from "../MediaListControls";
import { bulkUpdateMediaItems, publishMediaItem, softDeleteMediaItem, unpublishMediaItem } from "../actions";
import MediaAdminFilters from "./MediaAdminFilters";
import { MEDIA_TYPE_CONFIG, MEDIA_TYPES, getMediaAdminPath, getPublicMediaPath, type MediaAdminType } from "./media-admin-config";

export type MediaAdminSearchParams = {
  q?: string;
  status?: string;
  category?: string;
  sort?: string;
  featured?: string;
  popular?: string;
  limit?: string;
  page?: string;
  notice?: string;
};

type MediaRow = {
  id: number;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  image: string | null;
  type: MediaAdminType | string | null;
  category: string | null;
  category_slug: string | null;
  project: string | null;
  duration: string | null;
  status: string | null;
  is_featured: boolean | null;
  is_popular: boolean | null;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
};

type CategoryRow = {
  name: string;
  slug: string;
};

const LIMIT_OPTIONS = ["10", "20", "50", "all"];
const DEFAULT_LIMIT = "10";

function cleanSearch(value: string) {
  return value.replace(/[,%]/g, " ").replace(/\s+/g, " ").trim();
}

function getPositiveNumber(value: string | undefined, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function getNoticeText(notice?: string) {
  if (notice === "published") return "تم نشر عنصر المركز الإعلامي بنجاح.";
  if (notice === "unpublished") return "تم إخفاء عنصر المركز الإعلامي بنجاح.";
  if (notice === "deleted") return "تم أرشفة عنصر المركز الإعلامي بنجاح.";
  if (notice === "saved") return "تم حفظ التعديلات بنجاح.";
  if (notice === "created") return "تم إنشاء عنصر جديد داخل المركز الإعلامي.";
  if (notice === "draft") return "تم حفظ العنصر كمسودة بنجاح.";
  if (notice === "error") return "تعذر تنفيذ العملية. راجع البيانات وحاول مرة أخرى.";
  return null;
}

function getTypeLabel(type?: string | null) {
  if (type && type in MEDIA_TYPE_CONFIG) return MEDIA_TYPE_CONFIG[type as MediaAdminType].plural;
  return "—";
}

function statusLabel(status?: string | null) {
  if (status === "published") return "منشور";
  if (status === "unpublished") return "مخفي";
  if (status === "archived") return "أرشيف";
  return "مسودة";
}

function statusTone(status?: string | null): "green" | "gold" | "muted" {
  if (status === "published") return "green";
  if (status === "unpublished") return "gold";
  return "muted";
}

function buildHref(basePath: string, params: URLSearchParams, patch: Record<string, string | null>) {
  const next = new URLSearchParams(params.toString());

  Object.entries(patch).forEach(([key, value]) => {
    if (!value) next.delete(key);
    else next.set(key, value);
  });

  const query = next.toString();
  return query ? `${basePath}?${query}#media-table` : `${basePath}#media-table`;
}

function MediaTypeBadge({ type }: { type: MediaAdminType | string }) {
  const label = getTypeLabel(type);
  return (
    <span className="inline-flex min-w-[56px] justify-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-white/58">
      {label}
    </span>
  );
}

function BulkActionsBar({ currentListPath }: { currentListPath: string }) {
  return (
    <form
      id="media-bulk-form"
      action={bulkUpdateMediaItems}
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
            <option value="delete">حذف آمن</option>
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

export default async function MediaItemsAdminPage({
  activeType = null,
  searchParams,
}: {
  activeType?: MediaAdminType | null;
  searchParams?: MediaAdminSearchParams;
}) {
  const q = cleanSearch(searchParams?.q ?? "");
  const status = searchParams?.status ?? "all";
  const category = searchParams?.category ?? "all";
  const sort = searchParams?.sort ?? "published_desc";
  const featured = searchParams?.featured ?? "all";
  const popular = searchParams?.popular ?? "all";
  const rawLimit = searchParams?.limit ?? DEFAULT_LIMIT;
  const limitValue = LIMIT_OPTIONS.includes(rawLimit) ? rawLimit : DEFAULT_LIMIT;
  const currentPage = getPositiveNumber(searchParams?.page, 1);
  const notice = getNoticeText(searchParams?.notice);
  const basePath = activeType ? getMediaAdminPath(activeType) : "/admin/media-center";

  const queryParams = new URLSearchParams();
  if (q) queryParams.set("q", q);
  if (status !== "all") queryParams.set("status", status);
  if (category !== "all") queryParams.set("category", category);
  if (sort !== "published_desc") queryParams.set("sort", sort);
  if (featured !== "all") queryParams.set("featured", featured);
  if (popular !== "all") queryParams.set("popular", popular);
  if (limitValue !== DEFAULT_LIMIT) queryParams.set("limit", limitValue);
  if (currentPage > 1) queryParams.set("page", String(currentPage));

  const currentListPath = queryParams.toString() ? `${basePath}?${queryParams.toString()}` : basePath;

  let query = getSupabaseAdmin()
    .from("media_items")
    .select(
      "id, title, slug, excerpt, image, type, category, category_slug, project, duration, status, is_featured, is_popular, published_at, created_at, updated_at, deleted_at",
      { count: "exact" },
    )
    .is("deleted_at", null);

  if (activeType) query = query.eq("type", activeType);
  if (q) query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%,category.ilike.%${q}%,excerpt.ilike.%${q}%,project.ilike.%${q}%`);
  if (status !== "all") query = query.eq("status", status);
  if (category !== "all") query = query.eq("category_slug", category);
  if (featured === "yes") query = query.eq("is_featured", true);
  if (featured === "no") query = query.eq("is_featured", false);
  if (popular === "yes") query = query.eq("is_popular", true);
  if (popular === "no") query = query.eq("is_popular", false);

  if (sort === "published_asc") query = query.order("published_at", { ascending: true });
  else if (sort === "created_desc") query = query.order("created_at", { ascending: false });
  else if (sort === "created_asc") query = query.order("created_at", { ascending: true });
  else if (sort === "updated_desc") query = query.order("updated_at", { ascending: false });
  else if (sort === "title_asc") query = query.order("title", { ascending: true });
  else query = query.order("published_at", { ascending: false }).order("id", { ascending: false });

  const perPage = limitValue === "all" ? null : Number(limitValue);
  const from = perPage ? (currentPage - 1) * perPage : 0;
  const to = perPage ? from + perPage - 1 : undefined;
  if (perPage) query = query.range(from, to as number);

  function statsCountQuery(status?: string) {
    let builder = getSupabaseAdmin()
      .from("media_items")
      .select("id", { count: "exact", head: true });

    if (status) {
      builder = builder.eq("status", status);
      if (status !== "archived") {
        builder = builder.is("deleted_at", null);
      }
    } else {
      builder = builder.is("deleted_at", null);
    }

    return activeType ? builder.eq("type", activeType) : builder;
  }

  const [
    { data: items, error, count },
    { data: categories },
    totalStats,
    publishedStats,
    draftStats,
    hiddenStats,
    archivedStats,
  ] = await Promise.all([
    query,
    getSupabaseAdmin().from("media_categories").select("name, slug").eq("is_active", true).order("sort_order", { ascending: true }),
    statsCountQuery(),
    statsCountQuery("published"),
    statsCountQuery("draft"),
    statsCountQuery("unpublished"),
    statsCountQuery("archived"),
  ]);

  const safeItems = (items ?? []) as MediaRow[];
  const safeCategories = (categories ?? []) as CategoryRow[];
  const totalCount = count ?? 0;
  const totalPages = perPage ? Math.max(1, Math.ceil(totalCount / perPage)) : 1;
  const gridColumns = activeType
    ? `46px minmax(320px,1fr) 150px 125px 88px ${ADMIN_DATA_GRID_ACTION_COLUMNS.fiveCompact}`
    : `46px minmax(320px,1fr) 130px 150px 125px 88px ${ADMIN_DATA_GRID_ACTION_COLUMNS.fiveCompact}`;

  return (
    <main className="space-y-7">
      <MediaListControls />
      <AdminPageHeader
        eyebrow={activeType ? MEDIA_TYPE_CONFIG[activeType].eyebrow : "MEDIA CENTER"}
        title={activeType ? `إدارة ${MEDIA_TYPE_CONFIG[activeType].plural}` : "إدارة المركز الإعلامي"}
        description="إدارة محتوى المركز الإعلامي من قاعدة بيانات Supabase: الأخبار، الفيديوهات، الجاليري، البيانات الصحفية، وتحديثات مواقع التنفيذ."
        actions={
          <>
            <AdminActionButton href="/media-center" variant="dark">
              عرض المركز الإعلامي
            </AdminActionButton>
            <AdminActionButton href={`/admin/media-center/new${activeType ? `?type=${activeType}` : ""}`} variant="gold">
              + إضافة عنصر
            </AdminActionButton>
          </>
        }
      />

      {notice ? <AdminNotice variant="success" message={notice} /> : null}
      {error ? <AdminNotice variant="danger" title="تعذر تحميل المركز الإعلامي" message={error.message} /> : null}

      <AdminMetricCardsGrid
        items={[
          { label: "إجمالي العناصر", value: totalStats.count ?? 0, tone: "gold", compact: true },
          { label: "منشور", value: publishedStats.count ?? 0, tone: "green", compact: true },
          { label: "مسودات", value: draftStats.count ?? 0, tone: "amber", compact: true },
          { label: "مخفي", value: hiddenStats.count ?? 0, tone: "violet", compact: true },
          { label: "أرشيف", value: archivedStats.count ?? 0, tone: "cyan", compact: true },
        ]}
      />

      <MediaAdminFilters
        basePath={basePath}
        activeType={activeType}
        q={q}
        status={status}
        category={category}
        sort={sort}
        featured={featured}
        popular={popular}
        limit={limitValue}
        categories={safeCategories}
        currentPage={currentPage}
        totalPages={totalPages}
      />

      <div id="media-table" className="scroll-mt-6">
        <AdminDataGrid
          summary={
            <span>
              إجمالي العناصر المعروضة: <span className="font-en text-[#D8B87A]">{totalCount}</span>
            </span>
          }
        >
          <BulkActionsBar currentListPath={currentListPath} />

          <AdminDataGridHeader columns={gridColumns}>
            <label className="flex items-center justify-center">
              <input type="checkbox" data-media-select-all className={ADMIN_DATA_GRID_RULES.checkbox} aria-label="تحديد الكل" />
            </label>
            <span className="text-right">العنصر</span>
            {!activeType ? <span className="text-center">النوع</span> : null}
            <span className="text-center">التصنيف</span>
            <span className="text-center">تاريخ النشر</span>
            <span className="text-center">الحالة</span>
            <span className="text-center">الإجراءات</span>
          </AdminDataGridHeader>

          {safeItems.length > 0 ? (
            <div className="divide-y divide-white/8">
              {safeItems.map((item) => {
                const type = MEDIA_TYPES.includes(item.type as MediaAdminType) ? (item.type as MediaAdminType) : "news";
                const slug = item.slug ?? "";
                const isPublished = item.status === "published";

                return (
                  <AdminDataGridRow key={item.id} columns={gridColumns}>
                    <label className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        name="media_item_ids"
                        value={item.id}
                        form="media-bulk-form"
                        data-media-checkbox
                        className={ADMIN_DATA_GRID_RULES.checkbox}
                        aria-label={`تحديد ${item.title || "عنصر"}`}
                      />
                    </label>

                    <div className="min-w-0 text-right" dir="rtl">
                      <div className="flex flex-wrap items-center justify-start gap-2">
                        <h3 className="truncate text-base font-bold text-white">{item.title || "بدون عنوان"}</h3>
                        {item.is_featured ? (
                          <span className="rounded-full border border-[#D8B87A]/30 bg-[#D8B87A]/10 px-2.5 py-1 text-[11px] text-[#D8B87A]">
                            مميز
                          </span>
                        ) : null}
                        {item.is_popular ? (
                          <span className="rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/55">
                            شائع
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 font-en text-xs text-white/35">{getPublicMediaPath(type, slug)}</p>
                      <p className="mt-2 line-clamp-2 text-sm leading-7 text-white/50">{item.excerpt || "لا يوجد وصف مختصر."}</p>
                    </div>

                    {!activeType ? (
                      <div className="flex justify-center">
                        <MediaTypeBadge type={type} />
                      </div>
                    ) : null}

                    <div className="text-center text-sm font-medium text-white/68">{item.category || "غير مصنف"}</div>
                    <div className="text-center font-en text-sm leading-6 text-white/55">{formatAdminListDate(item.published_at)}</div>
                    <div className="flex justify-center">
                      <AdminStatusPill tone={statusTone(item.status)}>{statusLabel(item.status)}</AdminStatusPill>
                    </div>

                    <AdminDataGridActionsCell compact>
                      <AdminDataGridActionButton action="edit" href={`/admin/media-center/items/${item.id}`} size="compact" />
                      {/* duplicate action not supported for media_items */}
                      <form action={isPublished ? unpublishMediaItem : publishMediaItem} className="contents">
                        <input type="hidden" name="id" value={item.id} />
                        <AdminDataGridActionButton action="visibility" type="submit" size="compact" hidden={!isPublished} />
                      </form>
                      <form action={softDeleteMediaItem} className="contents">
                        <input type="hidden" name="id" value={item.id} />
                        <AdminDataGridActionButton action="delete" type="submit" title="أرشفة" size="compact" />
                      </form>
                      <Link
                        href={`/admin/media-center/items/${item.id}/preview`}
                        target="_blank"
                        title="معاينة"
                        aria-label="معاينة"
                        className={`${actionClassName("muted")} !h-10 !w-10 shrink-0`}
                      >
                        <EyeIcon />
                      </Link>
                    </AdminDataGridActionsCell>
                  </AdminDataGridRow>
                );
              })}
            </div>
          ) : (
            <AdminDataGridEmpty>
              <p className="text-lg font-semibold text-white">لا توجد عناصر مطابقة.</p>
              <p className="mt-3 text-sm text-white/45">جرّب تصفير الفلاتر أو إضافة عنصر جديد.</p>
              <AdminActionButton
                href={`/admin/media-center/new${activeType ? `?type=${activeType}` : ""}`}
                variant="gold"
                className="mt-6"
              >
                + إضافة عنصر
              </AdminActionButton>
            </AdminDataGridEmpty>
          )}
        </AdminDataGrid>
      </div>

      {perPage && totalPages > 1 ? (
        <nav className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href={buildHref(basePath, queryParams, { page: String(Math.max(1, currentPage - 1)) })}
            className="cursor-pointer rounded-full border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:border-[#D8B87A]/35 hover:text-[#D8B87A]"
          >
            السابق
          </Link>

          {Array.from({ length: totalPages }).map((_, index) => {
            const page = index + 1;

            return (
              <Link
                key={page}
                href={buildHref(basePath, queryParams, { page: String(page) })}
                className={
                  page === currentPage
                    ? "cursor-pointer rounded-full bg-[#D8B87A] px-4 py-2 text-sm font-semibold text-[#06101C]"
                    : "cursor-pointer rounded-full border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:border-[#D8B87A]/35 hover:text-[#D8B87A]"
                }
              >
                {page}
              </Link>
            );
          })}

          <Link
            href={buildHref(basePath, queryParams, { page: String(Math.min(totalPages, currentPage + 1)) })}
            className="cursor-pointer rounded-full border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:border-[#D8B87A]/35 hover:text-[#D8B87A]"
          >
            التالي
          </Link>
        </nav>
      ) : null}
    </main>
  );
}
