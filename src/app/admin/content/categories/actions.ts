"use server";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";

import { revalidatePath } from "next/cache";
import { revalidateTopicsCache } from "../../../../lib/cache/revalidate-public-cache-tags";
import { getDeterministicAdminTone } from "../../../../lib/admin/content/admin-tone-palette";
import {
  CATEGORIES_DEFAULT_COLUMN_KEYS,
  CATEGORIES_LIST_VIEW_KEY,
  CATEGORIES_PREFERENCE_COLUMN_KEYS,
} from "../../../../lib/admin/content/categories-list-config";
import { saveAdminColumnPreferences } from "../../../../lib/admin/preferences/admin-column-preferences";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import {
  adminActionFailure,
  adminActionSuccess,
  adminActionWarning,
  type AdminActionResult,
} from "../../../../lib/admin/admin-action-result";
import { synchronizeMediaReferencesAfterDomainMutation } from "../../../../lib/admin/media-catalog/synchronization";
import {
  getCategoryDeleteBlockMessage,
  loadCategoryDeleteDependencies,
} from "../../../../lib/admin/content/category-delete-guard";
import {
  deleteTopicCategoryAtomically,
  TaxonomyMutationDatabaseError,
} from "../../../../lib/admin/content/taxonomy-mutations";

async function revalidateCategories() {
  revalidateTopicsCache();
  revalidatePath("/admin/content/categories");
  revalidatePath("/admin/content/categories/new");
  revalidatePath("/admin/content/topics");
  revalidatePath("/admin/content/topics/new");
  revalidatePath("/topics");
}

async function ensureUniqueSlug(slug: string, id?: string) {
  let query = getSupabaseAdmin().from("topic_categories").select("id").eq("slug", slug).limit(1);
  if (id) query = query.neq("id", id);

  const { data, error } = await query.maybeSingle<{ id: number }>();
  if (error) return false;
  return !data;
}

function buildChildrenByParent(categories: Array<{ id: number | string; parent_id: number | null }>) {
  const childrenByParent = new Map<number, number[]>();

  categories.forEach((category) => {
    const id = Number(category.id);
    const parentId = category.parent_id ? Number(category.parent_id) : null;
    if (!parentId) return;

    const children = childrenByParent.get(parentId) ?? [];
    children.push(id);
    childrenByParent.set(parentId, children);
  });

  return childrenByParent;
}

function collectDescendantIds(rootId: number, childrenByParent: Map<number, number[]>) {
  const blockedIds = new Set<number>([rootId]);
  const stack = [...(childrenByParent.get(rootId) ?? [])];

  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || blockedIds.has(id)) continue;
    blockedIds.add(id);
    stack.push(...(childrenByParent.get(id) ?? []));
  }

  return blockedIds;
}

function flattenValidTransferTargets(
  categories: Array<{ id: number | string; name: string; parent_id: number | null }>,
  blockedIds: Set<number>,
) {
  const byId = new Map(
    categories.map((category) => [Number(category.id), category]),
  );

  function getLevel(id: number) {
    let level = 0;
    let current = byId.get(id);

    while (current?.parent_id) {
      const parentId = Number(current.parent_id);
      if (blockedIds.has(parentId)) break;
      level += 1;
      current = byId.get(parentId);
    }

    return level;
  }

  return categories
    .filter((category) => !blockedIds.has(Number(category.id)))
    .map((category) => ({
      id: Number(category.id),
      name: category.name,
      level: getLevel(Number(category.id)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

export type CategoryStatusMutationResult = AdminActionResult & {
  isActive?: boolean;
  status?: string;
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
    .select("id, is_active")
    .eq("id", id)
    .maybeSingle<{ id: number; is_active: boolean | null }>();
  if (readError || !current) {
    return adminActionFailure(
      "تعذر تنفيذ العملية",
      current ? "تعذر قراءة حالة التصنيف." : "التصنيف غير موجود.",
      { entityId: id },
    );
  }

  const isActive = !Boolean(current.is_active);
  const status = isActive ? "published" : "draft";
  const updatedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("topic_categories")
    .update({ is_active: isActive, status, updated_at: updatedAt })
    .eq("id", id)
    .select("id, is_active, status, updated_at")
    .maybeSingle<{
      id: number;
      is_active: boolean | null;
      status: string | null;
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
    metadata: { is_active: isActive },
  });
  await revalidateCategories();
  return {
    ...adminActionSuccess(
      "تم بنجاح",
      isActive
        ? "تم إظهار التصنيف بنجاح."
        : "تم إخفاء التصنيف بنجاح.",
      { code: isActive ? "published" : "unpublished", entityId: id },
    ),
    isActive,
    status: updated.status ?? status,
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
    .select("name, slug, description, sort_order, is_active, parent_id, status, color_token")
    .eq("id", id)
    .maybeSingle<{
      name: string;
      slug: string;
      description: string | null;
      sort_order: number | null;
      is_active: boolean | null;
      parent_id: number | null;
      status: string | null;
      color_token: string | null;
    }>();

  if (readError) {
    return adminActionFailure("تعذر نسخ التصنيف", readError.message);
  }
  if (!current) {
    return adminActionFailure("تعذر نسخ التصنيف", "التصنيف غير موجود.");
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
      color_token: current.color_token || getDeterministicAdminTone(nextSlug),
      status: "draft",
      show_in_menu: true,
      is_featured: false,
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
    ...adminActionSuccess(
      "تم بنجاح",
      "تم نسخ التصنيف بنجاح.",
      { code: "created", entityId: inserted.id },
    ),
    insertedId: inserted.id,
  };
}

export async function getCategoryDeletePreviewAjax(id: number) {
  await requireAdminSession();

  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false as const, message: "معرّف التصنيف غير صالح." };
  }

  const { data: category, error: categoryError } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id, name")
    .eq("id", id)
    .maybeSingle<{ id: number; name: string }>();

  if (categoryError) {
    return { ok: false as const, message: "تعذر قراءة بيانات التصنيف." };
  }
  if (!category) return { ok: false as const, message: "التصنيف غير موجود." };

  let dependencies;
  try {
    dependencies = await loadCategoryDeleteDependencies(id);
  } catch {
    return {
      ok: false as const,
      message: "تعذر التحقق من العناصر المرتبطة بالتصنيف.",
    };
  }
  const { topicCount, seriesCount, childrenCount } = dependencies;

  const { data: categories, error: categoriesError } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id, parent_id, name");
  if (categoriesError) {
    return { ok: false as const, message: "تعذر قراءة التصنيفات البديلة." };
  }

  const childrenByParent = buildChildrenByParent(categories ?? []);
  const blockedIds = collectDescendantIds(id, childrenByParent);
  const validTransferTargets = flattenValidTransferTargets(categories ?? [], blockedIds);

  return {
    ok: true as const,
    categoryName: category.name,
    topicCount,
    seriesCount,
    childrenCount,
    blockMessage: getCategoryDeleteBlockMessage(dependencies, {
      includeTopics:
        dependencies.seriesCount > 0 || dependencies.childrenCount > 0,
    }),
    validTransferTargets,
  };
}

export async function deleteCategorySafelyAjax(id: number, transferToId?: number | null) {
  const actor = await requireAdminSession();

  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false as const, message: "معرّف التصنيف غير صالح." };
  }

  const { data: affectedCategory, error: categoryReadError } = await getSupabaseAdmin()
    .from("topic_categories")
    .select("id")
    .eq("id", id)
    .maybeSingle<{ id: number }>();
  if (categoryReadError) {
    return { ok: false as const, message: "تعذر إثبات التصنيف المطلوب قبل الحذف." };
  }
  if (!affectedCategory) {
    return { ok: false as const, message: "التصنيف غير موجود." };
  }

  let mutation: Awaited<ReturnType<typeof deleteTopicCategoryAtomically>>;
  try {
    mutation = await deleteTopicCategoryAtomically({
      id,
      transferToId:
        transferToId && Number.isFinite(transferToId) ? transferToId : null,
      actorId: actor.id,
    });
  } catch (error) {
    if (error instanceof TaxonomyMutationDatabaseError) {
      if (error.message === "category still has linked series") {
        return { ok: false as const, message: "لا يمكن حذف التصنيف لأنه مرتبط بسلاسل محتوى." };
      }
      if (error.message === "category still has child categories") {
        return { ok: false as const, message: "لا يمكن حذف التصنيف لأنه يحتوي على تصنيفات فرعية." };
      }
      if (error.message === "a valid transfer category is required") {
        return { ok: false as const, message: "اختر تصنيفًا لنقل الموضوعات إليه." };
      }
      if (error.message === "transfer category was not found") {
        return { ok: false as const, message: "التصنيف الهدف غير موجود." };
      }
      if (error.message === "category was not found") {
        return { ok: false as const, message: "التصنيف غير موجود." };
      }
    }
    return { ok: false as const, message: "تعذر حذف التصنيف. تحقق من العناصر المرتبطة به." };
  }

  const mediaSynchronization = await synchronizeMediaReferencesAfterDomainMutation(
    "topic_categories",
    affectedCategory.id,
  );
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic_category", "delete"),
    entityType: "topic_category",
    entityId: id,
    metadata: {
      transfer_to_id: mutation.transfer_to_id,
      topics_updated: mutation.topics_updated,
    },
  });
  await revalidateCategories();
  if (mediaSynchronization.status === "saved_with_media_sync_warning") {
    return {
      ...adminActionWarning(
        "تم الحذف مع تنبيه",
        "تم حذف التصنيف، لكن تعذر تأكيد إزالة مرجع صورته من فهرس الميديا. يظل الحذف الآمن متوقفًا حتى اكتمال الفحص.",
        {
          code: "saved_with_media_sync_warning",
          entityId: affectedCategory.id,
        },
      ),
      mediaSynchronization,
    };
  }
  return {
    ...adminActionSuccess(
      "تم بنجاح",
      "تم حذف التصنيف بنجاح.",
      { code: "deleted", entityId: affectedCategory.id },
    ),
    mediaSynchronization,
  };
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
