import { notFound } from "next/navigation";

import {
  AdminActionButton,
  AdminPageContextHeader,
  AdminPageExperience,
} from "../../../../../components/admin/ui";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import {
  loadCategoryFormRecord,
  loadCategoryParentFormOptions,
} from "../../../../../lib/admin/content/load-taxonomy-form-data";
import CategoryForm from "../CategoryForm";

export const dynamic = "force-dynamic";

function truncateWords(value: string, limit = 4) {
  const words = value.trim().split(/\s+/);
  return words.length <= limit
    ? value
    : `${words.slice(0, limit).join(" ")}...`;
}

export default async function EditTopicCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSession();
  const { id: rawId } = await params;
  if (!/^\d+$/.test(rawId)) notFound();
  const id = Number(rawId);

  const [category, parentOptions] = await Promise.all([
    loadCategoryFormRecord(id),
    loadCategoryParentFormOptions(id),
  ]);

  return (
    <AdminPageExperience>
      <AdminPageContextHeader
        eyebrow="CATEGORIES CONTROL"
        title={truncateWords(category.name || "بدون اسم")}
        description="تعديل تصنيف — حدّث بيانات التصنيف مع الحفاظ على Slug الثابت وروابط المحتوى الحالية."
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

      <CategoryForm
        key={category.id}
        mode="edit"
        category={category}
        parentOptions={parentOptions}
      />
    </AdminPageExperience>
  );
}
