import { AdminPageContextHeader } from "../../../components/admin/ui";
import AdminMediaLibraryClient from "../../../components/admin/media-intelligence/AdminMediaLibraryClient";

export const dynamic = "force-dynamic";

export default function AdminMediaLibraryPage() {
  return (
    <main className="space-y-7">
      <AdminPageContextHeader
        eyebrow="إدارة الملفات"
        title="مكتبة الوسائط"
        description="استعرض الملفات ونظّمها واعرف مواضع استخدامها من مكان واحد."
      />

      <AdminMediaLibraryClient />
    </main>
  );
}
