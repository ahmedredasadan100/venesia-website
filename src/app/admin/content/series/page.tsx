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
import {
  loadSeriesListData,
} from "../../../../lib/admin/content/load-series-list";
import { resolveAdminNoticeFeedback } from "../../../../lib/admin/entity-list";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import SeriesTableClient from "./SeriesTableClient";

export const dynamic = "force-dynamic";

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
    seriesResult,
    { data: preference, error: preferenceError },
  ] = await Promise.all([
    loadSeriesListData()
      .then((data) => ({ data, error: null }))
      .catch((error: unknown) => ({
        data: null,
        error:
          error instanceof Error ? error : new Error("Unable to load series."),
      })),
    getSupabaseAdmin()
      .from("admin_user_preferences")
      .select("preferences")
      .eq("admin_user_id", actor.id)
      .eq("view_key", SERIES_LIST_VIEW_KEY)
      .maybeSingle<{ preferences: { visibleColumns?: string[] } }>(),
  ]);
  const seriesError = seriesResult.error;

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

  const series = seriesResult.data?.rows ?? [];
  const categoryFilterModel = seriesResult.data?.categoryFilterModel ?? {
    options: [],
    descendantIdsByValue: {},
  };
  const activeCount = seriesResult.data?.metrics.published ?? 0;
  const topicsTotal = seriesResult.data?.metrics.topics ?? 0;
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
        categoryOptions={categoryFilterModel.options}
        categoryDescendantIdsByValue={
          categoryFilterModel.descendantIdsByValue
        }
        initialVisibleColumns={visibleColumns}
        initialFeedback={noticeFeedback}
      />
    </main>
  );
}
