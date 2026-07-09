"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { auditMenuAction, backToMenus, getNumber, getString, revalidateNavigation } from "./helpers";

export async function bulkMenuAction(formData: FormData) {
  await requireAdminSession();
  const action = getString(formData, "bulk_action");
  const ids = formData
    .getAll("menu_ids")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (!ids.length) backToMenus("اختار قائمة واحدة على الأقل.");

  if (action === "show" || action === "hide") {
    const { error } = await getSupabaseAdmin()
      .from("menus")
      .update({ is_active: action === "show", updated_at: new Date().toISOString() })
      .in("id", ids);

    if (error) backToMenus(error.message);
    await auditMenuAction("menu", "update", {
      metadata: { bulk_action: action, menu_ids: ids, is_active: action === "show" },
    });
    revalidateNavigation();
    backToMenus(action === "show" ? "تم إظهار القوائم المحددة." : "تم إخفاء القوائم المحددة.");
  }

  if (action === "delete") {
    await getSupabaseAdmin().from("menu_items").delete().in("menu_id", ids);
    const { error } = await getSupabaseAdmin().from("menus").delete().in("id", ids);

    if (error) backToMenus(error.message);
    await auditMenuAction("menu", "delete", { metadata: { bulk_action: action, menu_ids: ids } });
    revalidateNavigation();
    backToMenus("تم حذف القوائم المحددة.");
  }

  backToMenus("الإجراء الجماعي غير معروف.");
}

export async function clearMenuItems(formData: FormData) {
  await requireAdminSession();
  const id = getNumber(formData, "id");
  if (!id) backToMenus("القائمة غير موجودة.");

  const { error } = await getSupabaseAdmin().from("menu_items").delete().eq("menu_id", id);
  if (error) backToMenus(error.message);

  await auditMenuAction("menu_item", "delete", { entityId: id, metadata: { cleared_menu_id: id } });
  revalidateNavigation();
  backToMenus("تم تفريغ عناصر القائمة.");
}
