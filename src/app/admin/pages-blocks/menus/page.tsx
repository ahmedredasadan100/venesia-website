import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import MenusTableClient, { type MenuListRow } from "./MenusTableClient";

export const dynamic = "force-dynamic";

type MenuItemCountRow = {
  menu_id: number | string | null;
};

export default async function MenusPage({
  searchParams,
}: {
  searchParams?: Promise<{ message?: string }> | { message?: string };
}) {
  const query = searchParams ? await searchParams : {};
  const message = query?.message ? decodeURIComponent(query.message) : null;

  const [menusResult, countsResult] = await Promise.all([
    getSupabaseAdmin()
      .from("menus")
      .select("id, name, slug, location, is_active")
      .order("id", { ascending: true }),
    getSupabaseAdmin().from("menu_items").select("menu_id"),
  ]);

  const counts = new Map<number, number>();
  ((countsResult.data ?? []) as MenuItemCountRow[]).forEach((row) => {
    const menuId = Number(row.menu_id);
    counts.set(menuId, (counts.get(menuId) ?? 0) + 1);
  });

  const menus: MenuListRow[] = (menusResult.data ?? []).map((menu) => ({
    id: menu.id,
    name: menu.name,
    slug: menu.slug,
    location: menu.location,
    is_active: Boolean(menu.is_active),
    item_count: counts.get(menu.id) ?? 0,
  }));

  return <MenusTableClient menus={menus} message={message} />;
}
