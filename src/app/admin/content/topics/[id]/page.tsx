import { notFound } from "next/navigation";
import AdminNotice from "../../../../../components/admin/AdminNotice";
import ArticleEditor from "../../../../../components/admin/content/editors/ArticleEditor";
import {
  AdminActionButton,
  AdminEntityPreviewActions,
  AdminPageContextHeader,
  AdminPageExperience,
} from "../../../../../components/admin/ui";
import {
  buildAdminCategoryTree,
  flattenAdminCategoryTree,
} from "../../../../../lib/admin/content/category-hierarchy";
import {
  invalidTopicFormRecord,
  loadTopicFormRecord,
  loadTopicTaxonomyFormDependencies,
} from "../../../../../lib/admin/content/load-taxonomy-form-data";
import {
  getContentTypeLabel,
  isContentType,
  isMediaEditableContentType,
  resolveContentEditor,
} from "../../../../../lib/admin/content/content-types";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import MediaContentForm from "../../../../../components/admin/content/editors/media/MediaContentForm";
import { parseMediaTopicPayload } from "../../../../../lib/admin/media-topic-payload";
import {
  ADMIN_CONTENT_ROUTES,
  isAdminContentReturnPath,
} from "../../../../../lib/admin/content-routes";
import { buildAdminContentPreviewCapability } from "../../../../../lib/admin/content/entity-preview-capabilities";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    notice?: string;
    error?: string;
    return_to?: string;
  }>;
};

export default async function UnifiedContentEditorPage(props: PageProps) {
  await requireAdminSession();
  const { id } = await props.params;
  const query = await props.searchParams;
  const returnPath =
    query?.return_to && isAdminContentReturnPath(query.return_to)
      ? query.return_to
      : ADMIN_CONTENT_ROUTES.topics;
  if (!/^\d+$/.test(id)) notFound();
  const topicId = Number(id);
  if (!Number.isSafeInteger(topicId) || topicId <= 0) notFound();

  const topicResult = await loadTopicFormRecord(topicId);
  if (topicResult.status === "error") throw topicResult.error;
  if (topicResult.status === "not_found") notFound();

  const topic = topicResult.data;
  const contentType = topic.content_type;
  if (!isContentType(contentType)) throw invalidTopicFormRecord().error;
  const editorKind = resolveContentEditor(contentType);
  if (!editorKind) throw invalidTopicFormRecord().error;

  const taxonomyResult = await loadTopicTaxonomyFormDependencies({
    currentCategoryId: topic.category_id,
    currentSeriesId: topic.series_id,
  });
  if (taxonomyResult.status === "error") throw taxonomyResult.error;
  const {
    categories: selectableCategories,
    series: selectableSeries,
  } = taxonomyResult.data;
  const errorMessage = query?.error ? decodeURIComponent(query.error) : null;

  if (editorKind === "article") {
    return (
      <ArticleEditor
        topic={topic}
        categories={selectableCategories}
        series={selectableSeries}
        errorMessage={errorMessage}
        returnPath={returnPath}
      />
    );
  }

  if (!isMediaEditableContentType(contentType)) {
    throw invalidTopicFormRecord().error;
  }
  const flattenedCategories = flattenAdminCategoryTree(
    buildAdminCategoryTree(selectableCategories),
  );

  return (
    <AdminPageExperience dir="rtl">
      <AdminPageContextHeader
        eyebrow="UNIFIED CONTENT ENGINE"
        title="تعديل موضوع"
        description={`${topic.title || "بدون عنوان"} — المحرر الحالي: ${getContentTypeLabel(contentType)}. اختيار المحرر يعتمد على content_type فقط.`}
        actions={
          <>
            <AdminActionButton href={returnPath} variant="dark">عرض الموضوعات</AdminActionButton>
            <AdminActionButton href="/admin/content/topics/new" variant="dark">إضافة محتوى</AdminActionButton>
            <AdminActionButton href="/admin/content/categories" variant="dark">إدارة التصنيفات</AdminActionButton>
            <AdminEntityPreviewActions
              capability={buildAdminContentPreviewCapability({
                entityType: "topic",
                id: topic.id,
                contentType,
                slug: topic.slug,
                publicationStatus: topic.status,
                allowedActions: ["internal-preview"],
              })}
            />
          </>
        }
      />
      {query?.notice === "saved_with_media_sync_warning" ? (
        <AdminNotice
          variant="warning"
          title="تم حفظ المحتوى مع تنبيه للميديا"
          message="تم حفظ البيانات، لكن تعذرت مزامنة ارتباطات الميديا. يظل الحذف الآمن متوقفًا حتى اكتمال الإصلاح أو الفحص."
        />
      ) : query?.notice ? (
        <AdminNotice variant="success" message="تم حفظ التغييرات بنجاح." />
      ) : null}
      {errorMessage ? <AdminNotice variant="danger" title="تعذر حفظ المحتوى" message={errorMessage} /> : null}
      <MediaContentForm
        mode="edit"
        contentType={contentType}
        categories={flattenedCategories}
        series={selectableSeries}
        returnPath={returnPath}
        errorMessage={errorMessage}
        values={{
          id: topic.id,
          title: topic.title,
          slug: topic.slug,
          excerpt: topic.excerpt,
          content: topic.content,
          image: topic.image,
          image_alt: topic.image_alt,
          category_id: topic.category_id,
          category_slug: topic.category_slug,
          series_id: topic.series_id,
          series: topic.series,
          series_slug: topic.series_slug,
          status: topic.status,
          is_featured: topic.is_featured,
          is_popular: topic.is_popular,
          published_at: topic.published_at,
          date_label: topic.date_label,
          updated_at: topic.updated_at,
          show_title_on_page: topic.show_title_on_page,
          show_image_on_page: topic.show_image_on_page,
          show_excerpt_on_page: topic.show_excerpt_on_page,
          show_date_on_page: topic.show_date_on_page,
          show_category_on_page: topic.show_category_on_page,
          show_series_on_page: topic.show_series_on_page,
          show_intro_card_on_page: topic.show_intro_card_on_page,
          media_payload: parseMediaTopicPayload(topic.media_payload),
          media_project: topic.media_project,
          seo_title: topic.seo_title,
          seo_description: topic.seo_description,
          seo_keywords: Array.isArray(topic.seo_keywords) ? topic.seo_keywords : [],
          focus_keyword: topic.focus_keyword,
          canonical_url: topic.canonical_url,
          robots_index: topic.robots_index,
          robots_follow: topic.robots_follow,
          og_image: topic.og_image,
          og_image_alt: topic.og_image_alt,
        }}
      />
    </AdminPageExperience>
  );
}
