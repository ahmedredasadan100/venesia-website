import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { getSupabaseAdmin } from "../supabase-admin";
import { logError } from "../logging";

export type PublishedPageRow = {
  id: number;
  title: string;
  slug: string;
  path: string;
  page_type: string;
  status: string;
};

async function queryPublishedPageBySlug(pageSlug: string): Promise<PublishedPageRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("pages")
    .select("id,title,slug,path,page_type,status")
    .eq("slug", pageSlug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    logError("getPublishedPageBySlug failed", error, { pageSlug, resource: `pages:${pageSlug}` });
    return null;
  }

  if (!data) return null;
  return data as PublishedPageRow;
}

/**
 * Shared published-page lookup for composition loaders (hero / blocks / feeds).
 * React cache() dedupes within a render; unstable_cache covers ISR across requests.
 */
export const getPublishedPageBySlug = cache(async function getPublishedPageBySlug(
  pageSlug: string,
): Promise<PublishedPageRow | null> {
  return unstable_cache(
    async () => queryPublishedPageBySlug(pageSlug),
    ["published-page-by-slug", pageSlug],
    { revalidate: 300, tags: ["pages", "page-composition", `page:${pageSlug}`] },
  )();
});
