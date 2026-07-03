import AdminNotice from "../../../../components/admin/AdminNotice";
import { AdminActionButton, AdminInfoBar, AdminPageHeader } from "../../../../components/admin/ui";
import { PlusIcon } from "../../../../components/admin/AdminRowActions";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import SeriesTableClient, { type SeriesListRow } from "./SeriesTableClient";

export const dynamic = "force-dynamic";

type SeriesRow = {
  id: number;
  name: string;
  slug: string;
  status: string | null;
  sort_order: number | null;
};

type TopicSeriesJoinRow = {
  series_id: number | null;
};

function getNoticeText(notice?: string) {
  if (notice === "created") return "تم إنشاء السلسلة بنجاح.";
  if (notice === "updated") return "تم تحديث السلسلة بنجاح.";
  if (notice === "deleted") return "تم حذف السلسلة بنجاح.";
  if (notice === "published") return "تم إظهار السلسلة بنجاح.";
  if (notice === "unpublished") return "تم إخفاء السلسلة بنجاح.";
  if (notice === "duplicated") return "تم نسخ السلسلة بنجاح.";
  return null;
}

export default async function Page({ searchParams }: { searchParams?: Promise<{ notice?: string; error?: string }> }) {
  const params = await searchParams;
  const notice = getNoticeText(params?.notice);
  const errorMessage = params?.error ? decodeURIComponent(params.error) : null;

  const [{ data: seriesRows, error: seriesError }, { data: topicRows }] = await Promise.all([
    getSupabaseAdmin()
      .from("topic_series")
      .select("id, name, slug, status, sort_order")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: false }),
    getSupabaseAdmin().from("topics").select("series_id"),
  ]);

  if (seriesError) {
    return (
      <main className="space-y-7">
        <AdminPageHeader title="إدارة السلاسل" description="قبل استخدام الصفحة، نفّذ ملف SQL الخاص بإنشاء جدول topic_series." />
        <AdminNotice variant="danger" title="جدول السلاسل غير جاهز" message={seriesError.message} />
      </main>
    );
  }

  const counts = new Map<number, number>();
  ((topicRows ?? []) as TopicSeriesJoinRow[]).forEach((row) => {
    if (!row.series_id) return;
    counts.set(row.series_id, (counts.get(row.series_id) ?? 0) + 1);
  });

  const series: SeriesListRow[] = ((seriesRows ?? []) as SeriesRow[]).map((item) => ({
    ...item,
    topics_count: counts.get(item.id) ?? 0,
  }));

  const activeCount = series.filter((item) => item.status === "published").length;
  const linkedCount = series.reduce((total, item) => total + item.topics_count, 0);

  return (
    <main className="space-y-7">
      <AdminPageHeader
        variant="context"
        title="إدارة السلاسل"
        contextLine="أنت الآن تدير: سلاسل المحتوى"
        description="كل سلسلة تابعة لتصنيف من Topics Categories، ويتم اختيارها من داخل الموضوعات."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <AdminActionButton href="/admin/content/series/new" variant="primary">
              <PlusIcon />
              إضافة سلسلة
            </AdminActionButton>
            <AdminActionButton href="/admin/topics" variant="dark">عرض المقالات</AdminActionButton>
            <AdminActionButton href="/admin/topics/categories" variant="dark">عرض التصنيفات</AdminActionButton>
          </div>
        }
      />

      <AdminInfoBar
        label="Content Series Layer"
        description="كل سلسلة تابعة لتصنيف — التصنيف يُختار عند إنشاء السلسلة."
        meta={`${series.length} Series / ${activeCount} Active / ${linkedCount} Linked Topics`}
      />

      {notice ? <AdminNotice variant="success" message={notice} /> : null}
      {errorMessage ? <AdminNotice variant="danger" title="تعذر تنفيذ العملية" message={errorMessage} /> : null}

      <SeriesTableClient series={series} />
    </main>
  );
}
