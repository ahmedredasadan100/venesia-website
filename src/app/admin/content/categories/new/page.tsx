import {
  AdminActionButton,
  AdminPageContextHeader,
  AdminPageExperience,
} from "../../../../../components/admin/ui";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { loadCategoryParentFormOptions } from "../../../../../lib/admin/content/load-taxonomy-form-data";
import CategoryForm from "../CategoryForm";

export const dynamic = "force-dynamic";

export default async function NewTopicCategoryPage() {
  await requireAdminSession();
  const parentOptions = await loadCategoryParentFormOptions();

  return (
    <AdminPageExperience>
      <AdminPageContextHeader
        eyebrow="CATEGORIES CONTROL"
        title="إضافة تصنيف جديد"
        description="أنشئ تصنيفًا جديدًا داخل نظام المحتوى، وحدد علاقته وحالة نشره قبل الحفظ والإغلاق."
        actions={
          <>
            <AdminActionButton href="/admin/content/categories" variant="dark">
              عرض التصنيفات
            </AdminActionButton>
            <AdminActionButton href="/admin/content/topics" variant="dark">
              عرض الموضوعات
            </AdminActionButton>
            <AdminActionButton href="/admin/content/series" variant="dark">
              عرض السلاسل
            </AdminActionButton>
          </>
        }
      />

      <CategoryForm mode="create" parentOptions={parentOptions} />
    </AdminPageExperience>
  );
}
