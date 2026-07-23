import {
  AdminActionButton,
  AdminPageContextHeader,
  AdminPageExperience,
} from "../../../../../components/admin/ui";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { loadSeriesCategoryFormOptions } from "../../../../../lib/admin/content/load-taxonomy-form-data";
import SeriesForm from "../SeriesForm";

export const dynamic = "force-dynamic";

export default async function NewSeriesPage() {
  await requireAdminSession();
  const categoryOptions = await loadSeriesCategoryFormOptions();

  return (
    <AdminPageExperience>
      <AdminPageContextHeader
        eyebrow="SERIES CONTROL"
        title="إضافة سلسلة جديدة"
        description="أنشئ سلسلة مرتبطة بتصنيف واضح لتصبح متاحة داخل نظام الموضوعات."
        actions={
          <>
            <AdminActionButton href="/admin/content/series" variant="dark">
              عرض السلاسل
            </AdminActionButton>
            <AdminActionButton href="/admin/content/categories" variant="dark">
              عرض التصنيفات
            </AdminActionButton>
            <AdminActionButton href="/admin/content/topics" variant="dark">
              عرض الموضوعات
            </AdminActionButton>
          </>
        }
      />

      <SeriesForm mode="create" categoryOptions={categoryOptions} />
    </AdminPageExperience>
  );
}
