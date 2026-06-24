import { notFound } from "next/navigation";
import { AdminInfoBar, AdminPageHeader } from "../../../../../components/admin/ui";
import { loadActiveTopicCategoriesForAdmin } from "../../../../../lib/admin/load-topic-categories";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import SeriesForm from "../SeriesForm";

export const dynamic = "force-dynamic";

type SeriesRow = {
  id: number;
  name: string;
  slug: string;
  status: string | null;
  sort_order: number | null;
  category_id: number | null;
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!/^\d+$/.test(id)) notFound();

  const [{ data, error }, activeCategories] = await Promise.all([
    getSupabaseAdmin()
      .from("topic_series")
      .select("id, name, slug, status, sort_order, category_id")
      .eq("id", id)
      .maybeSingle<SeriesRow>(),
    loadActiveTopicCategoriesForAdmin(),
  ]);

  if (error || !data) notFound();

  let categories = activeCategories;
  if (data.category_id && !categories.some((category) => category.id === data.category_id)) {
    const { data: currentCategory } = await getSupabaseAdmin()
      .from("topic_categories")
      .select("id,name,slug")
      .eq("id", data.category_id)
      .maybeSingle();

    if (currentCategory) {
      categories = [...categories, currentCategory as typeof activeCategories[number]];
    }
  }

  return (
    <main className="space-y-7">
      <AdminPageHeader title="تعديل سلسلة" description="عدّل بيانات السلسلة وتصنيفها بدون خلطها مع جدول العرض." />
      <AdminInfoBar label="Series Edit" description="أي تعديل على اسم السلسلة أو الـ Slug يتم مزامنته مع الموضوعات المرتبطة بها." />
      <SeriesForm mode="edit" series={data} categories={categories} />
    </main>
  );
}
