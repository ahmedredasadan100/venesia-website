import Link from "next/link";
import { AdminActionButton } from "../../../../components/admin/ui";
import { PlusIcon } from "../../../../components/admin/AdminRowActions";

export default function MediaListEmptyState({ filtersActive }: { filtersActive: boolean }) {
  if (filtersActive) {
    return (
      <div className="space-y-4 px-6 py-14 text-center">
        <p className="text-base font-semibold text-white/72">لا توجد نتائج مطابقة للفلاتر الحالية</p>
        <p className="mx-auto max-w-xl text-sm leading-7 text-white/42">
          جرّب تغيير نوع المحتوى أو الحالة، أو امسح الفلاتر لعرض كل عناصر المركز الإعلامي.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <AdminActionButton href="/admin/content/media" variant="dark">
            مسح الفلاتر
          </AdminActionButton>
          <AdminActionButton href="/admin/content/media/new" variant="primary">
            <PlusIcon />
            إضافة محتوى جديد
          </AdminActionButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-6 py-14 text-center">
      <p className="text-base font-semibold text-white/72">لا يوجد محتوى إعلامي بعد</p>
      <p className="mx-auto max-w-xl text-sm leading-7 text-white/42">
        ابدأ بإنشاء أول عنصر في أحد الأقسام: الأخبار، البيانات الصحفية، من أرض التنفيذ، الفيديو، أو معرض
        الصور.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <AdminActionButton href="/admin/content/media/new" variant="primary">
          <PlusIcon />
          إضافة محتوى جديد
        </AdminActionButton>
        <Link
          href="/admin/topics/categories"
          className="rounded-full border border-white/12 px-5 py-3 text-sm font-medium text-white/62 transition hover:border-[#D8B87A]/30 hover:text-[#D8B87A]"
        >
          إدارة التصنيفات
        </Link>
      </div>
    </div>
  );
}
