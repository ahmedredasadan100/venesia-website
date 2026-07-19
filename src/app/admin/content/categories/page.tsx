import AdminNotice from "../../../../components/admin/AdminNotice";
import {
  AdminActionButton,
  AdminPageContextHeader,
  AdminPageExperience,
} from "../../../../components/admin/ui";
import { PlusIcon } from "../../../../components/admin/AdminRowActions";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { resolveAdminNoticeFeedback } from "../../../../lib/admin/entity-list";
import {
  CATEGORIES_DEFAULT_COLUMN_KEYS,
  CATEGORIES_LIST_VIEW_KEY,
  CATEGORIES_NOTICE_CODE_MAP,
} from "../../../../lib/admin/content/categories-list-config";
import { categoriesEntityListAdapter } from "../../../../lib/admin/content/entity-list-adapters/categories";
import { categoriesQueryContract } from "../../../../lib/admin/content/entity-list-contracts/categories";
import { normalizeAdminEntityListQuery } from "../../../../lib/admin/entity-list/data-engine/contracts";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import CategoriesListClient from "./CategoriesListClient";

export const dynamic = "force-dynamic";

type CategoriesSearchParams = {
  q?: string;
  status?: string;
  sort?: string;
  page?: string;
  limit?: string;
  notice?: string;
  error?: string;
};

export default async function TopicCategoriesPage({
  searchParams,
}: {
  searchParams?: Promise<CategoriesSearchParams>;
}) {
  const actor = await requireAdminSession();
  const queryParams = await searchParams;
  const noticeFeedback = resolveAdminNoticeFeedback(
    CATEGORIES_NOTICE_CODE_MAP,
    queryParams?.error ? "error" : queryParams?.notice,
    queryParams?.error ? decodeURIComponent(queryParams.error) : null,
  );
  const query = normalizeAdminEntityListQuery(
    categoriesQueryContract,
    new URLSearchParams(
      Object.entries({
        q: queryParams?.q,
        status: queryParams?.status,
        sort: queryParams?.sort,
        page: queryParams?.page,
        limit: queryParams?.limit,
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
        .eq("view_key", CATEGORIES_LIST_VIEW_KEY)
        .maybeSingle<{ preferences: { visibleColumns?: string[] } }>(),
      categoriesEntityListAdapter
        .load(query)
        .then((data) => ({ data, error: null as Error | null }))
        .catch((error: unknown) => ({
          data: null,
          error:
            error instanceof Error
              ? error
              : new Error("Unable to load categories."),
        })),
    ]);

  if (listResult.error) {
    return (
      <AdminPageExperience state="error">
        <AdminPageContextHeader
          eyebrow="CATEGORIES CONTROL"
          title="إدارة التصنيفات"
          description="من هنا تُدار تصنيفات موضوعات تهمك، مع تنظيم الظهور والربط بالمقالات والسلاسل وتحسين بنية المحتوى من مكان واحد."
        />
        <AdminNotice
          variant="danger"
          title="تعذر تحميل التصنيفات"
          message={listResult.error.message}
        />
      </AdminPageExperience>
    );
  }

  const visibleColumns = Array.isArray(preference?.preferences?.visibleColumns)
    ? preference.preferences.visibleColumns
    : [...CATEGORIES_DEFAULT_COLUMN_KEYS];

  return (
    <AdminPageExperience>
      <AdminPageContextHeader
        eyebrow="CATEGORIES CONTROL"
        title="إدارة التصنيفات"
        description="من هنا تُدار تصنيفات موضوعات تهمك، مع تنظيم الظهور والربط بالمقالات والسلاسل وتحسين بنية المحتوى من مكان واحد."
        actions={
          <>
            <AdminActionButton href="/admin/content/categories/new" variant="primary">
              <PlusIcon />
              إضافة تصنيف جديد
            </AdminActionButton>
            <AdminActionButton href="/admin/content/topics" variant="dark">
              عرض الموضوعات
            </AdminActionButton>
            <AdminActionButton href="/admin/content/series" variant="dark">
              عرض السلاسل
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
        <CategoriesListClient
          initialQuery={query}
          initialResult={listResult.data}
          initialVisibleColumns={visibleColumns}
          initialFeedback={noticeFeedback}
        />
      ) : null}
    </AdminPageExperience>
  );
}
