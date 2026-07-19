import AdminNotice from "../../../../components/admin/AdminNotice";
import {
  AdminActionButton,
  AdminPageContextHeader,
} from "../../../../components/admin/ui";
import { PlusIcon } from "../../../../components/admin/AdminRowActions";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { resolveAdminNoticeFeedback } from "../../../../lib/admin/entity-list";
import {
  CATEGORIES_DEFAULT_COLUMN_KEYS,
  CATEGORIES_LIST_VIEW_KEY,
  CATEGORIES_NOTICE_CODE_MAP,
} from "../../../../lib/admin/content/categories-list-config";
import { loadCategoriesListData } from "../../../../lib/admin/content/load-categories-list";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import CategoriesListClient from "./CategoriesListClient";

export const dynamic = "force-dynamic";

type CategoriesSearchParams = {
  notice?: string;
  error?: string;
};

export default async function TopicCategoriesPage({
  searchParams,
}: {
  searchParams?: Promise<CategoriesSearchParams>;
}) {
  const actor = await requireAdminSession();
  const query = await searchParams;
  const noticeFeedback = resolveAdminNoticeFeedback(
    CATEGORIES_NOTICE_CODE_MAP,
    query?.error ? "error" : query?.notice,
    query?.error ? decodeURIComponent(query.error) : null,
  );

  const [
    categoryResult,
    { data: preference, error: preferenceError },
  ] = await Promise.all([
    loadCategoriesListData()
      .then((data) => ({ data, error: null }))
      .catch((error: unknown) => ({
        data: null,
        error:
          error instanceof Error
            ? error
            : new Error("Unable to load categories."),
      })),
    getSupabaseAdmin()
      .from("admin_user_preferences")
      .select("preferences")
      .eq("admin_user_id", actor.id)
      .eq("view_key", CATEGORIES_LIST_VIEW_KEY)
      .maybeSingle<{ preferences: { visibleColumns?: string[] } }>(),
  ]);
  const error = categoryResult.error;

  if (error) {
    return (
      <main className="space-y-7" dir="rtl">
        <AdminPageContextHeader
          eyebrow="CATEGORIES CONTROL"
          title="إدارة التصنيفات"
          description="من هنا تُدار تصنيفات موضوعات تهمك، مع تنظيم الظهور والربط بالمقالات والسلاسل وتحسين بنية المحتوى من مكان واحد."
        />
        <AdminNotice
          variant="danger"
          title="تعذر تحميل التصنيفات"
          message={error.message}
        />
      </main>
    );
  }

  const rows = categoryResult.data?.rows ?? [];
  const parentOptions = categoryResult.data?.parentOptions ?? [];
  const visibleColumns = Array.isArray(preference?.preferences?.visibleColumns)
    ? preference.preferences.visibleColumns
    : [...CATEGORIES_DEFAULT_COLUMN_KEYS];

  return (
    <main className="space-y-7" dir="rtl">
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

      <CategoriesListClient
        rows={rows}
        parentOptions={parentOptions}
        initialVisibleColumns={visibleColumns}
        initialFeedback={noticeFeedback}
      />
    </main>
  );
}
