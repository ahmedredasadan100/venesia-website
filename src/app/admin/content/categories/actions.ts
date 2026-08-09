"use server";

import { revalidatePath } from "next/cache";

import {
  adminActionFailure,
  adminActionSuccess,
  adminActionWarning,
  type AdminActionResult,
} from "../../../../lib/admin/admin-action-result";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { getDeterministicAdminTone } from "../../../../lib/admin/content/admin-tone-palette";
import {
  CATEGORIES_DEFAULT_COLUMN_KEYS,
  CATEGORIES_LIST_VIEW_KEY,
  CATEGORIES_PREFERENCE_COLUMN_KEYS,
} from "../../../../lib/admin/content/categories-list-config";
import {
  moveTopicCategoriesToTrashAtomically,
  permanentlyDeleteTopicCategoriesAtomically,
  restoreTopicCategoriesAtomically,
  TaxonomyMutationDatabaseError,
} from "../../../../lib/admin/content/taxonomy-mutations";
import { synchronizeMediaReferenceWriteScopesAfterDomainMutation } from "../../../../lib/admin/media-catalog/synchronization";
import { saveAdminColumnPreferences } from "../../../../lib/admin/preferences/admin-column-preferences";
import { revalidateTopicsCache } from "../../../../lib/cache/revalidate-public-cache-tags";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

type CategoryLifecycleRow = {
  id: number;
  name: string;
  slug: string;
  deleted_at: string | null;
};

type CategoryLifecycleOperation =
  | "move_to_trash"
  | "restore"
  | "permanent_delete";

type CategoryLifecycleScope = "single" | "selected" | "empty_trash";

async function revalidateCategories() {
  revalidateTopicsCache();
  revalidatePath("/admin/content/categories");
  revalidatePath("/admin/content/categories/new");
  revalidatePath("/admin/content/topics");
  revalidatePath("/admin/content/topics/new");
  revalidatePath("/topics");
}

function uniquePositiveIds(ids: number[]) {
  return [...new Set(ids)].filter(
    (id) => Number.isInteger(id) && id > 0,
  );
}

async function ensureUniqueSlug(slug: string, id?: number) {
  let query = getSupabaseAdmin()
    .from("topic_categories")
    .select("id")
    .eq("slug", slug)
    .limit(1);
  if (id) query = query.neq("id", id);

  const { data, error } = await query.maybeSingle<{ id: number }>();
  if (error) return false;
  return !data;
}

async function loadCategoryLifecycleRows(
  ids: number[],
  view: "active" | "trash",
) {
  let query = getSupabaseAdmin()
    .from("topic_categories")
    .select("id,name,slug,deleted_at")
    .in("id", ids);
  query =
    view === "trash"
      ? query.not("deleted_at", "is", null)
      : query.is("deleted_at", null);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as CategoryLifecycleRow[];
}

async function loadAllDeletedCategories() {
  const { data, error } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id,name,slug,deleted_at")
    .not("deleted_at", "is", null)
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CategoryLifecycleRow[];
}

function categoryLifecycleFailure(error: unknown, entityId?: number) {
  const message =
    error instanceof TaxonomyMutationDatabaseError
      ? error.message
      : error instanceof Error
        ? error.message
        : "taxonomy lifecycle mutation failed";
  if (message === "categories still have linked topics") {
    return adminActionFailure(
      "تعذر حذف التصنيف",
      "لا يمكن حذف التصنيف لأنه مرتبط بموضوعات. انقل الموضوعات أو أزل ارتباطها أولًا.",
      { entityId },
    );
  }
  if (message === "categories still have linked series") {
    return adminActionFailure(
      "تعذر حذف التصنيف",
      "لا يمكن حذف التصنيف لأنه مرتبط بسلاسل محتوى. انقل السلاسل أولًا.",
      { entityId },
    );
  }
  if (message === "categories still have child categories") {
    return adminActionFailure(
      "تعذر حذف التصنيف",
      "لا يمكن حذف التصنيف لأنه يحتوي على تصنيفات فرعية غير محددة. انقلها أو احذفها أولًا.",
      { entityId },
    );
  }
  if (message === "category restore slug conflict") {
    return adminActionFailure(
      "تعذر استعادة التصنيف",
      "لا يمكن الاستعادة لأن الـSlug مستخدم في تصنيف نشط آخر.",
      { code: "slug_conflict", entityId },
    );
  }
  if (message === "category restore parent is unavailable") {
    return adminActionFailure(
      "تعذر استعادة التصنيف",
      "التصنيف الأب غير موجود أو ما زال داخل المحذوفات. استعد الأب أولًا.",
      { entityId },
    );
  }
  if (
    message === "one or more categories are not active" ||
    message === "one or more categories are not in trash"
  ) {
    return adminActionFailure(
      "تغيرت حالة التصنيفات",
      "بعض التصنيفات المحددة لم تعد في الحالة المتوقعة. حدّث الصفحة وحاول مرة أخرى.",
      { entityId },
    );
  }
  return adminActionFailure(
    "تعذر تنفيذ العملية",
    "تعذر تنفيذ دورة حياة التصنيف بأمان. تحقق من العلاقات الحالية وحاول مرة أخرى.",
    { entityId },
  );
}

async function mutateCategoriesWithCanonicalOwner(input: {
  ids: number[];
  operation: CategoryLifecycleOperation;
  scope: CategoryLifecycleScope;
  expectedCount?: number;
}): Promise<AdminActionResult> {
  const actor = await requireAdminSession();
  const ids = uniquePositiveIds(input.ids);
  if (!ids.length) {
    return adminActionFailure(
      "تعذر تنفيذ العملية",
      "حدد تصنيفًا واحدًا على الأقل.",
    );
  }

  let categories: CategoryLifecycleRow[];
  try {
    categories = await loadCategoryLifecycleRows(
      ids,
      input.operation === "move_to_trash" ? "active" : "trash",
    );
  } catch (error) {
    return categoryLifecycleFailure(error, ids.length === 1 ? ids[0] : undefined);
  }
  if (categories.length !== ids.length) {
    return adminActionFailure(
      "تغيرت حالة التصنيفات",
      input.operation === "move_to_trash"
        ? "بعض التصنيفات المحددة ليست نشطة. لم يتم حذف أي تصنيف."
        : "بعض التصنيفات المحددة ليست داخل المحذوفات. لم يتم تعديل أي تصنيف نشط.",
      { entityId: ids.length === 1 ? ids[0] : undefined },
    );
  }
  if (
    input.scope === "empty_trash" &&
    categories.length !== input.expectedCount
  ) {
    return adminActionFailure(
      "تغير عدد المحذوفات",
      "تغير عدد التصنيفات المحذوفة بعد فتح التأكيد. حدّث الصفحة وراجع العدد قبل المحاولة مرة أخرى.",
    );
  }

  try {
    if (input.operation === "move_to_trash") {
      await moveTopicCategoriesToTrashAtomically({ ids, actorId: actor.id });
    } else if (input.operation === "restore") {
      await restoreTopicCategoriesAtomically({ ids, actorId: actor.id });
    } else {
      await permanentlyDeleteTopicCategoriesAtomically({
        ids,
        actorId: actor.id,
      });
    }
  } catch (error) {
    return categoryLifecycleFailure(error, ids.length === 1 ? ids[0] : undefined);
  }

  const singleCategory = input.scope === "single" ? categories[0] : null;
  const auditVerb =
    input.operation === "move_to_trash"
      ? "delete"
      : input.operation === "restore"
        ? "restore"
        : "permanent_delete";
  await recordCmsAdminAudit(
    {
      action: buildCmsAuditAction("topic_category", auditVerb),
      entityType: "topic_category",
      entityId: singleCategory?.id,
      entityLabel: singleCategory?.name,
      metadata: {
        bulk: input.scope !== "single",
        bulk_action:
          input.scope === "empty_trash" ? "empty_trash" : input.operation,
        category_ids: ids,
        count: ids.length,
        permanent: input.operation === "permanent_delete",
        slug_retained: input.operation === "move_to_trash",
        slug_released: input.operation === "permanent_delete",
        restored_status:
          input.operation === "restore" ? "unpublished" : undefined,
        slugs: categories.map((category) => category.slug),
      },
    },
    actor,
  );

  await revalidateCategories();

  if (input.operation === "move_to_trash") {
    return adminActionSuccess(
      input.scope === "single"
        ? "تم نقل التصنيف إلى المحذوفات"
        : "تم نقل المحدد إلى المحذوفات",
      input.scope === "single"
        ? "اختفى التصنيف من القوائم النشطة وبقي الـSlug محجوزًا."
        : `تم نقل ${ids.length} من التصنيفات إلى المحذوفات مع إبقاء الـSlugs محجوزة.`,
      { code: "deleted", entityId: singleCategory?.id },
    );
  }

  if (input.operation === "restore") {
    return adminActionSuccess(
      input.scope === "single" ? "تمت استعادة التصنيف" : "تمت استعادة المحدد",
      input.scope === "single"
        ? "عاد التصنيف إلى القائمة النشطة كغير منشور."
        : `تمت استعادة ${ids.length} من التصنيفات كغير منشورة.`,
      { code: "restored", entityId: singleCategory?.id },
    );
  }

  const mediaSynchronization =
    await synchronizeMediaReferenceWriteScopesAfterDomainMutation(
      [],
      null,
      ids.map((id) => ({
        domainKey: "topic_categories",
        entityIdentity: id,
      })),
    );
  const message =
    input.scope === "single"
      ? `حُذف التصنيف نهائيًا وأصبح الـSlug "${categories[0].slug}" متاحًا للاستخدام.`
      : `تم حذف ${ids.length} من التصنيفات نهائيًا وتحرير الـSlugs الخاصة بها.`;
  if (mediaSynchronization.status === "saved_with_media_sync_warning") {
    return adminActionWarning(
      "تم الحذف النهائي مع تنبيه للميديا",
      `${message} تعذر إثبات تنظيف بعض مراجع الميديا بالكامل ويلزم فحصها.`,
      {
        code: "saved_with_media_sync_warning",
        entityId: singleCategory?.id,
      },
    );
  }
  return adminActionSuccess(
    input.scope === "empty_trash"
      ? "تم إفراغ المحذوفات"
      : input.scope === "single"
        ? "تم حذف التصنيف نهائيًا"
        : "تم الحذف النهائي للمحدد",
    message,
    { code: "permanently_deleted", entityId: singleCategory?.id },
  );
}

export type CategoryStatusMutationResult = AdminActionResult & {
  isActive?: boolean;
  status?: string;
  publishedAt?: string | null;
  updatedAt?: string;
};

export async function toggleCategoryStatusAjax(
  id: number,
): Promise<CategoryStatusMutationResult> {
  await requireAdminSession();
  if (!Number.isInteger(id) || id <= 0) {
    return adminActionFailure("تعذر تنفيذ العملية", "معرّف التصنيف غير صالح.");
  }

  const supabase = getSupabaseAdmin();
  const { data: current, error: readError } = await supabase
    .from("topic_categories")
    .select("id, status")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<{ id: number; status: string | null }>();
  if (readError || !current) {
    return adminActionFailure(
      "تعذر تنفيذ العملية",
      current ? "تعذر قراءة حالة التصنيف." : "التصنيف غير موجود أو داخل المحذوفات.",
      { entityId: id },
    );
  }

  const isActive = current.status !== "published";
  const status = isActive ? "published" : "unpublished";
  const updatedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("topic_categories")
    .update({ is_active: isActive, status, updated_at: updatedAt })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, is_active, status, published_at, updated_at")
    .maybeSingle<{
      id: number;
      is_active: boolean | null;
      status: string | null;
      published_at: string | null;
      updated_at: string | null;
    }>();
  if (updateError || !updated || Boolean(updated.is_active) !== isActive) {
    return adminActionFailure(
      "تعذر تنفيذ العملية",
      "لم يتم تحديث حالة التصنيف. حاول مرة أخرى.",
      { entityId: id },
    );
  }

  await recordCmsAdminAudit({
    action: buildCmsAuditAction(
      "topic_category",
      isActive ? "publish" : "unpublish",
    ),
    entityType: "topic_category",
    entityId: id,
    metadata: { is_active: isActive, published_at: updated.published_at },
  });
  await revalidateCategories();
  return {
    ...adminActionSuccess(
      "تم بنجاح",
      isActive ? "تم إظهار التصنيف بنجاح." : "تم إخفاء التصنيف بنجاح.",
      { code: isActive ? "published" : "unpublished", entityId: id },
    ),
    isActive,
    status: updated.status ?? status,
    publishedAt: updated.published_at,
    updatedAt: updated.updated_at ?? updatedAt,
  };
}

export type CategoryDuplicateMutationResult = AdminActionResult & {
  insertedId?: number;
};

export async function duplicateCategoryAjax(
  id: number,
): Promise<CategoryDuplicateMutationResult> {
  await requireAdminSession();
  if (!Number.isInteger(id) || id <= 0) {
    return adminActionFailure("تعذر نسخ التصنيف", "معرّف التصنيف غير صالح.");
  }

  const { data: current, error: readError } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("name, slug, description, sort_order, parent_id, color_token")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<{
      name: string;
      slug: string;
      description: string | null;
      sort_order: number | null;
      parent_id: number | null;
      color_token: string | null;
    }>();
  if (readError || !current) {
    return adminActionFailure(
      "تعذر نسخ التصنيف",
      readError?.message ?? "التصنيف غير موجود أو داخل المحذوفات.",
    );
  }

  let nextSlug = `${current.slug}-copy`;
  let suffix = 2;
  while (!(await ensureUniqueSlug(nextSlug))) {
    nextSlug = `${current.slug}-copy-${suffix}`;
    suffix += 1;
  }

  const now = new Date().toISOString();
  const { data: inserted, error } = await getSupabaseAdmin()
    .from("topic_categories")
    .insert({
      name: `${current.name} - نسخة`,
      slug: nextSlug,
      description: current.description,
      sort_order: current.sort_order ?? 0,
      is_active: false,
      parent_id: current.parent_id,
      color_token:
        current.color_token || getDeterministicAdminTone(nextSlug),
      status: "unpublished",
      show_in_menu: true,
      is_featured: false,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single<{ id: number }>();
  if (error || !inserted) {
    return adminActionFailure(
      "تعذر نسخ التصنيف",
      error?.message ?? "تعذر إنشاء نسخة التصنيف.",
    );
  }

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic_category", "duplicate"),
    entityType: "topic_category",
    entityLabel: `${current.name} - نسخة`,
    entityId: inserted.id,
    metadata: { slug: nextSlug, source_category_id: id },
  });
  await revalidateCategories();
  return {
    ...adminActionSuccess("تم بنجاح", "تم نسخ التصنيف بنجاح.", {
      code: "created",
      entityId: inserted.id,
    }),
    insertedId: inserted.id,
  };
}

export async function deleteCategorySafelyAjax(id: number) {
  return mutateCategoriesWithCanonicalOwner({
    ids: [id],
    operation: "move_to_trash",
    scope: "single",
  });
}

export async function restoreCategoryAjax(id: number) {
  return mutateCategoriesWithCanonicalOwner({
    ids: [id],
    operation: "restore",
    scope: "single",
  });
}

export async function permanentlyDeleteCategoryAjax(
  id: number,
  confirmPermanent: boolean,
) {
  if (!confirmPermanent) {
    return adminActionFailure(
      "يلزم تأكيد الحذف النهائي",
      "أكّد الحذف النهائي صراحةً قبل إزالة التصنيف وتحرير الـSlug.",
      { entityId: id },
    );
  }
  return mutateCategoriesWithCanonicalOwner({
    ids: [id],
    operation: "permanent_delete",
    scope: "single",
  });
}

export async function bulkCategoriesLifecycleAjax(
  action: string,
  ids: number[],
  confirmPermanent = false,
) {
  if (action === "restore") {
    return mutateCategoriesWithCanonicalOwner({
      ids,
      operation: "restore",
      scope: "selected",
    });
  }
  if (action === "permanent_delete") {
    if (!confirmPermanent) {
      return adminActionFailure(
        "يلزم تأكيد الحذف النهائي",
        "أكّد الحذف النهائي للمحدد قبل إزالة التصنيفات وتحرير الـSlugs.",
      );
    }
    return mutateCategoriesWithCanonicalOwner({
      ids,
      operation: "permanent_delete",
      scope: "selected",
    });
  }
  return adminActionFailure("عملية غير معروفة", "إجراء التصنيفات غير مدعوم.");
}

export async function emptyCategoriesTrashAjax(
  expectedCount: number,
  confirmPermanent: boolean,
) {
  if (!confirmPermanent) {
    return adminActionFailure(
      "يلزم تأكيد إفراغ المحذوفات",
      "أكّد الحذف النهائي قبل إفراغ محذوفات التصنيفات.",
    );
  }
  if (!Number.isInteger(expectedCount) || expectedCount <= 0) {
    return adminActionFailure(
      "تعذر إفراغ المحذوفات",
      "عدد التصنيفات المتوقع غير صالح.",
    );
  }
  let categories: CategoryLifecycleRow[];
  try {
    categories = await loadAllDeletedCategories();
  } catch (error) {
    return categoryLifecycleFailure(error);
  }
  if (categories.length !== expectedCount) {
    return adminActionFailure(
      "تغير عدد المحذوفات",
      "تغير عدد التصنيفات المحذوفة بعد فتح التأكيد. حدّث الصفحة وراجع العدد قبل المحاولة مرة أخرى.",
    );
  }
  return mutateCategoriesWithCanonicalOwner({
    ids: categories.map((category) => category.id),
    operation: "permanent_delete",
    scope: "empty_trash",
    expectedCount,
  });
}

export async function saveCategoriesTablePreferences(visibleColumns: string[]) {
  return saveAdminColumnPreferences({
    viewKey: CATEGORIES_LIST_VIEW_KEY,
    visibleColumns,
    allowedColumns: CATEGORIES_PREFERENCE_COLUMN_KEYS,
  });
}

export async function restoreCategoriesTablePreferences() {
  return saveCategoriesTablePreferences([...CATEGORIES_DEFAULT_COLUMN_KEYS]);
}
