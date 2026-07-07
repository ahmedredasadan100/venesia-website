import "server-only";

import { getSupabaseAdmin } from "../../supabase-admin";
import { loadPageModuleCounts } from "./load-page-module-counts";

export type PagesTableRow = {
  id: number;
  title: string;
  slug: string;
  path: string;
  page_type: string;
  status: string;
  block_count: number;
};

export async function loadPagesTableRows(): Promise<PagesTableRow[]> {
  const { data: pages, error: loadError } = await getSupabaseAdmin()
    .from("pages")
    .select("id,title,slug,path,page_type,status")
    .order("id", { ascending: true });

  if (loadError) throw new Error(loadError.message);

  const pageRows = pages ?? [];
  const pageIds = pageRows.map((page) => page.id);
  const blockCounts = await loadPageModuleCounts(pageIds);

  return pageRows.map((page) => ({
    ...page,
    block_count: blockCounts.get(page.id) ?? 0,
  }));
}
