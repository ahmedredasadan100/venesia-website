import Link from "next/link";
import { notFound } from "next/navigation";
import AdminNotice from "../../../../../components/admin/AdminNotice";
import { AdminActionButton, AdminPageContextHeader } from "../../../../../components/admin/ui";
import type { MediaTopicPayload } from "../../../../../lib/admin/media-topic-payload";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import MediaContentTypeBadge from "../MediaContentTypeBadge";
import { getContentTypeLabel, isMediaEditableContentType } from "../media-content-config";
import MediaContentForm from "../MediaContentForm";

export const dynamic = "force-dynamic";

function getErrorMessage(error?: string) {
  return error ? decodeURIComponent(error) : null;
}

function getNoticeText(notice?: string) {
  if (notice === "created") return "تم إنشاء المحتوى بنجاح.";
  if (notice === "saved") return "تم حفظ التعديلات بنجاح.";
  return null;
}

export default async function EditMediaContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; notice?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const errorMessage = getErrorMessage(query?.error);
  const notice = getNoticeText(query?.notice);

  if (!/^\d+$/.test(id)) notFound();

  const { data: topic, error } = await getSupabaseAdmin()
    .from("topics")
    .select(
      "id, title, slug, excerpt, content, image, category_slug, content_type, status, is_featured, media_payload",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !topic || !isMediaEditableContentType(topic.content_type)) {
    notFound();
  }

  return (
    <main className="space-y-7">
      <AdminPageContextHeader
        eyebrow="MEDIA CENTER CONTROL"
        title="تعديل محتوى إعلامي"
        contextLine={topic.title || "بدون عنوان"}
        description="عدّل بيانات النشر والمحتوى حسب نوع القسم — الفيديو ومعرض الصور يستخدمان حقولًا مخصصة."
        meta={<MediaContentTypeBadge contentType={topic.content_type} compact />}
        breadcrumb={
          <>
            <Link href="/admin" className="transition hover:text-[#D8B87A]">
              الرئيسية
            </Link>
            <span className="text-white/25">/</span>
            <Link href="/admin/content/media" className="transition hover:text-[#D8B87A]">
              المركز الإعلامي
            </Link>
            <span className="text-white/25">/</span>
            <span className="text-white/72">{getContentTypeLabel(topic.content_type)}</span>
          </>
        }
        actions={
          <>
            <AdminActionButton href="/admin/content/media" variant="dark">
              عرض القائمة
            </AdminActionButton>
            <AdminActionButton href="/admin/content/media/new" variant="dark">
              إضافة محتوى
            </AdminActionButton>
            <AdminActionButton href="/admin/topics/categories" variant="dark">
              إدارة التصنيفات
            </AdminActionButton>
          </>
        }
      />

      {notice ? <AdminNotice variant="success" message={notice} /> : null}
      {errorMessage ? <AdminNotice variant="danger" title="تعذر حفظ المحتوى" message={errorMessage} /> : null}

      <MediaContentForm
        mode="edit"
        values={{
          id: topic.id,
          title: topic.title,
          slug: topic.slug,
          excerpt: topic.excerpt,
          content: topic.content,
          image: topic.image,
          category_slug: topic.category_slug,
          status: topic.status,
          is_featured: topic.is_featured,
          media_payload: (topic.media_payload as MediaTopicPayload | null) ?? null,
        }}
      />
    </main>
  );
}
