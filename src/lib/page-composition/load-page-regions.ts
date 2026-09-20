import "server-only";

import { cache } from "react";

import { getSupabaseAdmin } from "../supabase-admin";

export type PageRegionDefinition = Readonly<{
  key: string;
  adminLabel: string;
  sortOrder: number;
}>;

export type PageLayoutDefinition = Readonly<{
  key: string;
  regions: readonly PageRegionDefinition[];
}>;

/** Page Composition owns this one request-scoped Layout read, independent of Region names. */
export const loadPageRegionsForPage = cache(async function loadPageRegionsForPage(
  pageId: number,
): Promise<PageLayoutDefinition> {
  const { data, error } = await getSupabaseAdmin()
    .from("pages")
    .select("layout_id,page_composition_layouts!pages_layout_id_fkey(key,page_composition_regions(key,admin_label,sort_order))")
    .eq("id", pageId)
    .single();
  if (error || !data?.page_composition_layouts) {
    throw new Error(`Page Composition Layout read failed: ${error?.message ?? "missing Layout"}`);
  }
  const layout = data.page_composition_layouts;
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
  return { key: layout.key, regions };
});
