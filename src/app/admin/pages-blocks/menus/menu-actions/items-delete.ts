"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { auditMenuAction, backToMenu, getMenuIdFromItem, getNumber, revalidateNavigation } from "./helpers";

export async function deleteMenuItem(formData: FormData) {
  await requireAdminSession();
  const id = getNumber(formData, "id");
  const menuId = getNumber(formData, "menu_id") ?? (id ? await getMenuIdFromItem(id) : null);
  if (!id) backToMenu(menuId, "العنصر غير موجود.");

  const { error } = await getSupabaseAdmin().from("menu_items").delete().eq("id", id);
  if (error) backToMenu(menuId, error.message);

  await auditMenuAction("menu_item", "delete", { entityId: id, metadata: { menu_id: menuId } });
  revalidateNavigation();
  backToMenu(menuId, "تم حذف العنصر.");
}
