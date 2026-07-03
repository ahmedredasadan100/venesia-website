import AdminNotice from "../../../../../components/admin/AdminNotice";
import {
  ADMIN_FORM,
  AdminActionButton,
  AdminPageHeader,
} from "../../../../../components/admin/ui";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { flattenCategoryTree, type CategoryTreeNode } from "../../../../../lib/admin/category-tree";
import CategoryParentSelect from "../CategoryParentSelect";
import CategorySlugFields from "../CategorySlugFields";
import { createCategory } from "../actions";

export const dynamic = "force-dynamic";

type ParentRow = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  sort_order: number | null;
  is_active: boolean | null;
};

function buildParentTree(rows: ParentRow[]): CategoryTreeNode[] {
  const map = new Map<number, CategoryTreeNode>();
  rows.forEach((row) => map.set(row.id, { ...row, children: [] }));

  const roots: CategoryTreeNode[] = [];
  rows.forEach((row) => {
    const node = map.get(row.id)!;
    if (row.parent_id && map.has(row.parent_id)) {
      map.get(row.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export default async function NewTopicCategoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const errorMessage = query?.error ? decodeURIComponent(query.error) : null;

  const { data: categories } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id, name, slug, parent_id, sort_order, is_active")
    .order("parent_id", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  const parentOptions = flattenCategoryTree(buildParentTree((categories ?? []) as ParentRow[]));

  return (
    <main className="space-y-7" dir="rtl">
      <AdminPageHeader
        variant="context"
        eyebrow="Admin Panel"
        title="إضافة تصنيف جديد"
        contextLine="أنت الآن تضيف: تصنيف جديد للموضوعات"
        description="أنشئ تصنيفًا جديدًا وحدّد التصنيف الأب والترتيب قبل الحفظ."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <AdminActionButton href="/admin/topics" variant="dark">عرض المقالات</AdminActionButton>
            <AdminActionButton href="/admin/topics/categories" variant="dark">عرض التصنيفات</AdminActionButton>
            <AdminActionButton href="/admin/content/series" variant="dark">عرض السلاسل</AdminActionButton>
          </div>
        }
      />

      {errorMessage ? <AdminNotice variant="danger" title="تعذر إنشاء التصنيف" message={errorMessage} /> : null}

      <section className="rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <form action={createCategory} className={ADMIN_FORM.gridTwoCol}>
          <div className="md:col-span-2">
            <CategorySlugFields />
          </div>

          <div className="space-y-2 text-right">
            <label className="text-xs font-medium text-white/45">التصنيف الأب</label>
            <CategoryParentSelect options={parentOptions} />
          </div>

          <div className="space-y-2 text-right">
            <label className="text-xs font-medium text-white/45">الترتيب</label>
            <input
              name="sort_order"
              type="number"
              defaultValue={0}
              className="w-full min-h-11 rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#D8B87A]/45 text-right font-en"
            />
          </div>

          <label className={`${ADMIN_FORM.checkboxRow} md:col-span-2`}>
            <span>منشور</span>
            <input type="checkbox" name="is_active" defaultChecked className="h-4 w-4 accent-[#D8B87A]" />
          </label>

          <div className="flex justify-end md:col-span-2">
            <button className="rounded-full bg-[#D8B87A] px-6 py-3 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]">
              حفظ التصنيف
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
