"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  auditMenuAction,
  backToMenus,
  getNumber,
  navigationMutationMessage,
  revalidateNavigation,
  synchronizeDeletedMenuItemReferences,
} from "./helpers";

export async function deleteMenu(formData: FormData) {
  await requireAdminSession();
  const id = getNumber(formData, "id");
  if (!id) backToMenus("القائمة غير موجودة.");

  const { data: affectedItems, error: itemsReadError } = await getSupabaseAdmin()
    .from("menu_items")
    .select("id")
    .eq("menu_id", id);
  if (itemsReadError) backToMenus(itemsReadError.message);

  // The FK cascade makes the menu and its items one atomic domain deletion.
  const { error } = await getSupabaseAdmin().from("menus").delete().eq("id", id);
  if (error) backToMenus(error.message);

  const mediaSynchronization = await synchronizeDeletedMenuItemReferences(
    (affectedItems ?? []).map((item) => item.id),
  );
  await auditMenuAction("menu", "delete", {
    entityId: id,
    metadata: { deleted_menu_item_count: affectedItems?.length ?? 0 },
  });
  await revalidateNavigation(mediaSynchronization);
  backToMenus(
    navigationMutationMessage(mediaSynchronization, "تم حذف القائمة."),
  );
}
