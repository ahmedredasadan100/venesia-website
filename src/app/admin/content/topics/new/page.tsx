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
} from "../../../../../lib/admin/content/category-hierarchy";
import {
  isContentType,
  isMediaEditableContentType,
} from "../../../../../lib/admin/content/content-types";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { loadTopicTaxonomyFormDependencies } from "../../../../../lib/admin/content/load-taxonomy-form-data";
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

  const taxonomyResult = await loadTopicTaxonomyFormDependencies();
  if (taxonomyResult.status === "error") throw taxonomyResult.error;
  const { categories, series } = taxonomyResult.data;
  const errorMessage = query?.error ? decodeURIComponent(query.error) : null;

  if (contentType === "article") {
    return (
      <ArticleCreateEditor
        categories={categories}
        series={series}
        errorMessage={errorMessage}
      />
    );
  }

  if (!isMediaEditableContentType(contentType)) return null;
  const flattenedCategories = flattenAdminCategoryTree(
    buildAdminCategoryTree(categories),
  );

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
      <MediaContentForm
        mode="create"
        contentType={contentType}
        categories={flattenedCategories}
        series={series}
        errorMessage={errorMessage}
      />
    </AdminPageExperience>
  );
}
