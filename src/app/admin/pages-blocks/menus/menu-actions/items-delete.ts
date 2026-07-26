"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  auditMenuAction,
  backToMenu,
  collectMenuItemDescendantIds,
  getMenuIdFromItem,
  getNumber,
  navigationMutationMessage,
  revalidateNavigation,
  synchronizeDeletedMenuItemReferences,
} from "./helpers";

export async function deleteMenuItem(formData: FormData) {
  await requireAdminSession();
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

  // Child items are deleted by the self-referencing FK cascade in the same statement.
  const { error } = await getSupabaseAdmin().from("menu_items").delete().eq("id", id);
  if (error) backToMenu(menuId, error.message);

  const mediaSynchronization = await synchronizeDeletedMenuItemReferences(affectedIds);
  await auditMenuAction("menu_item", "delete", {
    entityId: id,
    metadata: { menu_id: menuId, deleted_item_count: affectedIds.length },
  });
  await revalidateNavigation(mediaSynchronization);
  backToMenu(
    menuId,
    navigationMutationMessage(mediaSynchronization, "تم حذف العنصر."),
  );
}
