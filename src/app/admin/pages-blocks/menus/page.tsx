import { countMenuItemsByMenuIds } from "../../../../lib/admin/menus/count-menu-items";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import MenusTableClient, { type MenuListRow } from "./MenusTableClient";

export const dynamic = "force-dynamic";

export default async function MenusPage({
  searchParams,
}: {
  searchParams?: Promise<{ message?: string }> | { message?: string };
}) {
  const query = searchParams ? await searchParams : {};
  const message = query?.message ? decodeURIComponent(query.message) : null;

  const { data: menus, error } = await getSupabaseAdmin()
    .from("menus")
    .select("id, name, slug, location, is_active")
    .order("id", { ascending: true });

  if (error) {
    return (
      <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 text-red-100" dir="rtl">
        حدث خطأ أثناء قراءة القوائم: {error.message}
      </div>
    );
  }

  const menuRows = menus ?? [];
  const counts = await countMenuItemsByMenuIds(menuRows.map((menu) => menu.id));

  const rows: MenuListRow[] = menuRows.map((menu) => ({
    id: menu.id,
    name: menu.name,
    slug: menu.slug,
    location: menu.location,
    is_active: Boolean(menu.is_active),
    item_count: counts.get(menu.id) ?? 0,
  }));

  return <MenusTableClient menus={rows} message={message} />;
}
