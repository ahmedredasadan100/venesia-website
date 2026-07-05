import AdminNotice from "../../../../../components/admin/AdminNotice";
import { AdminActionButton, AdminPageContextHeader } from "../../../../../components/admin/ui";
import MediaContentForm from "../MediaContentForm";

export const dynamic = "force-dynamic";

function getErrorMessage(error?: string) {
  return error ? decodeURIComponent(error) : null;
}

export default async function NewMediaContentPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorMessage = getErrorMessage(params?.error);

  return (
    <main className="space-y-7">
      <AdminPageContextHeader
        eyebrow="UNIFIED MEDIA CONTENT"
        title="إضافة محتوى إعلامي"
        description="أنشئ محتوى جديدًا داخل topics للأقسام: الأخبار، البيانات الصحفية، من أرض التنفيذ. لا يؤثر هذا على الواجهة العامة أو media_items."
        actions={
          <>
            <AdminActionButton href="/admin/content/media" variant="dark">
              عرض القائمة
            </AdminActionButton>
            <AdminActionButton href="/admin/topics" variant="dark">
              عرض المقالات
            </AdminActionButton>
          </>
        }
      />

      {errorMessage ? <AdminNotice variant="danger" title="تعذر إنشاء المحتوى" message={errorMessage} /> : null}

      <MediaContentForm mode="create" />
    </main>
  );
}
