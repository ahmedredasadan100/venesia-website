import Link from "next/link";
import { notFound } from "next/navigation";
import AdminNotice from "../../../../../components/admin/AdminNotice";
import AdminPageHeader from "../../../../../components/admin/AdminPageHeader";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import CategorySlugFields from "../CategorySlugFields";
import { updateMediaCategory } from "../actions";

export const dynamic = "force-dynamic";

type CategoryRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number | null;
  is_active: boolean | null;
};

export default async function EditMediaCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const errorMessage = query?.error ? decodeURIComponent(query.error) : null;

  if (!/^\d+$/.test(id)) notFound();

  const { data, error } = await getSupabaseAdmin()
    .from("media_categories")
    .select("id, name, slug, description, sort_order, is_active")
    .eq("id", id)
    .maybeSingle<CategoryRow>();

  if (error || !data) notFound();

  return (
    <main className="space-y-7">
      <AdminPageHeader
        eyebrow="EDIT CATEGORY"
        title={`تعديل التصنيف: ${data.name}`}
        description="عدّل بيانات التصنيف من هنا: الاسم، الـ Slug، الوصف، الترتيب، والحالة."
        actions={
          <Link
            href="/admin/media-center/categories"
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white/65 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A]"
          >
            رجوع للتصنيفات
          </Link>
        }
      />

      {errorMessage ? <AdminNotice variant="danger" title="تعذر حفظ التعديل" message={errorMessage} /> : null}

      <section className="rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <form action={updateMediaCategory} className="grid gap-5 md:grid-cols-2">
          <input type="hidden" name="id" value={data.id} />

          <div className="md:col-span-2">
            <CategorySlugFields nameDefaultValue={data.name} slugDefaultValue={data.slug} />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-white/45">الوصف</label>
            <input
              name="description"
              defaultValue={data.description ?? ""}
              placeholder="وصف داخلي اختياري"
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#D8B87A]/45"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-white/45">الترتيب</label>
            <input
              name="sort_order"
              type="number"
              defaultValue={data.sort_order ?? 0}
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 font-en text-sm text-white outline-none focus:border-[#D8B87A]/45"
            />
          </div>

          <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/70 md:col-span-2">
            <span>ظاهر</span>
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={Boolean(data.is_active)}
              className="h-4 w-4 accent-[#D8B87A]"
            />
          </label>

          <div className="flex justify-end md:col-span-2">
            <button className="rounded-full bg-[#D8B87A] px-6 py-3 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]">
              حفظ التعديلات
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
