"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { auditMenuAction, getBoolean, getMenuIdFromItem, getNumber, menuInteractionFailure, menuInteractionSuccess, revalidateNavigation } from "./helpers";

export async function toggleMenuItemVisibility(formData: FormData) {
  await requireAdminSession();
  const id = getNumber(formData, "id");
  const menuId = getNumber(formData, "menu_id") ?? (id ? await getMenuIdFromItem(id) : null);
  const isVisible = getBoolean(formData, "is_visible");
  if (!id) return menuInteractionFailure("menu_item_not_found", "العنصر غير موجود.");

  const { error } = await getSupabaseAdmin().from("menu_items").update({ is_visible: isVisible, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return menuInteractionFailure("menu_item_visibility_failed", error.message);

  await auditMenuAction("menu_item", "update", { entityId: id, metadata: { menu_id: menuId, is_visible: isVisible } });
  const mediaSynchronization = await revalidateNavigation();
  return menuInteractionSuccess(mediaSynchronization, "تم تغيير حالة العنصر.");
}
