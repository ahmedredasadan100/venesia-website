"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { auditMenuAction, backToMenu, getBoolean, getMenuIdFromItem, getNumber, revalidateNavigation } from "./helpers";

export async function toggleMenuItemVisibility(formData: FormData) {
  await requireAdminSession();
  const id = getNumber(formData, "id");
  const menuId = getNumber(formData, "menu_id") ?? (id ? await getMenuIdFromItem(id) : null);
  const isVisible = getBoolean(formData, "is_visible");
  if (!id) backToMenu(menuId, "العنصر غير موجود.");

  const { error } = await getSupabaseAdmin().from("menu_items").update({ is_visible: isVisible, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) backToMenu(menuId, error.message);

  await auditMenuAction("menu_item", "update", { entityId: id, metadata: { menu_id: menuId, is_visible: isVisible } });
  await revalidateNavigation();
  backToMenu(menuId, "تم تغيير حالة العنصر.");
}
