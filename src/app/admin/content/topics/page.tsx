import AdminNotice from "../../../../components/admin/AdminNotice";
import {
  AdminActionButton,
  AdminPageContextHeader,
  AdminPageExperience,
} from "../../../../components/admin/ui";
import TopicsListClient from "../../../../components/admin/content/TopicsListClient";
import { DEFAULT_UNIFIED_CONTENT_COLUMN_KEYS } from "../../../../components/admin/content/unified-content-columns";
import {
  buildAdminCategoryTree,
  flattenAdminCategoryTree,
  type AdminContentCategory,
} from "../../../../lib/admin/content/category-hierarchy";
import {
  CONTENT_LIST_VIEW_KEY,
  type ContentListSearchParams,
} from "../../../../lib/admin/content/load-unified-content";
import { TOPICS_COLUMN_CONTRACT_VERSION } from "../../../../lib/admin/content/topics-list-config";
import { loadTopicsEntityListResult } from "../../../../lib/admin/content/entity-list-adapters/topics";
import { topicsQueryContract } from "../../../../lib/admin/content/entity-list-contracts/topics";
import { TOPICS_NOTICE_CODE_MAP } from "../../../../lib/admin/content/topics-list-config";
import { resolveAdminNoticeFeedback } from "../../../../lib/admin/entity-list";
import { normalizeAdminEntityListQuery } from "../../../../lib/admin/entity-list/data-engine/contracts";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { readAdminColumnPreferences } from "../../../../lib/admin/preferences/admin-column-preferences";
import { ADMIN_CONTENT_ROUTES } from "../../../../lib/admin/content-routes";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

type SearchParams = ContentListSearchParams & {
  notice?: string;
  message?: string;
};

type SeriesRow = {
  id: number;
  name: string;
  status: string;
  deleted_at: string | null;
};

export default async function UnifiedContentTopicsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireAdminSession();
  const params = await searchParams;
  const query = normalizeAdminEntityListQuery(
    topicsQueryContract,
    new URLSearchParams(
      Object.entries({
        q: params?.q,
        view: params?.view,
        content_type: params?.content_type,
        category: params?.category,
        series: params?.series,
        status: params?.status,
        featured: params?.featured,
        sort: params?.sort,
        page: params?.page,
        limit: params?.limit,
      }).flatMap(([key, value]) =>
        typeof value === "string" && value.length > 0 ? [[key, value]] : [],
      ),
    ),
  );
  const supabase = getSupabaseAdmin();
  const [
    { data: categoryRows, error: categoriesError },
    { data: seriesRows, error: seriesError },
    preference,
  ] = await Promise.all([
    supabase
      .from("topic_categories")
      .select("id,name,slug,parent_id,sort_order,is_active,status,color_token")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("topic_series")
      .select("id,name,status,deleted_at")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    readAdminColumnPreferences(CONTENT_LIST_VIEW_KEY, {
      contractVersion: TOPICS_COLUMN_CONTRACT_VERSION,
    }),
  ]);

  const categories = (categoryRows ?? []) as AdminContentCategory[];
  const categoryTree = buildAdminCategoryTree(categories);
  const flattenedCategories = flattenAdminCategoryTree(categoryTree);
  const series = (seriesRows ?? []) as SeriesRow[];
  let listError: string | null = null;
  let initialResult = null;
  try {
    initialResult = await loadTopicsEntityListResult(query, categories);
  } catch (error) {
    listError =
      error instanceof Error ? error.message : "Unable to load topics.";
  }
  const noticeFeedback = resolveAdminNoticeFeedback(
    TOPICS_NOTICE_CODE_MAP,
    params?.notice,
    params?.message,
  );
  const visibleColumns = Array.isArray(preference.visibleColumns)
    ? preference.visibleColumns
    : [...DEFAULT_UNIFIED_CONTENT_COLUMN_KEYS];
  const loadError =
    categoriesError?.message ??
    seriesError?.message ??
    preference.error ??
    initialResult?.metrics?.error ??
    listError;
  const listLoadError =
    categoriesError?.message ??
    seriesError?.message ??
    preference.error ??
    listError;

  return (
    <AdminPageExperience className="min-w-0">
      <AdminPageContextHeader
        eyebrow="UNIFIED CONTENT ENGINE"
        title="إدارة الموضوعات"
        description="قائمة موحدة لكل المقالات والأخبار والبيانات الصحفية وتحديثات التنفيذ والفيديوهات ومعارض الصور."
        actions={
          <>
            <AdminActionButton href={ADMIN_CONTENT_ROUTES.newTopic} variant="primary">
              + إضافة موضوع جديد
            </AdminActionButton>
            <AdminActionButton href={ADMIN_CONTENT_ROUTES.categories} variant="dark">
              إدارة التصنيفات
            </AdminActionButton>
            <AdminActionButton href={ADMIN_CONTENT_ROUTES.series} variant="dark">
              سلاسل المحتوى
            </AdminActionButton>
          </>
        }
      />

      {loadError ? (
        <AdminNotice
          variant="danger"
          title="تعذر تحميل بيانات المحتوى"
          message={loadError}
        />
      ) : null}

      {!listLoadError && initialResult ? (
        <TopicsListClient
          categories={flattenedCategories}
          series={series}
          initialQuery={query}
          initialResult={initialResult}
          initialVisibleColumns={visibleColumns}
          initialFeedback={noticeFeedback}
        />
      ) : null}
    </AdminPageExperience>
  );
}
