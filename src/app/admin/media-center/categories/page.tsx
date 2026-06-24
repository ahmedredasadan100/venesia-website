import Link from "next/link";
import AdminNotice from "../../../../components/admin/AdminNotice";
import AdminPageHeader from "../../../../components/admin/AdminPageHeader";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import CategorySlugFields from "./CategorySlugFields";
import { createMediaCategory, deleteMediaCategory, toggleMediaCategoryStatus, updateMediaCategory } from "./actions";

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
};

function getNoticeText(notice?: string) {
  if (notice === "created") return "تم إنشاء تصنيف المركز الإعلامي بنجاح.";
  if (notice === "updated") return "تم تحديث التصنيف بنجاح.";
  if (notice === "deleted") return "تم حذف التصنيف بنجاح.";
  if (notice === "shown") return "تم إظهار التصنيف بنجاح.";
  if (notice === "hidden") return "تم إخفاء التصنيف بنجاح.";
  return null;
}

function getPage(value?: string) {
  const page = Number(value ?? "1");
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function pageHref(page: number) {
  return `/admin/media-center/categories?page=${page}`;
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

function Pagination({ currentPage, totalPages }: { currentPage: number; totalPages: number }) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 px-6 py-5">
      {currentPage > 1 ? <Link href={pageHref(currentPage - 1)} className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/60 transition hover:border-[#D8B87A]/45 hover:text-[#D8B87A]">السابق</Link> : null}
      {pages.map((page) => (
        <Link key={page} href={pageHref(page)} className={`rounded-full px-4 py-2 text-xs font-semibold transition ${page === currentPage ? "bg-[#D8B87A] text-[#06101C]" : "border border-white/10 text-white/55 hover:border-[#D8B87A]/45 hover:text-[#D8B87A]"}`}>
          {page}
        </Link>
      ))}
      {currentPage < totalPages ? <Link href={pageHref(currentPage + 1)} className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/60 transition hover:border-[#D8B87A]/45 hover:text-[#D8B87A]">التالي</Link> : null}
    </div>
  );
}

export default async function MediaCategoriesPage({ searchParams }: { searchParams?: Promise<CategoriesSearchParams> }) {
  const query = await searchParams;
  const currentPage = getPage(query?.page);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const notice = getNoticeText(query?.notice);
  const errorMessage = query?.error ? decodeURIComponent(query.error) : null;

  const { data: categories, count } = await getSupabaseAdmin()
    .from("media_categories")
    .select("id, name, slug, description, sort_order, is_active", { count: "exact" })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .range(from, to);

  const safeCategories = (categories ?? []) as CategoryRow[];
  const usageCounts = await getUsageCounts(safeCategories.map((category) => category.slug));
  const totalCount = count ?? safeCategories.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <main className="space-y-7">
      <AdminPageHeader
        eyebrow="MEDIA CATEGORIES"
        title="تصنيفات المركز الإعلامي"
        description="إدارة التصنيفات التي يتم ربط الأخبار، الفيديوهات، الجاليري، البيانات الصحفية، وتحديثات المواقع بها داخل Supabase."
        actions={<Link href="/admin/media-center" className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white/65 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A]">رجوع للمركز الإعلامي</Link>}
      />

      {notice ? <AdminNotice variant="success" message={notice} /> : null}
      {errorMessage ? <AdminNotice variant="danger" title="تعذر تنفيذ العملية" message={errorMessage} /> : null}

      <section className="rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <p className="font-en text-xs tracking-[0.34em] text-[#D8B87A]/70">CREATE CATEGORY</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">تصنيف جديد</h2>

        <form action={createMediaCategory} className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr_1.2fr_110px_120px_150px] xl:items-start">
          <CategorySlugFields />

          <div className="space-y-2">
            <label className="text-xs font-medium text-white/45">الوصف</label>
            <input name="description" placeholder="وصف داخلي اختياري" className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#D8B87A]/45" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-white/45">الترتيب</label>
            <input name="sort_order" type="number" defaultValue={0} className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 font-en text-sm text-white outline-none focus:border-[#D8B87A]/45" />
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-medium text-white/45">الحالة</span>
            <label className="flex h-[46px] items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/70">
              <input type="checkbox" name="is_active" defaultChecked className="h-4 w-4 accent-[#D8B87A]" />
              ظاهر
            </label>
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-medium text-white/45">الإجراء</span>
            <button className="h-[46px] w-full rounded-full bg-[#D8B87A] px-6 py-3 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]">إنشاء التصنيف</button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#080B10]/92 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 p-6">
          <div>
            <p className="font-en text-xs tracking-[0.34em] text-[#D8B87A]/70">CATEGORIES LIST</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">التصنيفات الحالية</h2>
          </div>
          <span className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/45">{totalCount} تصنيف</span>
        </div>

        <div className="divide-y divide-white/10">
          {safeCategories.map((category) => {
            const usageCount = usageCounts.get(category.slug) ?? 0;
            const isUsed = usageCount > 0;
            const isActive = Boolean(category.is_active);

            return (
              <div key={category.id} className={`p-5 ${isActive ? "bg-white/[0.01]" : "bg-red-950/[0.06]"}`}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-4 py-2 text-xs font-medium ${isActive ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-200" : "border-red-400/20 bg-red-400/5 text-red-200"}`}>{isActive ? "ظاهر" : "مخفي"}</span>
                    <span className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/45">{usageCount} عنصر</span>
                  </div>
                </div>

                <form id={`media-category-update-${category.id}`} action={updateMediaCategory} className="grid gap-4 xl:grid-cols-[1fr_1fr_1.2fr_110px_350px] xl:items-start">
                  <input type="hidden" name="id" value={category.id} />
                  <input type="hidden" name="is_active" value={isActive ? "true" : "false"} />
                  <CategorySlugFields nameDefaultValue={category.name} slugDefaultValue={category.slug} />

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-white/45">الوصف</label>
                    <input name="description" defaultValue={category.description ?? ""} placeholder="وصف داخلي اختياري" className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#D8B87A]/45" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-white/45">الترتيب</label>
                    <input name="sort_order" type="number" defaultValue={category.sort_order ?? 0} className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 font-en text-sm text-white outline-none focus:border-[#D8B87A]/45" />
                  </div>

                  <div className="flex flex-wrap gap-2 xl:pt-7">
                    <button className="rounded-full bg-[#D8B87A] px-5 py-3 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]">حفظ</button>
                  </div>
                </form>

                <div className="mt-4 flex flex-wrap gap-2">
                  <form action={toggleMediaCategoryStatus}>
                    <input type="hidden" name="id" value={category.id} />
                    <button className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/60 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A]">{isActive ? "إخفاء" : "إظهار"}</button>
                  </form>

                  <form action={deleteMediaCategory}>
                    <input type="hidden" name="id" value={category.id} />
                    <button disabled={isUsed} className="rounded-full border border-red-400/20 px-4 py-2 text-xs text-red-200 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/25">حذف</button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>

        <Pagination currentPage={currentPage} totalPages={totalPages} />
      </section>
    </main>
  );
}
