"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  collectMenuItemDescendantIds,
  getNumber,
  menuInteractionFailure,
  menuInteractionSuccess,
  mutateMenuTree,
  revalidateNavigation,
  synchronizeDeletedMenuItemReferences,
} from "./helpers";

export async function deleteMenuItem(formData: FormData) {
  const actor = await requireAdminSession();
  const id = getNumber(formData, "id");
  if (!id) return menuInteractionFailure("menu_item_not_found", "العنصر غير موجود.");

  const { data: rootItem, error: rootReadError } = await getSupabaseAdmin()
    .from("menu_items")
    .select("id, menu_id")
    .eq("id", id)
    .maybeSingle();
  if (rootReadError || !rootItem) {
    return menuInteractionFailure(
      "menu_item_not_found",
      rootReadError?.message ?? "العنصر غير موجود.",
    );
  }
  const menuId = Number(rootItem.menu_id);
  const { data: menuItems, error: itemsReadError } = await getSupabaseAdmin()
    .from("menu_items")
    .select("id, parent_id")
    .eq("menu_id", menuId);
  if (itemsReadError) {
    return menuInteractionFailure("menu_items_read_failed", itemsReadError.message);
  }
  const affectedIds = collectMenuItemDescendantIds(id, menuItems ?? []);

  try {
    await mutateMenuTree(menuId, "delete_item", { item_id: id }, actor);
  } catch (error) {
    return menuInteractionFailure(
      "menu_item_delete_failed",
      error instanceof Error ? error.message : "تعذر حذف العنصر.",
    );
  }

  const mediaSynchronization = await synchronizeDeletedMenuItemReferences(affectedIds);
  await revalidateNavigation(mediaSynchronization);
  return menuInteractionSuccess(mediaSynchronization, "تم حذف العنصر.");
}
