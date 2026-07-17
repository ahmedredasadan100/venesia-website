import { formatAdminDateTime } from "../../../lib/content-dates";
import AdminActivityPopover from "../ui/AdminActivityPopover";

type ActivityProps = {
  publishedBy?: string | null;
  publishedAt?: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
  viewsCount?: number | null;
};

export default function AdminContentActivityPopover({
  publishedBy,
  publishedAt,
  updatedBy,
  updatedAt,
  viewsCount,
}: ActivityProps) {
  return (
    <AdminActivityPopover
      title="معلومات النشاط"
      triggerLabel="معلومات النشاط"
      dialogLabel="معلومات نشاط المحتوى"
      items={[
        {
          label: "تم النشر بواسطة:",
          value: publishedAt ? publishedBy || "غير مسجل" : "لم يُنشر بعد",
        },
        {
          label: "تاريخ النشر:",
          value: formatAdminDateTime(publishedAt),
        },
        {
          label: "تم آخر تعديل بواسطة:",
          value: updatedBy || "غير مسجل",
        },
        {
          label: "آخر تعديل:",
          value: formatAdminDateTime(updatedAt),
        },
        {
          label: "عدد المشاهدات:",
          value: `${new Intl.NumberFormat("ar-EG").format(viewsCount ?? 0)} مشاهدة`,
        },
      ]}
    />
  );
}
