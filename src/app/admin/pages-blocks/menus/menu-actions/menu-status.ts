"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { auditMenuAction, getBoolean, getNumber, menuInteractionFailure, menuInteractionSuccess, revalidateNavigation } from "./helpers";

export async function toggleMenuVisibility(formData: FormData) {
  await requireAdminSession();
  const id = getNumber(formData, "id");
  const isActive = getBoolean(formData, "is_active");
  if (!id) return menuInteractionFailure("menu_not_found", "القائمة غير موجودة.");

  const { error } = await getSupabaseAdmin().from("menus").update({ is_active: isActive, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return menuInteractionFailure("menu_visibility_failed", error.message);

  await auditMenuAction("menu", "update", { entityId: id, metadata: { is_active: isActive } });
  const mediaSynchronization = await revalidateNavigation();
  return menuInteractionSuccess(mediaSynchronization, "تم تغيير حالة القائمة.");
}
