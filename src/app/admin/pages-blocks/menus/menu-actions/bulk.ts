"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
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
  const ids = formData
    .getAll("menu_ids")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

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
    const { data: affectedItems, error: itemsReadError } = await getSupabaseAdmin()
      .from("menu_items")
      .select("id")
      .in("menu_id", ids);
    if (itemsReadError) {
      return menuInteractionFailure("menu_items_read_failed", itemsReadError.message);
    }

    for (const menuId of ids) {
      try {
        await mutateMenuTree(menuId, "delete_menu", {}, actor);
      } catch (error) {
        return menuInteractionFailure(
          "menu_bulk_delete_failed",
          error instanceof Error ? error.message : "تعذر حذف القوائم.",
        );
      }
    }

    const affectedIds = (affectedItems ?? []).map((item) => Number(item.id));
    const mediaSynchronization = await synchronizeDeletedMenuItemReferences(affectedIds);
    await auditMenuAction("menu", "delete", {
      metadata: {
        bulk_action: action,
        menu_ids: ids,
        deleted_menu_item_count: affectedIds.length,
      },
    });
    await revalidateNavigation(mediaSynchronization);
    return menuInteractionSuccess(
      mediaSynchronization,
      "تم حذف القوائم المحددة.",
    );
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
