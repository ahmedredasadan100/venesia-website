"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { auditMenuAction, backToMenu, getNumber, revalidateNavigation } from "./helpers";

export async function moveMenuItemSortOrder(formData: FormData) {
  await requireAdminSession();
  const menuId = getNumber(formData, "menu_id");
  const currentId = getNumber(formData, "current_id");
  const targetId = getNumber(formData, "target_id");
  if (!menuId || !currentId || !targetId) backToMenu(menuId, "تعذر إعادة الترتيب.");

  const { data: rows, error: loadError } = await getSupabaseAdmin()
    .from("menu_items")
    .select("id, sort_order")
    .eq("menu_id", menuId)
    .in("id", [currentId, targetId]);

  if (loadError || !rows || rows.length !== 2) backToMenu(menuId, loadError?.message ?? "تعذر إعادة الترتيب.");

  const current = rows.find((row) => Number(row.id) === currentId);
  const target = rows.find((row) => Number(row.id) === targetId);
  if (!current || !target) backToMenu(menuId, "تعذر إعادة الترتيب.");

  const currentOrder = Number(current.sort_order ?? 0);
  const targetOrder = Number(target.sort_order ?? 0);
  const now = new Date().toISOString();

  const { error: updateCurrentError } = await getSupabaseAdmin()
    .from("menu_items")
    .update({ sort_order: targetOrder, updated_at: now })
    .eq("id", currentId);

  if (updateCurrentError) backToMenu(menuId, updateCurrentError.message);

  const { error: updateTargetError } = await getSupabaseAdmin()
    .from("menu_items")
    .update({ sort_order: currentOrder, updated_at: now })
    .eq("id", targetId);

  if (updateTargetError) backToMenu(menuId, updateTargetError.message);

  await auditMenuAction("menu_item", "reorder", {
    entityId: currentId,
    metadata: { menu_id: menuId, target_id: targetId },
  });
  revalidateNavigation();
  backToMenu(menuId, "تم تحديث ترتيب العنصر.");
}
