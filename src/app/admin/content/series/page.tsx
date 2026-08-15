import AdminNotice from "../../../../components/admin/AdminNotice";
import {
  AdminActionButton,
  AdminPageContextHeader,
  AdminPageExperience,
  AdminPageHeader,
} from "../../../../components/admin/ui";
import { PlusIcon } from "../../../../components/admin/AdminRowActions";
import {
  SERIES_DEFAULT_COLUMN_KEYS,
  SERIES_LIST_VIEW_KEY,
  SERIES_NOTICE_CODE_MAP,
} from "../../../../lib/admin/content/series-list-config";
import { seriesEntityListAdapter } from "../../../../lib/admin/content/entity-list-adapters/series";
import { seriesQueryContract } from "../../../../lib/admin/content/entity-list-contracts/series";
import { normalizeAdminEntityListQuery } from "../../../../lib/admin/entity-list/data-engine/contracts";
import { resolveAdminNoticeFeedback } from "../../../../lib/admin/entity-list";
import { readAdminColumnPreferences } from "../../../../lib/admin/preferences/admin-column-preferences";
import SeriesTableClient from "./SeriesTableClient";

export const dynamic = "force-dynamic";

type SeriesSearchParams = {
  q?: string;
  view?: string;
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
        view: params?.view,
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

  const [preference, listResult] = await Promise.all([
    readAdminColumnPreferences(SERIES_LIST_VIEW_KEY),
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
          eyebrow="SERIES CONTROL"
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

  const visibleColumns =
    preference.visibleColumns ?? [...SERIES_DEFAULT_COLUMN_KEYS];

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
            <AdminActionButton
              href="/admin/content/series?view=trash"
              variant="dark"
            >
              المحذوفات
            </AdminActionButton>
          </>
        }
      />

      {preference.error ? (
        <AdminNotice
          variant="danger"
          title="تعذر تحميل تفضيلات الأعمدة"
          message={preference.error}
        />
      ) : null}

      {listResult.data ? (
        <SeriesTableClient
          key={query.filters.view}
          initialQuery={query}
          initialResult={listResult.data}
          initialVisibleColumns={visibleColumns}
          initialFeedback={noticeFeedback}
        />
      ) : null}
    </AdminPageExperience>
  );
}
