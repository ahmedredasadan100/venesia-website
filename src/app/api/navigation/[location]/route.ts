import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { logError } from "../../../../lib/logging";
import { buildPublicMenuTree, getSlugMaps, type MenuItemRow } from "../../../../lib/navigation/build-public-menu";

const MENU_ITEM_SELECT =
  "id, parent_id, label, item_type, href, linked_type, linked_id, anchor, target, css_class, style_preset, is_visible, sort_order";

async function fetchSlugMap(table: "topics" | "topic_categories" | "projects", ids: number[]) {
  const slugMap = new Map<number, string>();
  if (!ids.length) return slugMap;

  const { data, error } = await getSupabaseAdmin().from(table).select("id, slug").in("id", ids);

  if (error) {
    logError(`Failed to resolve ${table} slugs for navigation API`, error, { ids });
    return slugMap;
  }

  for (const row of data ?? []) {
    slugMap.set(Number(row.id), row.slug);
  }

  return slugMap;
}

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ location: string }> },
) {
  const { location: locationParam } = await params;
  const location = locationParam || "main";

  const { data: menu, error: menuError } = await getSupabaseAdmin()
    .from("menus")
    .select("id, name, slug, location, is_active")
    .eq("location", location)
    .eq("is_active", true)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (menuError) {
    logError("Navigation API: menu lookup failed", menuError, { location });
    return NextResponse.json({ source: "database", items: [] }, { status: 200 });
  }

  if (!menu) {
    return NextResponse.json({ source: "database", items: [] }, { status: 200 });
  }

  const { data: rows, error: itemsError } = await getSupabaseAdmin()
    .from("menu_items")
    .select(MENU_ITEM_SELECT)
    .eq("menu_id", menu.id)
    .eq("is_visible", true)
    .order("sort_order", { ascending: true });

  if (itemsError) {
    logError("Navigation API: menu items lookup failed", itemsError, { location, menuId: menu.id });
    return NextResponse.json({ source: "database", items: [] }, { status: 200 });
  }

  const cleanRows = (rows ?? []) as MenuItemRow[];
  const maps = await getSlugMaps(cleanRows, fetchSlugMap);

  return NextResponse.json({
    source: "database",
    menu: {
      id: menu.id,
      name: menu.name,
      slug: menu.slug,
      location: menu.location,
    },
    items: buildPublicMenuTree(cleanRows, maps),
  });
}
