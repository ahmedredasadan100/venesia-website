import { AdminPageContextHeader } from "../../../components/admin/ui";
import AdminMediaLibraryClient from "../../../components/admin/media-intelligence/AdminMediaLibraryClient";

export const dynamic = "force-dynamic";

export default function AdminMediaLibraryPage() {
  return (
    <main className="space-y-7">
      <AdminPageContextHeader
        eyebrow="MEDIA CAPABILITY"
        title="مكتبة الوسائط"
        description="إدارة الأصول والمجلدات والمراجع من كتالوج واحد، مع حذف يفشل مغلقًا واستبدال لا يكتب فوق مسار قائم."
      />

      <AdminMediaLibraryClient />
    </main>
  );
}
