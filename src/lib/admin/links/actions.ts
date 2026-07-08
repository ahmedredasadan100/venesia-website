"use server";

import { getSupabaseAdmin } from "../../supabase-admin";
import { requireAdminSession } from "../auth/require-admin-session";
import {
  describeAdminLink,
  resolveAdminLink,
  searchAdminLinks,
  type AdminLinkValue,
  type LinkedResourceType,
  type LinkSearchResult,
} from "./index";

export type PickerMenuSummary = {
  id: number;
  name: string;
  location: string;
};

export type PickerMenuItemRow = {
  id: number;
  label: string;
  href: string | null;
  item_type: string;
  linked_type: string | null;
  linked_id: number | null;
  anchor: string | null;
  target: string;
  parent_id: number | null;
  is_visible: boolean;
  level: number;
};

export type PickerCategoryRow = LinkSearchResult & {
  parentId: number | null;
};

function matchesPickerQuery(parts: Array<string | null | undefined>, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return parts.some((part) => part?.toLowerCase().includes(normalized));
}

function orderTreeRows<T extends { id: number; parent_id: number | null }>(rows: T[]) {
  const byParent = new Map<number | null, T[]>();
  rows.forEach((row) => {
    const key = row.parent_id ?? null;
    const bucket = byParent.get(key);
    if (bucket) bucket.push(row);
    else byParent.set(key, [row]);
  });

  const ordered: Array<T & { level: number }> = [];
  function walk(parentId: number | null, level: number) {
    const children = byParent.get(parentId) ?? [];
    children.forEach((child) => {
      ordered.push({ ...child, level });
      walk(child.id, level + 1);
    });
  }
  walk(null, 0);
  return ordered;
}

export async function browseAdminLinksAjax(options: {
  type: LinkedResourceType;
  query?: string;
  limit?: number;
}) {
  await requireAdminSession();
  try {
    const results = await searchAdminLinks({
      query: options.query,
      types: [options.type],
      limit: options.limit ?? 100,
    });
    return { ok: true as const, results };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "تعذر تحميل الموارد.",
    };
  }
}

export async function browseMenusPickerAjax() {
  await requireAdminSession();
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("menus")
      .select("id,name,location")
      .order("id", { ascending: true });

    if (error) throw new Error(error.message);

    const menus: PickerMenuSummary[] = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      location: row.location,
    }));

    return { ok: true as const, menus };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "تعذر تحميل القوائم.",
    };
  }
}

export async function browseMenuItemsPickerAjax(options: { menuId: number; query?: string }) {
  await requireAdminSession();
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("menu_items")
      .select("id,label,href,item_type,linked_type,linked_id,anchor,target,parent_id,is_visible,sort_order")
      .eq("menu_id", options.menuId)
      .order("sort_order", { ascending: true });

    if (error) throw new Error(error.message);

    const query = options.query?.trim() ?? "";
    const ordered = orderTreeRows(
      (data ?? []).filter((row) => matchesPickerQuery([row.label, row.href, row.item_type], query)),
    );

    const items: PickerMenuItemRow[] = ordered.map((row) => ({
      id: row.id,
      label: row.label,
      href: row.href,
      item_type: row.item_type,
      linked_type: row.linked_type,
      linked_id: row.linked_id,
      anchor: row.anchor,
      target: row.target,
      parent_id: row.parent_id,
      is_visible: row.is_visible !== false,
      level: row.level,
    }));

    return { ok: true as const, items };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "تعذر تحميل عناصر القائمة.",
    };
  }
}

export async function browseTopicCategoriesPickerAjax(options?: { query?: string }) {
  await requireAdminSession();
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("topic_categories")
      .select("id,name,slug,parent_id,sort_order")
      .order("sort_order", { ascending: true });

    if (error) throw new Error(error.message);

    const query = options?.query?.trim() ?? "";
    const filtered = (data ?? []).filter((row) => matchesPickerQuery([row.name, row.slug], query));
    const ordered = orderTreeRows(filtered);

    const items: PickerCategoryRow[] = ordered.map((row) => ({
      id: `topic_categories:${row.id}`,
      resourceType: "topic_categories",
      resourceId: row.id,
      title: row.name,
      slug: row.slug,
      publicPath: `/topics?category=${row.slug}`,
      level: row.level,
      parentId: row.parent_id,
    }));

    return { ok: true as const, items };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "تعذر تحميل التصنيفات.",
    };
  }
}

export async function resolveAdminLinkAjax(value: AdminLinkValue) {
  await requireAdminSession();
  try {
    const [publicPath, display] = await Promise.all([resolveAdminLink(value), describeAdminLink(value)]);
    return { ok: true as const, publicPath, display };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "تعذر حل الرابط.",
    };
  }
}
