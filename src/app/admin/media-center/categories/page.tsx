import Link from "next/link";
import AdminNotice from "../../../../components/admin/AdminNotice";
import AdminPageHeader from "../../../../components/admin/AdminPageHeader";
import { AdminTablePagination } from "../../../../components/admin/ui";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import MediaCategoriesTableClient, { type MediaCategoryRow } from "./MediaCategoriesTableClient";
import MediaCategoryCreateModal from "./MediaCategoryCreateModal";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

type CategoryRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number | null;
  is_active: boolean | null;
};

type CategoriesSearchParams = {
  page?: string;
  notice?: string;
  error?: string;
  sort?: string;
  dir?: string;
};

type SortKey = "name" | "items" | "status";
type SortDir = "asc" | "desc";

function getNoticeText(notice?: string) {
  if (notice === "created") return "تم إنشاء تصنيف المركز الإعلامي بنجاح.";
  if (notice === "updated") return "تم تحديث التصنيف بنجاح.";
  if (notice === "deleted") return "تم حذف التصنيف بنجاح.";
  if (notice === "shown") return "تم إظهار التصنيف بنجاح.";
  if (notice === "hidden") return "تم إخفاء التصنيف بنجاح.";
  if (notice === "reordered") return "تم تحديث ترتيب التصنيفات بنجاح.";
  return null;
}

function getPage(value?: string) {
  const page = Number(value ?? "1");
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

async function getUsageCounts(slugs: string[]) {
  const entries = await Promise.all(
    slugs.map(async (slug) => {
      const { count } = await getSupabaseAdmin()
        .from("media_items")
        .select("id", { count: "exact", head: true })
        .eq("category_slug", slug)
        .is("deleted_at", null);

      return [slug, count ?? 0] as const;
    })
  );

  return new Map(entries);
}

export default async function MediaCategoriesPage({ searchParams }: { searchParams?: Promise<CategoriesSearchParams> }) {
  const query = await searchParams;
  const currentPage = getPage(query?.page);
  const notice = getNoticeText(query?.notice);
  const errorMessage = query?.error ? decodeURIComponent(query.error) : null;

  // View sorting (query params). No sort params → default view = sort_order ASC.
  const sortKey: SortKey | null =
    query?.sort === "name" || query?.sort === "items" || query?.sort === "status" ? query.sort : null;
  const dir: SortDir = query?.dir === "desc" ? "desc" : "asc";
  const isDefaultSort = sortKey === null;

  // Fetch ALL categories in the default order (sort_order ASC, name ASC), then sort
  // the full dataset in-memory BEFORE paginating — so sorting is data-wide, not page-only.
  const { data: categories } = await getSupabaseAdmin()
    .from("media_categories")
    .select("id, name, slug, description, sort_order, is_active")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const baseOrdered = (categories ?? []) as CategoryRow[];
  const usageCounts = await getUsageCounts(baseOrdered.map((category) => category.slug));
  const totalCount = baseOrdered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Default-order global index → drives manual reorder arrow enabling (default view only).
  const defaultIndexById = new Map<number, number>();
  baseOrdered.forEach((category, index) => defaultIndexById.set(category.id, index));

  const enriched = baseOrdered.map((category) => ({
    ...category,
    usage_count: usageCounts.get(category.slug) ?? 0,
  }));

  const ordered = isDefaultSort
    ? enriched
    : [...enriched].sort((a, b) => {
        const factor = dir === "asc" ? 1 : -1;
        let cmp = 0;
        if (sortKey === "name") cmp = a.name.localeCompare(b.name, "ar");
        else if (sortKey === "items") cmp = a.usage_count - b.usage_count;
        else if (sortKey === "status") cmp = Number(a.is_active) - Number(b.is_active);
        if (cmp === 0) cmp = a.name.localeCompare(b.name, "ar");
        return cmp * factor;
      });

  const from = (currentPage - 1) * PAGE_SIZE;
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const rangeStart = totalCount === 0 ? 0 : from + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min(safePage * PAGE_SIZE, totalCount);
  const pageSlice = ordered.slice(from, from + PAGE_SIZE);

  const tableRows: MediaCategoryRow[] = pageSlice.map((category) => {
    const defaultIndex = defaultIndexById.get(category.id) ?? 0;
    return {
      id: category.id,
      name: category.name,
      is_active: Boolean(category.is_active),
      usage_count: category.usage_count,
      // Based on the DEFAULT (sort_order) global position; only meaningful in default view.
      can_move_up: defaultIndex > 0,
      can_move_down: defaultIndex < totalCount - 1,
    };
  });

  return (
    <main className="space-y-7">
      <AdminPageHeader
        variant="context"
        eyebrow="MEDIA CATEGORIES"
        title="تصنيفات المركز الإعلامي"
        contextLine="أنت الآن تدير: تصنيفات المركز الإعلامي"
        description="إدارة التصنيفات التي يتم ربط الأخبار، الفيديوهات، الجاليري، البيانات الصحفية، وتحديثات المواقع بها داخل Supabase."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <MediaCategoryCreateModal />
            <Link href="/admin/media-center" className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white/65 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A]">رجوع للمركز الإعلامي</Link>
          </div>
        }
      />

      {notice ? <AdminNotice variant="success" message={notice} /> : null}
      {errorMessage ? <AdminNotice variant="danger" title="تعذر تنفيذ العملية" message={errorMessage} /> : null}

      <MediaCategoriesTableClient
        categories={tableRows}
        totalCount={totalCount}
        sortKey={sortKey}
        dir={dir}
        isDefaultSort={isDefaultSort}
      />

      <AdminTablePagination
        basePath="/admin/media-center/categories"
        currentPage={safePage}
        totalPages={totalPages}
        totalCount={totalCount}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        pageSize={String(PAGE_SIZE)}
        showPageSizeSelector={false}
        emptySummaryText="لا توجد تصنيفات مطابقة"
      />
    </main>
  );
}
