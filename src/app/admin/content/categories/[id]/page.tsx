import { notFound } from "next/navigation";

import {
  AdminActionButton,
  AdminPageContextHeader,
  AdminPageExperience,
} from "../../../../../components/admin/ui";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { resolveAdminFormReturnPath } from "../../../../../lib/admin/form-runtime";
import {
  loadCategoryEditorFormData,
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ return_to?: string | string[] }>;
}) {
  await requireAdminSession();
  const { id: rawId } = await params;
  if (!/^\d+$/.test(rawId)) notFound();
  const id = Number(rawId);

  const categoryResult = await loadCategoryEditorFormData(id);
  if (categoryResult.status === "error") throw categoryResult.error;
  if (categoryResult.status === "not_found") notFound();

  const { category, parentOptions } = categoryResult.data;
  const closeHref = resolveAdminFormReturnPath((await searchParams)?.return_to, "/admin/content/categories");

  return (
    <AdminPageExperience>
      <AdminPageContextHeader
        eyebrow="CATEGORIES CONTROL"
        title={truncateWords(category.name || "بدون اسم")}
        description="تعديل تصنيف — حدّث بيانات التصنيف مع الحفاظ على Slug الثابت وروابط المحتوى الحالية."
        actions={
          <>
            <AdminActionButton href={closeHref} variant="dark">
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
        closeHref={closeHref}
      />
    </AdminPageExperience>
  );
}
