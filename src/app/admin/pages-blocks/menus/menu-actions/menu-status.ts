"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { auditMenuAction, backToMenus, getBoolean, getNumber, navigationMutationMessage, revalidateNavigation } from "./helpers";

export async function toggleMenuVisibility(formData: FormData) {
  await requireAdminSession();
  const id = getNumber(formData, "id");
  const isActive = getBoolean(formData, "is_active");
  if (!id) backToMenus("القائمة غير موجودة.");

  const { error } = await getSupabaseAdmin().from("menus").update({ is_active: isActive, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) backToMenus(error.message);

  await auditMenuAction("menu", "update", { entityId: id, metadata: { is_active: isActive } });
  const mediaSynchronization = await revalidateNavigation();
  backToMenus(navigationMutationMessage(mediaSynchronization, "تم تغيير حالة القائمة."));
}
