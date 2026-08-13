"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { mutateMenuTree, revalidateNavigation } from "./helpers";

export type MenuItemOrderingRevision = { id: number; updated_at: string };

export async function reorderMenuItems(
  menuId: number,
  parentId: number | null,
  items: MenuItemOrderingRevision[],
) {
  const actor = await requireAdminSession();
  if (!Number.isSafeInteger(menuId) || menuId <= 0 || !items.length) {
    return { ok: false as const, code: "invalid_reorder_payload", message: "بيانات الترتيب غير مكتملة." };
  }
  try {
    await mutateMenuTree(menuId, "reorder", { parent_id: parentId, items }, actor);
  } catch (error) {
    return { ok: false as const, code: "atomic_reorder_failed", message: error instanceof Error ? error.message : "تعذر حفظ الترتيب الذري." };
  }
  try {
    await revalidateNavigation();
    return {
      ok: true as const,
      code: "menu_reordered",
      message: "تم حفظ ترتيب عناصر القائمة.",
      feedbackStatus: "success" as const,
    };
  } catch (error) {
    console.error("Menu reorder committed but cache revalidation failed.", error);
    return {
      ok: true as const,
      code: "saved_with_cache_warning",
      message: "تم حفظ الترتيب، لكن تعذرت إعادة التحقق من الذاكرة المؤقتة.",
      feedbackStatus: "warning" as const,
    };
  }
}
