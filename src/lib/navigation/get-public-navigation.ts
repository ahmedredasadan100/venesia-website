import "server-only";

import { cachePublicRead } from "../cache/public-cache-generation";

import { cache } from "react";

import { getSupabaseAdmin } from "../supabase-admin";
import { logError } from "../logging";
import type { PublicNavigationItem } from "../public-navigation";
import { isContentType } from "../admin/content/content-types";
import { resolvePublicContentPath } from "../content/public-content-path";
import { resolvePagePublicPath } from "../pages/page-admin-policy";
import { getProjectHref } from "../projects/public-helpers";
import { getPublicPageRoute } from "../admin/links/static-routes";
import {
  buildPublicMenuTree,
  getNavigationTargetMaps,
  type NavigationTargetTable,
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

export async function fetchPublicNavigationTargetPaths(table: NavigationTargetTable, ids: number[]) {
  const targetPaths = new Map<number, string>();
  if (!ids.length) return targetPaths;

  const supabase = getSupabaseAdmin();
  const { data, error } = table === "topics"
    ? await supabase
        .from("topics")
        .select("id, slug, content_type")
        .in("id", ids)
        .eq("status", "published")
        .is("deleted_at", null)
    : table === "topic_categories" || table === "topic_series"
      ? await supabase
          .from(table)
          .select("id, slug")
          .in("id", ids)
          .eq("status", "published")
          .is("deleted_at", null)
      : table === "pages"
        ? await supabase.from("pages").select("id, slug, path").in("id", ids).eq("status", "published")
        : await supabase
          .from("projects")
          .select("id, slug")
          .in("id", ids)
          .eq("publication_status", "published");

  if (error) {
    logError(`Failed to resolve ${table} target paths for navigation`, error, { ids, table, resource: `nav-targets:${table}` });
    throw new Error(error.message);
  }

  for (const row of data ?? []) {
    let href: string | null = null;
    if (table === "topics") {
      if ("content_type" in row && isContentType(row.content_type)) {
        href = resolvePublicContentPath(row.content_type, row.slug);
      }
    } else if (table === "pages") {
      href = resolvePagePublicPath({ slug: row.slug, path: "path" in row && typeof row.path === "string" ? row.path : null });
    } else if (table === "projects") {
      href = getProjectHref(row);
    } else {
      const key = table === "topic_categories" ? "category" : "series";
      href = `${getPublicPageRoute("topics").href}?${key}=${encodeURIComponent(row.slug)}`;
    }
    if (href) targetPaths.set(Number(row.id), href);
  }

  return targetPaths;
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
    throw new Error(itemsError.message);
  }

  const cleanRows: MenuItemRow[] = rows ?? [];
  const maps = await getNavigationTargetMaps(cleanRows, fetchPublicNavigationTargetPaths);

  return buildPublicMenuTree(cleanRows, maps);
}

export const getPublicNavigationItemsByMenuId = cache(async function getPublicNavigationItemsByMenuId(
  menuId: number,
): Promise<PublicNavigationItem[]> {
  if (!Number.isFinite(menuId) || menuId < 1) return [];

  try {
    return await cachePublicRead(
      async () => {
        const { data: menu, error: menuError } = await getSupabaseAdmin()
          .from("menus")
          .select("id, is_active")
          .eq("id", menuId)
          .eq("is_active", true)
          .maybeSingle();

        if (menuError) {
          logError("Failed to load navigation menu by id", menuError, { menuId, resource: `menu:${menuId}` });
          throw new Error(menuError.message);
        }

        if (!menu) return [];

        return getPublicNavigationItemsForMenuId(menuId);
      },
      ["public-navigation-menu-id", String(menuId)],
      { revalidate: 300, tags: ["navigation", "menus", "public-content", "topics", "projects", "page-composition"] },
    )();
  } catch (error) {
    logError("Navigation safe rendering after source failure", error, { menuId });
    return [];
  }
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
    throw new Error(menuError.message);
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
  try {
    return await cachePublicRead(
      async () => queryPublicNavigationSnapshot(location),
      ["public-navigation-snapshot", location],
      { revalidate: 300, tags: ["navigation", "menus", "public-content", "topics", "projects", "page-composition"] },
    )();
  } catch (error) {
    logError("Navigation safe rendering after source failure", error, { location });
    return { menu: null, items: [] };
  }
});

export const getPublicNavigationItems = cache(async function getPublicNavigationItems(
  location = "main",
): Promise<PublicNavigationItem[]> {
  const snapshot = await getPublicNavigationSnapshot(location);
  return snapshot.items;
});
