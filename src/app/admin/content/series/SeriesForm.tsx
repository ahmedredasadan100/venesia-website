import { AdminActionButton, AdminCard } from "../../../../components/admin/ui";
import type { TopicCategoryOption } from "../../../../lib/admin/load-topic-categories";
import { createSeries, updateSeries } from "./actions";

type SeriesFormData = {
  id?: number;
  name?: string | null;
  slug?: string | null;
  status?: string | null;
  sort_order?: number | null;
  category_id?: number | null;
};

type SeriesFormProps = {
  mode: "create" | "edit";
  series?: SeriesFormData | null;
  categories: TopicCategoryOption[];
};

export default function SeriesForm({ mode, series, categories }: SeriesFormProps) {
  const action = mode === "edit" ? updateSeries : createSeries;

  return (
    <AdminCard className="p-6">
      <form action={action} className="space-y-6">
        {series?.id ? <input type="hidden" name="id" value={series.id} /> : null}

        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr_1fr_180px_150px] lg:items-end">
          <label className="block">
            <span className="text-sm font-medium text-white/70">اسم السلسلة</span>
            <input
              name="name"
              required
              defaultValue={series?.name ?? ""}
              placeholder="مثال: اعرف السوق"
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-white/70">Slug</span>
            <input
              name="slug"
              defaultValue={series?.slug ?? ""}
              placeholder="know-the-market"
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 font-en text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-white/70">التصنيف</span>
            <select
              name="category_id"
              required
              defaultValue={series?.category_id ? String(series.category_id) : ""}
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45"
            >
              <option value="" disabled>
                اختر التصنيف
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-white/70">الحالة</span>
            <select
              name="status"
              defaultValue={series?.status ?? "published"}
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45"
            >
              <option value="published">منشور</option>
              <option value="unpublished">مخفي</option>
              <option value="draft">مسودة</option>
              <option value="archived">أرشيف</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-white/70">الترتيب</span>
            <input
              name="sort_order"
              type="number"
              defaultValue={series?.sort_order ?? 0}
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 font-en text-sm text-white outline-none focus:border-[#D8B87A]/45"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="rounded-full bg-[#D8B87A] px-6 py-3 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]">
            {mode === "edit" ? "حفظ التعديل" : "إضافة السلسلة"}
          </button>
          <AdminActionButton href="/admin/content/series" variant="dark">رجوع للسلاسل</AdminActionButton>
        </div>
      </form>
    </AdminCard>
  );
}
