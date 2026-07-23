"use server";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import {
  SERIES_DEFAULT_COLUMN_KEYS,
  SERIES_LIST_VIEW_KEY,
  SERIES_PREFERENCE_COLUMN_KEYS,
} from "../../../../lib/admin/content/series-list-config";
import { saveAdminColumnPreferences } from "../../../../lib/admin/preferences/admin-column-preferences";

import { revalidatePath } from "next/cache";
import { revalidateTopicsCache } from "../../../../lib/cache/revalidate-public-cache-tags";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

type SeriesStatus = "draft" | "published" | "unpublished" | "archived";

function validateId(id: string) {
  return /^\d+$/.test(id);
}

function revalidateSeriesPaths() {
  revalidateTopicsCache();
  revalidatePath("/admin/content/series");
  revalidatePath("/admin/content/topics");
  revalidatePath("/admin/content/topics/new");
}

async function ensureUniqueSlug(slug: string, id?: string) {
  let query = getSupabaseAdmin().from("topic_series").select("id").eq("slug", slug).limit(1);

  if (id) query = query.neq("id", id);

  const { data, error } = await query.maybeSingle<{ id: number }>();
  if (error) return false;
  return !data;
}

export type SeriesTableResult = {
  ok: boolean;
  message?: string;
  affectedIds?: number[];
};

function successWithAffectedIds(
  message: string,
  affectedIds: number[],
): SeriesTableResult {
  revalidateSeriesPaths();
  return { ok: true, message, affectedIds };
}

function failure(message: string): SeriesTableResult {
  return { ok: false, message };
}

export async function toggleSeriesStatusAjax(id: number, currentStatus: string | null): Promise<SeriesTableResult> {
  await requireAdminSession();
  if (!validateId(String(id))) return failure("السلسلة غير صالحة.");

  const nextStatus: SeriesStatus = currentStatus === "published" ? "unpublished" : "published";
  const now = new Date().toISOString();

  const { error } = await getSupabaseAdmin()
    .from("topic_series")
    .update({ status: nextStatus, deleted_at: null, updated_at: now })
    .eq("id", id);

  if (error) return failure(error.message);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic_series", nextStatus === "published" ? "publish" : "unpublish"),
    entityType: "topic_series",
    entityId: id,
    metadata: { status: nextStatus },
  });
  return successWithAffectedIds(
    nextStatus === "published"
      ? "تم إظهار السلسلة بنجاح."
      : "تم إخفاء السلسلة بنجاح.",
    [id],
  );
}

export async function duplicateSeriesAjax(id: number): Promise<SeriesTableResult> {
  await requireAdminSession();
  if (!validateId(String(id))) return failure("السلسلة غير صالحة.");

  const { data, error } = await getSupabaseAdmin()
    .from("topic_series")
    .select("name, slug, status, sort_order, category_id")
    .eq("id", id)
    .maybeSingle<{ name: string; slug: string; status: string | null; sort_order: number | null; category_id: number | null }>();

  if (error) return failure(error.message);
  if (!data) return failure("السلسلة غير موجودة.");
  if (!data.category_id) return failure("لا يمكن نسخ سلسلة بدون تصنيف. عيّن تصنيفًا للسلسلة أولًا.");

  let slug = `${data.slug}-copy`;
  let counter = 2;
  while (!(await ensureUniqueSlug(slug))) {
    slug = `${data.slug}-copy-${counter}`;
    counter += 1;
  }

  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await getSupabaseAdmin()
    .from("topic_series")
    .insert({
      name: `${data.name} - نسخة`,
      slug,
      status: "draft",
      sort_order: data.sort_order ?? 0,
      category_id: data.category_id,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single<{ id: number }>();

  if (insertError || !inserted) {
    return failure(insertError?.message ?? "تعذر نسخ السلسلة.");
  }
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic_series", "duplicate"),
    entityType: "topic_series",
    entityLabel: `${data.name} - نسخة`,
    metadata: { slug, source_series_id: id },
  });
  return successWithAffectedIds("تم نسخ السلسلة بنجاح.", [inserted.id]);
}

export async function deleteSeriesAjax(id: number): Promise<SeriesTableResult> {
  await requireAdminSession();
  if (!validateId(String(id))) return failure("السلسلة غير صالحة.");

  const { count, error: countError } = await getSupabaseAdmin()
    .from("topics")
    .select("id", { count: "exact", head: true })
    .eq("series_id", id);

  if (countError) return failure(countError.message);
  if ((count ?? 0) > 0) return failure("لا يمكن حذف سلسلة مرتبطة بموضوعات. أخفها أو انقل الموضوعات أولًا.");

  const { error } = await getSupabaseAdmin().from("topic_series").delete().eq("id", id);
  if (error) return failure(error.message);

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic_series", "delete"),
    entityType: "topic_series",
    entityId: id,
  });
  return successWithAffectedIds("تم حذف السلسلة بنجاح.", [id]);
}

export async function bulkSeriesActionAjax(action: string, ids: number[]): Promise<SeriesTableResult> {
  await requireAdminSession();
  const validIds = ids.filter((id) => validateId(String(id))).map(String);
  if (!validIds.length) return failure("حدد سلسلة واحدة على الأقل.");

  const now = new Date().toISOString();

  if (action === "publish" || action === "hide") {
    const status = action === "publish" ? "published" : "unpublished";
    const { error } = await getSupabaseAdmin()
      .from("topic_series")
      .update({ status, deleted_at: null, updated_at: now })
      .in("id", validIds);

    if (error) return failure(error.message);
    await recordCmsAdminAudit({
      action: buildCmsAuditAction("topic_series", status === "published" ? "publish" : "unpublish"),
      entityType: "topic_series",
      metadata: { bulk_action: action, ids: validIds.map(Number) },
    });
    return successWithAffectedIds(
      status === "published"
        ? "تم إظهار السلاسل المحددة بنجاح."
        : "تم إخفاء السلاسل المحددة بنجاح.",
      validIds.map(Number),
    );
  }

  if (action === "delete") {
    const { data: linked, error: linkedError } = await getSupabaseAdmin()
      .from("topics")
      .select("series_id")
      .in("series_id", validIds);

    if (linkedError) return failure(linkedError.message);
    if ((linked ?? []).length > 0) return failure("لا يمكن حذف سلاسل مرتبطة بموضوعات. انقل الموضوعات أولًا.");

    const { error } = await getSupabaseAdmin().from("topic_series").delete().in("id", validIds);
    if (error) return failure(error.message);

    await recordCmsAdminAudit({
      action: buildCmsAuditAction("topic_series", "delete"),
      entityType: "topic_series",
      metadata: { bulk_action: action, ids: validIds.map(Number) },
    });
    return successWithAffectedIds(
      "تم حذف السلاسل المحددة بنجاح.",
      validIds.map(Number),
    );
  }

  return failure("عملية غير معروفة.");
}

export async function saveSeriesTablePreferences(visibleColumns: string[]) {
  return saveAdminColumnPreferences({
    viewKey: SERIES_LIST_VIEW_KEY,
    visibleColumns,
    allowedColumns: SERIES_PREFERENCE_COLUMN_KEYS,
  });
}

export async function restoreSeriesTablePreferences() {
  return saveSeriesTablePreferences([...SERIES_DEFAULT_COLUMN_KEYS]);
}
