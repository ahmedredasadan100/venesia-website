import { loadGlobalSeoSettings } from "../../../../../lib/seo/load-global-seo-settings";
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
  getContentTypeLabel,
  isContentType,
  isMediaEditableContentType,
} from "../../../../../lib/admin/content/content-types";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { resolveTopicDraftSession } from "../../../../../lib/admin/content/topic-draft-session";
import { loadTopicTaxonomyFormDependencies } from "../../../../../lib/admin/content/load-taxonomy-form-data";
import MediaContentForm from "../../../../../components/admin/content/editors/media/MediaContentForm";

export const dynamic = "force-dynamic";

type SearchParams = { type?: string; error?: string };

export default async function NewUnifiedContentPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const actor = await requireAdminSession();
  const draftSession = await resolveTopicDraftSession(actor);
  const seoSettings = await loadGlobalSeoSettings();
  const query = await searchParams;
  const contentType = isContentType(query?.type) ? query.type : "article";

  const taxonomyResult = await loadTopicTaxonomyFormDependencies();
  if (taxonomyResult.status === "error") throw taxonomyResult.error;
  const { categories, series } = taxonomyResult.data;
  const errorMessage = query?.error ? decodeURIComponent(query.error) : null;

  if (contentType === "article") {
    return (
      <ArticleCreateEditor seoSettings={seoSettings}
        draftSession={draftSession}
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
        visualPreset="topics"
        eyebrow="UNIFIED CONTENT ENGINE"
        title={`إضافة ${getContentTypeLabel(contentType)}`}
        description="التصنيف والسلسلة مستقلان عن نوع المحتوى ويُحمّلان مباشرة من قاعدة البيانات."
        actions={
          <>
            <AdminActionButton href="/admin/content/topics/new" variant="dark">تغيير النوع</AdminActionButton>
            <AdminActionButton href="/admin/content/topics" variant="dark">عرض الموضوعات</AdminActionButton>
            <AdminActionButton href="/admin/content/categories" variant="dark">إدارة التصنيفات</AdminActionButton>
          </>
        }
      />
      <MediaContentForm seoSettings={seoSettings}
        draftSession={draftSession}
        mode="create"
        contentType={contentType}
        categories={flattenedCategories}
        series={series}
        errorMessage={errorMessage}
      />
    </AdminPageExperience>
  );
}
