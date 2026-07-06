import "server-only";

import { unstable_cache } from "next/cache";

import { getSupabaseAdmin } from "../supabase-admin";
import { logError } from "../logging";
import type { PublicNavigationItem } from "../public-navigation";
import {
  buildPublicMenuTree,
  getSlugMaps,
  type MenuItemRow,
} from "./build-public-menu";

const MENU_ITEM_SELECT =
  "id, parent_id, label, item_type, href, linked_type, linked_id, anchor, target, css_class, style_preset, is_visible, sort_order";

async function fetchSlugMap(table: "topics" | "topic_categories" | "projects", ids: number[]) {
  const slugMap = new Map<number, string>();
  if (!ids.length) return slugMap;

  const { data, error } = await getSupabaseAdmin().from(table).select("id, slug").in("id", ids);

  if (error) {
    logError(`Failed to resolve ${table} slugs for navigation`, error, { ids });
    return slugMap;
  }

  for (const row of data ?? []) {
    slugMap.set(Number(row.id), row.slug);
  }

  return slugMap;
}

async function getPublicNavigationItemsForMenuId(menuId: number): Promise<PublicNavigationItem[]> {
  const { data: rows, error: itemsError } = await getSupabaseAdmin()
    .from("menu_items")
    .select(MENU_ITEM_SELECT)
    .eq("menu_id", menuId)
    .eq("is_visible", true)
    .order("sort_order", { ascending: true });

  if (itemsError) {
    logError("Failed to load navigation menu items", itemsError, { menuId });
    return [];
  }

  const cleanRows = (rows ?? []) as MenuItemRow[];
  const maps = await getSlugMaps(cleanRows, fetchSlugMap);

  return buildPublicMenuTree(cleanRows, maps);
}

export async function getPublicNavigationItemsByMenuId(menuId: number): Promise<PublicNavigationItem[]> {
  if (!Number.isFinite(menuId) || menuId < 1) return [];

  const { data: menu, error: menuError } = await getSupabaseAdmin()
    .from("menus")
    .select("id, is_active")
    .eq("id", menuId)
    .eq("is_active", true)
    .maybeSingle();

  if (menuError) {
    logError("Failed to load navigation menu by id", menuError, { menuId });
    return [];
  }

  if (!menu) return [];

  return getPublicNavigationItemsForMenuId(menuId);
}

async function queryPublicNavigationItems(location: string): Promise<PublicNavigationItem[]> {
  const { data: menu, error: menuError } = await getSupabaseAdmin()
    .from("menus")
    .select("id, name, slug, location, is_active")
    .eq("location", location)
    .eq("is_active", true)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (menuError) {
    logError("Failed to load navigation menu", menuError, { location });
    return [];
  }

  if (!menu) return [];

  return getPublicNavigationItemsForMenuId(menu.id);
}

export async function getPublicNavigationItems(location = "main"): Promise<PublicNavigationItem[]> {
  return unstable_cache(
    async () => queryPublicNavigationItems(location),
    ["public-navigation", location],
    { revalidate: 300, tags: ["navigation", "menus"] },
  )();
}
