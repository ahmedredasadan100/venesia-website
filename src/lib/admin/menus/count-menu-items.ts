import "server-only";

import { getSupabaseAdmin } from "../../supabase-admin";

export async function countMenuItemsByMenuIds(menuIds: number[]) {
  const counts = new Map<number, number>();
  if (!menuIds.length) return counts;

  menuIds.forEach((id) => counts.set(id, 0));

  await Promise.all(
    menuIds.map(async (menuId) => {
      const { count } = await getSupabaseAdmin()
        .from("menu_items")
        .select("id", { count: "exact", head: true })
        .eq("menu_id", menuId);

      counts.set(menuId, count ?? 0);
    }),
  );

  return counts;
}
