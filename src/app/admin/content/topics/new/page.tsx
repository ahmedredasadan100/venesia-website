import AdminNotice from "../../../../../components/admin/AdminNotice";
import ArticleCreateEditor from "../../../../../components/admin/content/editors/ArticleCreateEditor";
import {
  AdminActionButton,
  AdminPageContextHeader,
  AdminPageExperience,
} from "../../../../../components/admin/ui";
import {
  buildAdminCategoryTree,
  flattenAdminCategoryTree,
  type AdminContentCategory,
} from "../../../../../lib/admin/content/category-hierarchy";
import {
  isContentType,
  isMediaEditableContentType,
} from "../../../../../lib/admin/content/content-types";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import MediaContentForm from "../../../../../components/admin/content/editors/media/MediaContentForm";

export const dynamic = "force-dynamic";

type SearchParams = { type?: string; error?: string };

export default async function NewUnifiedContentPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireAdminSession();
  const query = await searchParams;
  const contentType = isContentType(query?.type) ? query.type : "article";

  const supabase = getSupabaseAdmin();
  const [{ data: categoryRows, error: categoriesError }, { data: seriesRows, error: seriesError }] =
    await Promise.all([
      supabase
        .from("topic_categories")
        .select("id,name,slug,parent_id,sort_order,is_active,status,color_token")
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("topic_series")
        .select("id,name,slug,status,deleted_at,category_id")
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
    ]);
  const categories = flattenAdminCategoryTree(
    buildAdminCategoryTree(
      ((categoryRows ?? []) as AdminContentCategory[]).filter(
        (category) => category.status === "published",
      ),
    ),
  );
  const series = (seriesRows ?? []) as Array<{
    id: number;
    name: string;
    slug: string;
    status: string;
    deleted_at: string | null;
    category_id: number | null;
  }>;
  const errorMessage = query?.error ? decodeURIComponent(query.error) : null;
  const loadError = categoriesError?.message ?? seriesError?.message;

  if (contentType === "article") {
    return (
      <ArticleCreateEditor
        categories={categories.filter((category) => category.status === "published")}
        series={series.filter((item) => item.status === "published" && !item.deleted_at)}
        errorMessage={errorMessage ?? loadError}
      />
    );
  }

  if (!isMediaEditableContentType(contentType)) return null;

  return (
    <AdminPageExperience dir="rtl">
      <AdminPageContextHeader
        eyebrow="UNIFIED CONTENT ENGINE"
        title={`إضافة ${contentType}`}
        description="التصنيف والسلسلة مستقلان عن نوع المحتوى ويُحمّلان مباشرة من قاعدة البيانات."
        actions={
          <>
            <AdminActionButton href="/admin/content/topics/new" variant="dark">تغيير النوع</AdminActionButton>
            <AdminActionButton href="/admin/content/topics" variant="dark">عرض الموضوعات</AdminActionButton>
            <AdminActionButton href="/admin/content/categories" variant="dark">إدارة التصنيفات</AdminActionButton>
          </>
        }
      />
      {errorMessage ? <AdminNotice variant="danger" title="تعذر إنشاء المحتوى" message={errorMessage} /> : null}
      {loadError ? <AdminNotice variant="danger" title="تعذر تحميل التصنيفات أو السلاسل" message={loadError} /> : null}
      {!loadError ? (
        <MediaContentForm
          mode="create"
          contentType={contentType}
          categories={categories}
          series={series}
          errorMessage={errorMessage}
        />
      ) : null}
    </AdminPageExperience>
  );
}
