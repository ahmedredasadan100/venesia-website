"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { auditMenuAction, backToMenus, getNumber, revalidateNavigation } from "./helpers";

export async function deleteMenu(formData: FormData) {
  await requireAdminSession();
  const id = getNumber(formData, "id");
  if (!id) backToMenus("القائمة غير موجودة.");

  await getSupabaseAdmin().from("menu_items").delete().eq("menu_id", id);
  const { error } = await getSupabaseAdmin().from("menus").delete().eq("id", id);
  if (error) backToMenus(error.message);

  await auditMenuAction("menu", "delete", { entityId: id });
  revalidateNavigation();
  backToMenus("تم حذف القائمة.");
}
