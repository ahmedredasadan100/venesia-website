import { countMenuItemsByMenuIds } from "../../../../lib/admin/menus/count-menu-items";
import { readAdminColumnPreferences } from "../../../../lib/admin/preferences/admin-column-preferences";
import { getPageCompositionColumnPreferenceConfig } from "../../../../lib/page-blocks/admin-collection-columns";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import MenusTableClient, { type MenuListRow } from "./MenusTableClient";

export const dynamic = "force-dynamic";

export default async function MenusPage({
  searchParams,
}: {
  searchParams?: Promise<{ message?: string; notice?: string }> | { message?: string; notice?: string };
}) {
  const query = searchParams ? await searchParams : {};
  const message = query?.message ? decodeURIComponent(query.message) : null;

  const [menusResult, preference] = await Promise.all([
    getSupabaseAdmin()
      .from("menus")
      .select("id, name, slug, location, is_active")
      .order("id", { ascending: true }),
    readAdminColumnPreferences(
      getPageCompositionColumnPreferenceConfig("menus").viewKey,
    ),
  ]);
  const { data: menus, error } = menusResult;

  const menuRows = menus ?? [];
  const counts = error
    ? new Map<number, number>()
    : await countMenuItemsByMenuIds(menuRows.map((menu) => menu.id));

  const rows: MenuListRow[] = menuRows.map((menu) => ({
    id: menu.id,
    name: menu.name,
    slug: menu.slug,
    location: menu.location,
    is_active: Boolean(menu.is_active),
    item_count: counts.get(menu.id) ?? 0,
  }));

  return (
    <MenusTableClient
      menus={rows}
      message={message}
      messageWarning={query.notice === "saved_with_media_sync_warning"}
      loadError={error ? `حدث خطأ أثناء قراءة القوائم: ${error.message}` : null}
      initialVisibleColumns={preference.visibleColumns}
      preferenceError={preference.error}
    />
  );
}
