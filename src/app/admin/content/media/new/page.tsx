import Link from "next/link";
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
        eyebrow="MEDIA CENTER CONTROL"
        title="إضافة محتوى إعلامي"
        contextLine="إنشاء عنصر جديد"
        description="اختر قسم المركز الإعلامي أولًا — النموذج يتكيّف تلقائيًا بين المحتوى النصي والفيديو ومعرض الصور."
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
            <span className="text-white/72">إضافة جديد</span>
          </>
        }
        actions={
          <>
            <AdminActionButton href="/admin/content/media" variant="dark">
              عرض القائمة
            </AdminActionButton>
            <AdminActionButton href="/admin/topics/categories" variant="dark">
              إدارة التصنيفات
            </AdminActionButton>
          </>
        }
      />

      {errorMessage ? <AdminNotice variant="danger" title="تعذر إنشاء المحتوى" message={errorMessage} /> : null}

      <MediaContentForm mode="create" />
    </main>
  );
}
