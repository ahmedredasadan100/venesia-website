"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  getNumber,
  menuInteractionFailure,
  menuInteractionSuccess,
  mutateMenuTree,
  revalidateNavigation,
  synchronizeDeletedMenuItemReferences,
} from "./helpers";

export async function deleteMenu(formData: FormData) {
  const actor = await requireAdminSession();
  const id = getNumber(formData, "id");
  if (!id) return menuInteractionFailure("menu_not_found", "القائمة غير موجودة.");

  const { data: affectedItems, error: itemsReadError } = await getSupabaseAdmin()
    .from("menu_items")
    .select("id")
    .eq("menu_id", id);
  if (itemsReadError) {
    return menuInteractionFailure("menu_items_read_failed", itemsReadError.message);
  }

  try {
    await mutateMenuTree(id, "delete_menu", {}, actor);
  } catch (error) {
    return menuInteractionFailure(
      "menu_delete_failed",
      error instanceof Error ? error.message : "تعذر حذف القائمة.",
    );
  }

  const mediaSynchronization = await synchronizeDeletedMenuItemReferences(
    (affectedItems ?? []).map((item) => item.id),
  );
  await revalidateNavigation(mediaSynchronization);
  return menuInteractionSuccess(mediaSynchronization, "تم حذف القائمة.");
}
