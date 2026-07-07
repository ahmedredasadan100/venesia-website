import { AdminPageContextHeader } from "../../../components/admin/ui";
import AdminMediaLibraryClient from "../../../components/admin/media-intelligence/AdminMediaLibraryClient";

export const dynamic = "force-dynamic";

export default function AdminMediaLibraryPage() {
  return (
    <main className="space-y-7">
      <AdminPageContextHeader
        eyebrow="MEDIA INTELLIGENCE"
        title="مكتبة الوسائط"
        description="تصفح الأصول الحالية، انسخ الروابط، وافحص أين تُستخدم — بدون جداول جديدة أو قطع عام على المركز الإعلامي."
      />

      <AdminMediaLibraryClient />
    </main>
  );
}
