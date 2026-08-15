import "server-only";

import { cache } from "react";
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

export type PublicNavigationSnapshot = {
  menu: {
    id: number;
    name: string;
    slug: string;
    location: string;
  } | null;
  items: PublicNavigationItem[];
};

async function fetchSlugMap(table: "topics" | "topic_categories" | "projects", ids: number[]) {
  const slugMap = new Map<number, string>();
  if (!ids.length) return slugMap;

  const supabase = getSupabaseAdmin();
  const { data, error } = table === "topics"
    ? await supabase
        .from("topics")
        .select("id, slug")
        .in("id", ids)
        .eq("status", "published")
        .is("deleted_at", null)
    : table === "topic_categories"
      ? await supabase
          .from("topic_categories")
          .select("id, slug")
          .in("id", ids)
          .eq("status", "published")
          .is("deleted_at", null)
      : await supabase
          .from("projects")
          .select("id, slug")
          .in("id", ids)
          .eq("publication_status", "published");

  if (error) {
    logError(`Failed to resolve ${table} slugs for navigation`, error, { ids, table, resource: `nav-slugs:${table}` });
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
    logError("Failed to load navigation menu items", itemsError, { menuId, resource: `menu-items:${menuId}` });
    return [];
  }

  const cleanRows: MenuItemRow[] = rows ?? [];
  const maps = await getSlugMaps(cleanRows, fetchSlugMap);

  return buildPublicMenuTree(cleanRows, maps);
}

export const getPublicNavigationItemsByMenuId = cache(async function getPublicNavigationItemsByMenuId(
  menuId: number,
): Promise<PublicNavigationItem[]> {
  if (!Number.isFinite(menuId) || menuId < 1) return [];

  return unstable_cache(
    async () => {
      const { data: menu, error: menuError } = await getSupabaseAdmin()
        .from("menus")
        .select("id, is_active")
        .eq("id", menuId)
        .eq("is_active", true)
        .maybeSingle();

      if (menuError) {
        logError("Failed to load navigation menu by id", menuError, { menuId, resource: `menu:${menuId}` });
        return [];
      }

      if (!menu) return [];

      return getPublicNavigationItemsForMenuId(menuId);
    },
    ["public-navigation-menu-id", String(menuId)],
    { revalidate: 300, tags: ["navigation", "menus"] },
  )();
});

async function queryPublicNavigationSnapshot(location: string): Promise<PublicNavigationSnapshot> {
  const { data: menu, error: menuError } = await getSupabaseAdmin()
    .from("menus")
    .select("id, name, slug, location, is_active")
    .eq("location", location)
    .eq("is_active", true)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (menuError) {
    logError("Failed to load navigation menu", menuError, { location, resource: `menu-location:${location}` });
    return { menu: null, items: [] };
  }

  if (!menu) return { menu: null, items: [] };

  return {
    menu: {
      id: menu.id,
      name: menu.name,
      slug: menu.slug,
      location: menu.location,
    },
    items: await getPublicNavigationItemsForMenuId(menu.id),
  };
}

export const getPublicNavigationSnapshot = cache(async function getPublicNavigationSnapshot(
  location = "main",
): Promise<PublicNavigationSnapshot> {
  return unstable_cache(
    async () => queryPublicNavigationSnapshot(location),
    ["public-navigation-snapshot", location],
    { revalidate: 300, tags: ["navigation", "menus"] },
  )();
});

export const getPublicNavigationItems = cache(async function getPublicNavigationItems(
  location = "main",
): Promise<PublicNavigationItem[]> {
  const snapshot = await getPublicNavigationSnapshot(location);
  return snapshot.items;
});
