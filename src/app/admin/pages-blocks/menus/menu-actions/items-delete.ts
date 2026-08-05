"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  backToMenu,
  collectMenuItemDescendantIds,
  getMenuIdFromItem,
  getNumber,
  navigationMutationMessage,
  mutateMenuTree,
  revalidateNavigation,
  synchronizeDeletedMenuItemReferences,
} from "./helpers";

export async function deleteMenuItem(formData: FormData) {
  const actor = await requireAdminSession();
  const id = getNumber(formData, "id");
  const requestedMenuId = getNumber(formData, "menu_id") ?? (id ? await getMenuIdFromItem(id) : null);
  if (!id) backToMenu(requestedMenuId, "العنصر غير موجود.");

  const { data: rootItem, error: rootReadError } = await getSupabaseAdmin()
    .from("menu_items")
    .select("id, menu_id")
    .eq("id", id)
    .maybeSingle();
  if (rootReadError || !rootItem) {
    backToMenu(requestedMenuId, rootReadError?.message ?? "العنصر غير موجود.");
  }
  const menuId = Number(rootItem.menu_id);
  const { data: menuItems, error: itemsReadError } = await getSupabaseAdmin()
    .from("menu_items")
    .select("id, parent_id")
    .eq("menu_id", menuId);
  if (itemsReadError) backToMenu(menuId, itemsReadError.message);
  const affectedIds = collectMenuItemDescendantIds(id, menuItems ?? []);

  try {
    await mutateMenuTree(menuId, "delete_item", { item_id: id }, actor);
  } catch (error) {
    backToMenu(menuId, error instanceof Error ? error.message : "تعذر حذف العنصر.");
  }

  const mediaSynchronization = await synchronizeDeletedMenuItemReferences(affectedIds);
  await revalidateNavigation(mediaSynchronization);
  backToMenu(
    menuId,
    navigationMutationMessage(mediaSynchronization, "تم حذف العنصر."),
  );
}
