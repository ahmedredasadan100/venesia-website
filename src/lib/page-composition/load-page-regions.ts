import "server-only";

import { cache } from "react";

import { getSupabaseAdmin } from "../supabase-admin";

export type PageRegionDefinition = Readonly<{
  key: string;
  adminLabel: string;
  sortOrder: number;
}>;

export type PageLayoutDefinition = Readonly<{
  id: number;
  key: string;
  adminLabel: string;
  regions: readonly PageRegionDefinition[];
}>;

function normalizeLayout(layout: {
  id: number;
  key: string;
  admin_label: string;
  page_composition_regions: Array<{ key: string; admin_label: string; sort_order: number }>;
}): PageLayoutDefinition {
  const regions = layout.page_composition_regions
    .map((region) => ({
      key: region.key,
      adminLabel: region.admin_label,
      sortOrder: region.sort_order,
    }))
    .sort((first, second) => first.sortOrder - second.sortOrder);
  if (!regions.length || new Set(regions.map((region) => region.key)).size !== regions.length) {
    throw new Error("Page Composition Layout returned invalid Regions.");
  }
  return { id: layout.id, key: layout.key, adminLabel: layout.admin_label, regions };
}

/** Page Composition owns this one request-scoped Layout read, independent of Region names. */
export const loadPageRegionsForPage = cache(async function loadPageRegionsForPage(
  pageId: number,
): Promise<PageLayoutDefinition> {
  const { data, error } = await getSupabaseAdmin()
    .from("pages")
    .select("layout_id,page_composition_layouts!pages_layout_id_fkey(id,key,admin_label,page_composition_regions(key,admin_label,sort_order))")
    .eq("id", pageId)
    .single();
  if (error || !data?.page_composition_layouts) {
    throw new Error(`Page Composition Layout read failed: ${error?.message ?? "missing Layout"}`);
  }
  const layout = data.page_composition_layouts;
  return normalizeLayout(layout);
});

/** Admin inventory for the same Layout/Region owner; no UI-owned registry. */
export const loadPageCompositionLayouts = cache(async function loadPageCompositionLayouts(): Promise<readonly PageLayoutDefinition[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("page_composition_layouts")
    .select("id,key,admin_label,page_composition_regions(key,admin_label,sort_order)")
    .order("id", { ascending: true });
  if (error) throw new Error(`Page Composition Layout inventory failed: ${error.message}`);
  return (data ?? []).map(normalizeLayout);
});
