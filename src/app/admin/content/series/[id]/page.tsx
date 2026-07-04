import { notFound } from "next/navigation";
import { AdminActionButton, AdminInfoBar, AdminPageContextHeader } from "../../../../../components/admin/ui";
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

function truncateWords(value: string, limit = 4) {
  const words = value.trim().split(/\s+/);
  if (words.length <= limit) return value;
  return `${words.slice(0, limit).join(" ")}...`;
}

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
      <AdminPageContextHeader
        eyebrow="SERIES CONTROL"
        contextLine="تعديل سلسلة:"
        title={truncateWords(data.name || "بدون اسم")}
        actions={
          <>
            <AdminActionButton href="/admin/content/series" variant="dark">عرض السلاسل</AdminActionButton>
            <AdminActionButton href="/admin/topics" variant="dark">عرض المقالات</AdminActionButton>
            <AdminActionButton href="/admin/topics/categories" variant="dark">عرض التصنيفات</AdminActionButton>
          </>
        }
      />

      <AdminInfoBar label="Series Edit" description="أي تعديل على اسم السلسلة أو الـ Slug يتم مزامنته مع الموضوعات المرتبطة بها." />
      <SeriesForm mode="edit" series={data} categories={categories} />
    </main>
  );
}
