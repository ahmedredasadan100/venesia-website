import AdminNotice from "../../../../components/admin/AdminNotice";
import {
  AdminActionButton,
  AdminPageContextHeader,
  AdminPageExperience,
  AdminPageHeader,
} from "../../../../components/admin/ui";
import { PlusIcon } from "../../../../components/admin/AdminRowActions";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import {
  SERIES_DEFAULT_COLUMN_KEYS,
  SERIES_LIST_VIEW_KEY,
  SERIES_NOTICE_CODE_MAP,
} from "../../../../lib/admin/content/series-list-config";
import { seriesEntityListAdapter } from "../../../../lib/admin/content/entity-list-adapters/series";
import { seriesQueryContract } from "../../../../lib/admin/content/entity-list-contracts/series";
import { normalizeAdminEntityListQuery } from "../../../../lib/admin/entity-list/data-engine/contracts";
import { resolveAdminNoticeFeedback } from "../../../../lib/admin/entity-list";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import SeriesTableClient from "./SeriesTableClient";

export const dynamic = "force-dynamic";

type SeriesSearchParams = {
  q?: string;
  status?: string;
  category?: string;
  sort?: string;
  page?: string;
  limit?: string;
  notice?: string;
  error?: string;
};

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<SeriesSearchParams>;
}) {
  const actor = await requireAdminSession();
  const params = await searchParams;
  const noticeFeedback = resolveAdminNoticeFeedback(
    SERIES_NOTICE_CODE_MAP,
    params?.error ? "error" : params?.notice,
    params?.error ? decodeURIComponent(params.error) : null,
  );
  const query = normalizeAdminEntityListQuery(
    seriesQueryContract,
    new URLSearchParams(
      Object.entries({
        q: params?.q,
        status: params?.status,
        category: params?.category,
        sort: params?.sort,
        page: params?.page,
        limit: params?.limit,
      }).flatMap(([key, value]) =>
        typeof value === "string" && value.length > 0 ? [[key, value]] : [],
      ),
    ),
  );

  const [{ data: preference, error: preferenceError }, listResult] =
    await Promise.all([
      getSupabaseAdmin()
        .from("admin_user_preferences")
        .select("preferences")
        .eq("admin_user_id", actor.id)
        .eq("view_key", SERIES_LIST_VIEW_KEY)
        .maybeSingle<{ preferences: { visibleColumns?: string[] } }>(),
      seriesEntityListAdapter
        .load(query)
        .then((data) => ({ data, error: null as Error | null }))
        .catch((error: unknown) => ({
          data: null,
          error:
            error instanceof Error ? error : new Error("Unable to load series."),
        })),
    ]);

  if (listResult.error) {
    return (
      <AdminPageExperience state="error">
        <AdminPageHeader
          title="إدارة السلاسل"
          description="قبل استخدام الصفحة، نفّذ ملف SQL الخاص بإنشاء جدول topic_series."
        />
        <AdminNotice
          variant="danger"
          title="جدول السلاسل غير جاهز"
          message={listResult.error.message}
        />
      </AdminPageExperience>
    );
  }

  const visibleColumns = Array.isArray(preference?.preferences?.visibleColumns)
    ? preference.preferences.visibleColumns
    : [...SERIES_DEFAULT_COLUMN_KEYS];

  return (
    <AdminPageExperience>
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

      {preferenceError ? (
        <AdminNotice
          variant="danger"
          title="تعذر تحميل تفضيلات الأعمدة"
          message={preferenceError.message}
        />
      ) : null}

      {listResult.data ? (
        <SeriesTableClient
          initialQuery={query}
          initialResult={listResult.data}
          initialVisibleColumns={visibleColumns}
          initialFeedback={noticeFeedback}
        />
      ) : null}
    </AdminPageExperience>
  );
}
