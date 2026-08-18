import AdminNotice from "../../AdminNotice";
import { AdminEntityListPageLayout } from "../../entity-list";
import { AdminActionButton, AdminPageContextHeader } from "../../ui";

export default function TrackingSchemaUnavailable({
  projectId,
  message,
}: {
  projectId: number;
  message: string;
}) {
  return (
    <AdminEntityListPageLayout dir="rtl">
      <AdminPageContextHeader
        eyebrow="PROJECT TRACKING DOMAIN"
        title="تعذر فتح متابعة المشروع"
        description="يتطلب هذا السطح تطبيق Migration نطاق Construction Tracking أولًا."
        actions={
          <AdminActionButton
            href={`/admin/projects/${projectId}`}
            variant="dark"
          >
            العودة إلى المشروع
          </AdminActionButton>
        }
      />
      <AdminNotice
        variant="warning"
        title="Tracking schema غير متاح"
        message={message}
      />
    </AdminEntityListPageLayout>
  );
}
