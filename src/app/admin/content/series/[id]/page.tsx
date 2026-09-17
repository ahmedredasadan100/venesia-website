import { notFound } from "next/navigation";

import {
  AdminActionButton,
  AdminPageContextHeader,
  AdminPageExperience,
} from "../../../../../components/admin/ui";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { resolveAdminFormReturnPath } from "../../../../../lib/admin/form-runtime";
import {
  loadSeriesEditorFormData,
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ return_to?: string | string[] }>;
}) {
  await requireAdminSession();
  const { id: rawId } = await params;
  if (!/^\d+$/.test(rawId)) notFound();
  const id = Number(rawId);
  const seriesResult = await loadSeriesEditorFormData(id);
  if (seriesResult.status === "error") throw seriesResult.error;
  if (seriesResult.status === "not_found") notFound();

  const { series, categoryOptions } = seriesResult.data;
  const closeHref = resolveAdminFormReturnPath((await searchParams)?.return_to, "/admin/content/series");

  return (
    <AdminPageExperience>
      <AdminPageContextHeader
        eyebrow="SERIES CONTROL"
        title={truncateWords(series.name || "بدون اسم")}
        description="تعديل سلسلة — حدّث بيانات السلسلة مع الحفاظ على Slug الثابت وروابط الموضوعات الحالية."
        actions={
          <>
            <AdminActionButton href={closeHref} variant="dark">
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
        closeHref={closeHref}
      />
    </AdminPageExperience>
  );
}
