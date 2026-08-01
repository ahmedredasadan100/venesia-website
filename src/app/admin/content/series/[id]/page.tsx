import { notFound } from "next/navigation";

import {
  AdminActionButton,
  AdminPageContextHeader,
  AdminPageExperience,
} from "../../../../../components/admin/ui";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import {
  loadSeriesCategoryFormOptions,
  loadSeriesFormRecord,
} from "../../../../../lib/admin/content/load-taxonomy-form-data";
import SeriesForm from "../SeriesForm";

export const dynamic = "force-dynamic";

function truncateWords(value: string, limit = 4) {
  const words = value.trim().split(/\s+/);
  return words.length <= limit
    ? value
    : `${words.slice(0, limit).join(" ")}...`;
}

export default async function EditSeriesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSession();
  const { id: rawId } = await params;
  if (!/^\d+$/.test(rawId)) notFound();
  const id = Number(rawId);
  const series = await loadSeriesFormRecord(id);
  const categoryOptions = await loadSeriesCategoryFormOptions(
    series.category_id,
  );

  return (
    <AdminPageExperience>
      <AdminPageContextHeader
        eyebrow="SERIES CONTROL"
        title={truncateWords(series.name || "بدون اسم")}
        description="تعديل سلسلة — حدّث بيانات السلسلة مع الحفاظ على Slug الثابت وروابط الموضوعات الحالية."
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

      <SeriesForm
        key={series.id}
        mode="edit"
        series={series}
        categoryOptions={categoryOptions}
      />
    </AdminPageExperience>
  );
}
