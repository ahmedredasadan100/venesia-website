import AdminNotice from "../../../../components/admin/AdminNotice";
import {
  AdminActionButton,
  AdminMetricCardsGrid,
  AdminPageContextHeader,
  AdminPageHeader,
} from "../../../../components/admin/ui";
import { PlusIcon } from "../../../../components/admin/AdminRowActions";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import {
  SERIES_DEFAULT_COLUMN_KEYS,
  SERIES_LIST_VIEW_KEY,
  SERIES_NOTICE_CODE_MAP,
} from "../../../../lib/admin/content/series-list-config";
import { resolveAdminNoticeFeedback } from "../../../../lib/admin/entity-list";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import SeriesTableClient, { type SeriesListRow } from "./SeriesTableClient";

export const dynamic = "force-dynamic";

type SeriesRow = {
  id: number;
  name: string;
  slug: string;
  status: string | null;
  sort_order: number | null;
  category_id: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type TopicSeriesJoinRow = {
  series_id: number | null;
};

type CategoryNameRow = {
  id: number;
  name: string;
};

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string; error?: string }>;
}) {
  const actor = await requireAdminSession();
  const params = await searchParams;
  const noticeFeedback = resolveAdminNoticeFeedback(
    SERIES_NOTICE_CODE_MAP,
    params?.error ? "error" : params?.notice,
    params?.error ? decodeURIComponent(params.error) : null,
  );

  const [
    { data: seriesRows, error: seriesError },
    { data: topicRows },
    { data: categoryRows },
    { data: preference, error: preferenceError },
  ] = await Promise.all([
    getSupabaseAdmin()
      .from("topic_series")
      .select(
        "id, name, slug, status, sort_order, category_id, created_at, updated_at",
      )
      .order("sort_order", { ascending: true })
      .order("id", { ascending: false }),
    getSupabaseAdmin().from("topics").select("series_id"),
    getSupabaseAdmin().from("topic_categories").select("id, name").order("name"),
    getSupabaseAdmin()
      .from("admin_user_preferences")
      .select("preferences")
      .eq("admin_user_id", actor.id)
      .eq("view_key", SERIES_LIST_VIEW_KEY)
      .maybeSingle<{ preferences: { visibleColumns?: string[] } }>(),
  ]);

  if (seriesError) {
    return (
      <main className="space-y-7">
        <AdminPageHeader
          title="إدارة السلاسل"
          description="قبل استخدام الصفحة، نفّذ ملف SQL الخاص بإنشاء جدول topic_series."
        />
        <AdminNotice
          variant="danger"
          title="جدول السلاسل غير جاهز"
          message={seriesError.message}
        />
      </main>
    );
  }

  const categoryNameById = new Map(
    ((categoryRows ?? []) as CategoryNameRow[]).map((item) => [
      item.id,
      item.name,
    ]),
  );

  const counts = new Map<number, number>();
  ((topicRows ?? []) as TopicSeriesJoinRow[]).forEach((row) => {
    if (!row.series_id) return;
    counts.set(row.series_id, (counts.get(row.series_id) ?? 0) + 1);
  });

  const series: SeriesListRow[] = ((seriesRows ?? []) as SeriesRow[]).map(
    (item) => ({
      ...item,
      category_name: item.category_id
        ? (categoryNameById.get(item.category_id) ?? null)
        : null,
      topics_count: counts.get(item.id) ?? 0,
    }),
  );

  const categoryOptions = ((categoryRows ?? []) as CategoryNameRow[]).map(
    (item) => ({
      value: String(item.id),
      label: item.name,
    }),
  );

  const activeCount = series.filter((item) => item.status === "published").length;
  const topicsTotal = series.reduce(
    (total, item) => total + item.topics_count,
    0,
  );
  const visibleColumns = Array.isArray(preference?.preferences?.visibleColumns)
    ? preference.preferences.visibleColumns
    : [...SERIES_DEFAULT_COLUMN_KEYS];

  return (
    <main className="space-y-7">
      <AdminPageContextHeader
        eyebrow="SERIES CONTROL"
        title="إدارة السلاسل"
        description="من هنا تُدار سلاسل المحتوى، مع تنظيم الربط بالمقالات والتصنيفات وتحسين بنية النشر من مكان واحد."
        actions={
          <>
            <AdminActionButton href="/admin/content/series/new" variant="primary">
              <PlusIcon />
              إضافة سلسلة جديدة
            </AdminActionButton>
            <AdminActionButton href="/admin/content/topics" variant="dark">
              عرض الموضوعات
            </AdminActionButton>
            <AdminActionButton href="/admin/content/categories" variant="dark">
              عرض التصنيفات
            </AdminActionButton>
          </>
        }
      />

      <AdminMetricCardsGrid
        items={[
          {
            label: "إجمالي السلاسل",
            value: series.length,
            tone: "gold",
            compact: true,
          },
          {
            label: "منشور",
            value: activeCount,
            tone: "green",
            compact: true,
          },
          {
            label: "الموضوعات",
            value: topicsTotal,
            tone: "cyan",
            compact: true,
          },
        ]}
      />

      {noticeFeedback ? (
        <AdminNotice
          variant={noticeFeedback.variant}
          title={noticeFeedback.title || undefined}
          message={noticeFeedback.message}
          layout={noticeFeedback.layout}
          dismissible={noticeFeedback.dismissible}
        />
      ) : null}
      {preferenceError ? (
        <AdminNotice
          variant="danger"
          title="تعذر تحميل تفضيلات الأعمدة"
          message={preferenceError.message}
        />
      ) : null}

      <SeriesTableClient
        key={series
          .map(
            (item) =>
              `${item.id}:${item.status}:${item.topics_count}:${item.updated_at ?? ""}`,
          )
          .join("|")}
        series={series}
        categoryOptions={categoryOptions}
        initialVisibleColumns={visibleColumns}
      />
    </main>
  );
}
