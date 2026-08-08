"use server";

import { revalidatePath } from "next/cache";

import {
  adminActionFailure,
  adminActionSuccess,
  type AdminActionResult,
} from "../../../../lib/admin/admin-action-result";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import {
  SERIES_DEFAULT_COLUMN_KEYS,
  SERIES_LIST_VIEW_KEY,
  SERIES_PREFERENCE_COLUMN_KEYS,
} from "../../../../lib/admin/content/series-list-config";
import {
  moveTopicSeriesToTrashAtomically,
  permanentlyDeleteTopicSeriesAtomically,
  restoreTopicSeriesAtomically,
  TaxonomyMutationDatabaseError,
} from "../../../../lib/admin/content/taxonomy-mutations";
import { saveAdminColumnPreferences } from "../../../../lib/admin/preferences/admin-column-preferences";
import { revalidateTopicsCache } from "../../../../lib/cache/revalidate-public-cache-tags";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

type SeriesStatus = "published" | "unpublished";
type SeriesLifecycleOperation =
  | "move_to_trash"
  | "restore"
  | "permanent_delete";
type SeriesLifecycleScope = "single" | "selected" | "empty_trash";
type SeriesLifecycleRow = {
  id: number;
  name: string;
  slug: string;
  deleted_at: string | null;
};

function revalidateSeriesPaths() {
  revalidateTopicsCache();
  revalidatePath("/admin/content/series");
  revalidatePath("/admin/content/series/new");
  revalidatePath("/admin/content/categories");
  revalidatePath("/admin/content/topics");
  revalidatePath("/admin/content/topics/new");
  revalidatePath("/topics");
}

function uniquePositiveIds(ids: number[]) {
  return [...new Set(ids)].filter(
    (id) => Number.isInteger(id) && id > 0,
  );
}

async function ensureUniqueSlug(slug: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("topic_series")
    .select("id")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle<{ id: number }>();
  if (error) return false;
  return !data;
}

async function loadSeriesLifecycleRows(
  ids: number[],
  view: "active" | "trash",
) {
  let query = getSupabaseAdmin()
    .from("topic_series")
    .select("id,name,slug,deleted_at")
    .in("id", ids);
  query =
    view === "trash"
      ? query.not("deleted_at", "is", null)
      : query.is("deleted_at", null);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as SeriesLifecycleRow[];
}

async function loadAllDeletedSeries() {
  const { data, error } = await getSupabaseAdmin()
    .from("topic_series")
    .select("id,name,slug,deleted_at")
    .not("deleted_at", "is", null)
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SeriesLifecycleRow[];
}

function seriesLifecycleFailure(error: unknown, entityId?: number) {
  const message =
    error instanceof TaxonomyMutationDatabaseError
      ? error.message
      : error instanceof Error
        ? error.message
        : "taxonomy lifecycle mutation failed";
  if (message === "series still have linked topics") {
    return adminActionFailure(
      "تعذر حذف السلسلة",
      "لا يمكن حذف السلسلة لأنها مرتبطة بموضوعات. انقل الموضوعات أو أزل ارتباطها أولًا.",
      { entityId },
    );
  }
  if (message === "series restore slug conflict") {
    return adminActionFailure(
      "تعذر استعادة السلسلة",
      "لا يمكن الاستعادة لأن الـSlug مستخدم في سلسلة نشطة أخرى.",
      { code: "slug_conflict", entityId },
    );
  }
  if (message === "series restore category is unavailable") {
    return adminActionFailure(
      "تعذر استعادة السلسلة",
      "التصنيف المرتبط غير موجود أو داخل المحذوفات. استعد التصنيف أولًا.",
      { entityId },
    );
  }
  if (
    message === "one or more series are not active" ||
    message === "one or more series are not in trash"
  ) {
    return adminActionFailure(
      "تغيرت حالة السلاسل",
      "بعض السلاسل المحددة لم تعد في الحالة المتوقعة. حدّث الصفحة وحاول مرة أخرى.",
      { entityId },
    );
  }
  return adminActionFailure(
    "تعذر تنفيذ العملية",
    "تعذر تنفيذ دورة حياة السلسلة بأمان. تحقق من العلاقات الحالية وحاول مرة أخرى.",
    { entityId },
  );
}

async function mutateSeriesWithCanonicalOwner(input: {
  ids: number[];
  operation: SeriesLifecycleOperation;
  scope: SeriesLifecycleScope;
  expectedCount?: number;
}): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  const ids = uniquePositiveIds(input.ids);
  if (!ids.length) {
    return adminActionFailure(
      "تعذر تنفيذ العملية",
      "حدد سلسلة واحدة على الأقل.",
    );
  }

  let seriesRows: SeriesLifecycleRow[];
  try {
    seriesRows = await loadSeriesLifecycleRows(
      ids,
      input.operation === "move_to_trash" ? "active" : "trash",
    );
  } catch (error) {
    return seriesLifecycleFailure(error, ids.length === 1 ? ids[0] : undefined);
  }
  if (seriesRows.length !== ids.length) {
    return adminActionFailure(
      "تغيرت حالة السلاسل",
      input.operation === "move_to_trash"
        ? "بعض السلاسل المحددة ليست نشطة. لم يتم حذف أي سلسلة."
        : "بعض السلاسل المحددة ليست داخل المحذوفات. لم يتم تعديل أي سلسلة نشطة.",
      { entityId: ids.length === 1 ? ids[0] : undefined },
    );
  }
  if (
    input.scope === "empty_trash" &&
    seriesRows.length !== input.expectedCount
  ) {
    return adminActionFailure(
      "تغير عدد المحذوفات",
      "تغير عدد السلاسل المحذوفة بعد فتح التأكيد. حدّث الصفحة وراجع العدد قبل المحاولة مرة أخرى.",
    );
  }

  try {
    if (input.operation === "move_to_trash") {
      await moveTopicSeriesToTrashAtomically({ ids, actorId: actor.id });
    } else if (input.operation === "restore") {
      await restoreTopicSeriesAtomically({ ids, actorId: actor.id });
    } else {
      await permanentlyDeleteTopicSeriesAtomically({ ids, actorId: actor.id });
    }
  } catch (error) {
    return seriesLifecycleFailure(error, ids.length === 1 ? ids[0] : undefined);
  }

  const singleSeries = input.scope === "single" ? seriesRows[0] : null;
  const auditVerb =
    input.operation === "move_to_trash"
      ? "delete"
      : input.operation === "restore"
        ? "restore"
        : "permanent_delete";
  await recordCmsAdminAudit(
    {
      action: buildCmsAuditAction("topic_series", auditVerb),
      entityType: "topic_series",
      entityId: singleSeries?.id,
      entityLabel: singleSeries?.name,
      metadata: {
        bulk: input.scope !== "single",
        bulk_action:
          input.scope === "empty_trash" ? "empty_trash" : input.operation,
        series_ids: ids,
        count: ids.length,
        permanent: input.operation === "permanent_delete",
        slug_retained: input.operation === "move_to_trash",
        slug_released: input.operation === "permanent_delete",
        restored_status:
          input.operation === "restore" ? "unpublished" : undefined,
        slugs: seriesRows.map((row) => row.slug),
      },
    },
    actor,
  );
  revalidateSeriesPaths();

  if (input.operation === "move_to_trash") {
    return adminActionSuccess(
      input.scope === "single"
        ? "تم نقل السلسلة إلى المحذوفات"
        : "تم نقل المحدد إلى المحذوفات",
      input.scope === "single"
        ? "اختفت السلسلة من القوائم النشطة وبقي الـSlug محجوزًا."
        : `تم نقل ${ids.length} من السلاسل إلى المحذوفات مع إبقاء الـSlugs محجوزة.`,
      { code: "deleted", entityId: singleSeries?.id },
    );
  }
  if (input.operation === "restore") {
    return adminActionSuccess(
      input.scope === "single" ? "تمت استعادة السلسلة" : "تمت استعادة المحدد",
      input.scope === "single"
        ? "عادت السلسلة إلى القائمة النشطة كغير منشورة."
        : `تمت استعادة ${ids.length} من السلاسل كغير منشورة.`,
      { code: "restored", entityId: singleSeries?.id },
    );
  }
  return adminActionSuccess(
    input.scope === "empty_trash"
      ? "تم إفراغ المحذوفات"
      : input.scope === "single"
        ? "تم حذف السلسلة نهائيًا"
        : "تم الحذف النهائي للمحدد",
    input.scope === "single"
      ? `حُذفت السلسلة نهائيًا وأصبح الـSlug "${seriesRows[0].slug}" متاحًا للاستخدام.`
      : `تم حذف ${ids.length} من السلاسل نهائيًا وتحرير الـSlugs الخاصة بها.`,
    { code: "permanently_deleted", entityId: singleSeries?.id },
  );
}

export async function toggleSeriesStatusAjax(
  id: number,
  currentStatus: string | null,
): Promise<AdminActionResult> {
  await requireAdminSession();
  if (!Number.isInteger(id) || id <= 0) {
    return adminActionFailure("تعذر تنفيذ العملية", "السلسلة غير صالحة.");
  }

  const nextStatus: SeriesStatus =
    currentStatus === "published" ? "unpublished" : "published";
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("topic_series")
    .update({ status: nextStatus, updated_at: now })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle<{ id: number }>();
  if (error || !data) {
    return adminActionFailure(
      "تعذر تنفيذ العملية",
      error?.message ?? "السلسلة غير موجودة أو داخل المحذوفات.",
      { entityId: id },
    );
  }
  await recordCmsAdminAudit({
    action: buildCmsAuditAction(
      "topic_series",
      nextStatus === "published" ? "publish" : "unpublish",
    ),
    entityType: "topic_series",
    entityId: id,
    metadata: { status: nextStatus },
  });
  revalidateSeriesPaths();
  return adminActionSuccess(
    "تم بنجاح",
    nextStatus === "published"
      ? "تم إظهار السلسلة بنجاح."
      : "تم إخفاء السلسلة بنجاح.",
    { code: nextStatus === "published" ? "published" : "unpublished", entityId: id },
  );
}

export async function duplicateSeriesAjax(id: number): Promise<AdminActionResult> {
  await requireAdminSession();
  if (!Number.isInteger(id) || id <= 0) {
    return adminActionFailure("تعذر نسخ السلسلة", "السلسلة غير صالحة.");
  }

  const { data, error } = await getSupabaseAdmin()
    .from("topic_series")
    .select("name, slug, sort_order, category_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<{
      name: string;
      slug: string;
      sort_order: number | null;
      category_id: number | null;
    }>();
  if (error || !data) {
    return adminActionFailure(
      "تعذر نسخ السلسلة",
      error?.message ?? "السلسلة غير موجودة أو داخل المحذوفات.",
    );
  }
  if (!data.category_id) {
    return adminActionFailure(
      "تعذر نسخ السلسلة",
      "لا يمكن نسخ سلسلة بدون تصنيف. عيّن تصنيفًا للسلسلة أولًا.",
    );
  }

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
      status: "unpublished",
      sort_order: data.sort_order ?? 0,
      category_id: data.category_id,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single<{ id: number }>();
  if (insertError || !inserted) {
    return adminActionFailure(
      "تعذر نسخ السلسلة",
      insertError?.message ?? "تعذر نسخ السلسلة.",
    );
  }
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic_series", "duplicate"),
    entityType: "topic_series",
    entityLabel: `${data.name} - نسخة`,
    entityId: inserted.id,
    metadata: { slug, source_series_id: id },
  });
  revalidateSeriesPaths();
  return adminActionSuccess("تم بنجاح", "تم نسخ السلسلة بنجاح.", {
    code: "created",
    entityId: inserted.id,
  });
}

export async function deleteSeriesAjax(id: number) {
  return mutateSeriesWithCanonicalOwner({
    ids: [id],
    operation: "move_to_trash",
    scope: "single",
  });
}

export async function restoreSeriesAjax(id: number) {
  return mutateSeriesWithCanonicalOwner({
    ids: [id],
    operation: "restore",
    scope: "single",
  });
}

export async function permanentlyDeleteSeriesAjax(
  id: number,
  confirmPermanent: boolean,
) {
  if (!confirmPermanent) {
    return adminActionFailure(
      "يلزم تأكيد الحذف النهائي",
      "أكّد الحذف النهائي صراحةً قبل إزالة السلسلة وتحرير الـSlug.",
      { entityId: id },
    );
  }
  return mutateSeriesWithCanonicalOwner({
    ids: [id],
    operation: "permanent_delete",
    scope: "single",
  });
}

export async function bulkSeriesActionAjax(
  action: string,
  ids: number[],
  confirmPermanent = false,
): Promise<AdminActionResult> {
  const validIds = uniquePositiveIds(ids);
  if (!validIds.length) {
    return adminActionFailure("تعذر تنفيذ العملية", "حدد سلسلة واحدة على الأقل.");
  }

  if (action === "delete") {
    return mutateSeriesWithCanonicalOwner({
      ids: validIds,
      operation: "move_to_trash",
      scope: "selected",
    });
  }
  if (action === "restore") {
    return mutateSeriesWithCanonicalOwner({
      ids: validIds,
      operation: "restore",
      scope: "selected",
    });
  }
  if (action === "permanent_delete") {
    if (!confirmPermanent) {
      return adminActionFailure(
        "يلزم تأكيد الحذف النهائي",
        "أكّد الحذف النهائي للمحدد قبل إزالة السلاسل وتحرير الـSlugs.",
      );
    }
    return mutateSeriesWithCanonicalOwner({
      ids: validIds,
      operation: "permanent_delete",
      scope: "selected",
    });
  }
  if (action !== "publish" && action !== "hide") {
    return adminActionFailure("عملية غير معروفة", "إجراء السلاسل غير مدعوم.");
  }

  const actor = await requireAdminSession();
  const status: SeriesStatus = action === "publish" ? "published" : "unpublished";
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("topic_series")
    .update({ status, updated_at: now })
    .in("id", validIds)
    .is("deleted_at", null)
    .select("id");
  if (error || (data ?? []).length !== validIds.length) {
    return adminActionFailure(
      "تعذر تنفيذ العملية",
      error?.message ?? "تغيرت حالة بعض السلاسل. حدّث الصفحة وحاول مرة أخرى.",
    );
  }
  await recordCmsAdminAudit(
    {
      action: buildCmsAuditAction(
        "topic_series",
        status === "published" ? "publish" : "unpublish",
      ),
      entityType: "topic_series",
      metadata: { bulk_action: action, ids: validIds },
    },
    actor,
  );
  revalidateSeriesPaths();
  return adminActionSuccess(
    "تم بنجاح",
    status === "published"
      ? "تم إظهار السلاسل المحددة بنجاح."
      : "تم إخفاء السلاسل المحددة بنجاح.",
  );
}

export async function emptySeriesTrashAjax(
  expectedCount: number,
  confirmPermanent: boolean,
) {
  if (!confirmPermanent) {
    return adminActionFailure(
      "يلزم تأكيد إفراغ المحذوفات",
      "أكّد الحذف النهائي قبل إفراغ محذوفات السلاسل.",
    );
  }
  if (!Number.isInteger(expectedCount) || expectedCount <= 0) {
    return adminActionFailure(
      "تعذر إفراغ المحذوفات",
      "عدد السلاسل المتوقع غير صالح.",
    );
  }
  let seriesRows: SeriesLifecycleRow[];
  try {
    seriesRows = await loadAllDeletedSeries();
  } catch (error) {
    return seriesLifecycleFailure(error);
  }
  if (seriesRows.length !== expectedCount) {
    return adminActionFailure(
      "تغير عدد المحذوفات",
      "تغير عدد السلاسل المحذوفة بعد فتح التأكيد. حدّث الصفحة وراجع العدد قبل المحاولة مرة أخرى.",
    );
  }
  return mutateSeriesWithCanonicalOwner({
    ids: seriesRows.map((row) => row.id),
    operation: "permanent_delete",
    scope: "empty_trash",
    expectedCount,
  });
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
