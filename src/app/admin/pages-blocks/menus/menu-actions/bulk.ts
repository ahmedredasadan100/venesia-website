"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { runBoundedPublicCacheRevalidation } from "../../../../../lib/cache/revalidate-public-cache-tags";
import {
  auditMenuAction,
  backToMenus,
  getNumber,
  getString,
  menuInteractionFailure,
  menuInteractionSuccess,
  navigationMutationMessage,
  mutateMenuTree,
  revalidateNavigation,
  synchronizeDeletedMenuItemReferences,
} from "./helpers";

export async function bulkMenuAction(formData: FormData) {
  const actor = await requireAdminSession();
  const action = getString(formData, "bulk_action");
  const ids = [...new Set(formData
    .getAll("menu_ids")
    .map((value) => Number(value))
    .filter((value) => Number.isSafeInteger(value) && value > 0))];

  if (!ids.length) {
    return menuInteractionFailure(
      "menu_bulk_empty",
      "اختر قائمة واحدة على الأقل.",
    );
  }

  if (action === "show" || action === "hide") {
    const { error } = await getSupabaseAdmin()
      .from("menus")
      .update({ is_active: action === "show", updated_at: new Date().toISOString() })
      .in("id", ids);

    if (error) return menuInteractionFailure("menu_bulk_update_failed", error.message);
    await auditMenuAction("menu", "update", {
      metadata: { bulk_action: action, menu_ids: ids, is_active: action === "show" },
    });
    const mediaSynchronization = await revalidateNavigation();
    return menuInteractionSuccess(
      mediaSynchronization,
      action === "show" ? "تم إظهار القوائم المحددة." : "تم إخفاء القوائم المحددة.",
    );
  }

  if (action === "delete") {
    let committed;
    try {
      committed = await mutateMenuTree(ids[0], "delete_menus", { menu_ids: ids }, actor);
    } catch (error) {
      return menuInteractionFailure(
        "menu_bulk_delete_failed",
        error instanceof Error ? error.message : "تعذر حذف القوائم.",
      );
    }

    const affectedIds = committed.deleted_item_ids as number[];
    const mediaSynchronization = await synchronizeDeletedMenuItemReferences(affectedIds);
    await auditMenuAction("menu", "delete", {
      metadata: {
        bulk_action: action,
        menu_ids: ids,
        deleted_menu_item_count: affectedIds.length,
      },
    });
    const cacheRevalidation = await runBoundedPublicCacheRevalidation(() => revalidateNavigation(mediaSynchronization).then(() => undefined));
    if (!cacheRevalidation.ok) console.error("Menus deleted; cache revalidation failed", cacheRevalidation.error);
    const result = menuInteractionSuccess(
      mediaSynchronization,
      "تم حذف القوائم المحددة.",
      { deletedIds: committed.deleted_menu_ids as number[] },
    );
    return cacheRevalidation.ok ? result : {
      ...result,
      feedbackStatus: "warning" as const,
      message: `${result.message} تعذر تحديث الكاش بعد إعادة المحاولة؛ قد تتأخر القراءة العامة.`,
    };
  }

  return menuInteractionFailure(
    "menu_bulk_unknown_action",
    "الإجراء الجماعي غير معروف.",
  );
}

export async function clearMenuItems(formData: FormData) {
  const actor = await requireAdminSession();
  const id = getNumber(formData, "id");
  if (!id) backToMenus("القائمة غير موجودة.");

  const { data: affectedItems, error: itemsReadError } = await getSupabaseAdmin()
    .from("menu_items")
    .select("id")
    .eq("menu_id", id);
  if (itemsReadError) backToMenus(itemsReadError.message);

  try {
    await mutateMenuTree(id, "clear_menu", {}, actor);
  } catch (error) {
    backToMenus(error instanceof Error ? error.message : "تعذر تفريغ القائمة.");
  }

  const affectedIds = (affectedItems ?? []).map((item) => Number(item.id));
  const mediaSynchronization = await synchronizeDeletedMenuItemReferences(affectedIds);
  await auditMenuAction("menu_item", "delete", {
    entityId: id,
    metadata: { cleared_menu_id: id, deleted_item_count: affectedIds.length },
  });
  await revalidateNavigation(mediaSynchronization);
  backToMenus(
    navigationMutationMessage(mediaSynchronization, "تم تفريغ عناصر القائمة."),
  );
}
