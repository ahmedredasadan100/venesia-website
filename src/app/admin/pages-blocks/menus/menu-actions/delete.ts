"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  backToMenus,
  getNumber,
  navigationMutationMessage,
  mutateMenuTree,
  revalidateNavigation,
  synchronizeDeletedMenuItemReferences,
} from "./helpers";

export async function deleteMenu(formData: FormData) {
  const actor = await requireAdminSession();
  const id = getNumber(formData, "id");
  if (!id) backToMenus("القائمة غير موجودة.");

  const { data: affectedItems, error: itemsReadError } = await getSupabaseAdmin()
    .from("menu_items")
    .select("id")
    .eq("menu_id", id);
  if (itemsReadError) backToMenus(itemsReadError.message);

  try {
    await mutateMenuTree(id, "delete_menu", {}, actor);
  } catch (error) {
    backToMenus(error instanceof Error ? error.message : "تعذر حذف القائمة.");
  }

  const mediaSynchronization = await synchronizeDeletedMenuItemReferences(
    (affectedItems ?? []).map((item) => item.id),
  );
  await revalidateNavigation(mediaSynchronization);
  backToMenus(
    navigationMutationMessage(mediaSynchronization, "تم حذف القائمة."),
  );
}
