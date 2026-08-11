import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { PUBLIC_CONTENT_VISIBILITY_CONTRACT } from "../content-public-visibility";
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

export type PublishedPageLookupResult = {
  page: PublishedPageRow | null;
  sourceStatus: "database" | "missing" | "error";
  sourceIssue?: string;
};

async function queryPublishedPageBySlug(pageSlug: string): Promise<PublishedPageLookupResult> {
  const { data, error } = await getSupabaseAdmin()
    .from("pages")
    .select("id,title,slug,path,page_type,status")
    .eq("slug", pageSlug)
    .eq("status", PUBLIC_CONTENT_VISIBILITY_CONTRACT.status)
    .maybeSingle();

  if (error) {
    logError("getPublishedPageBySlug failed", error, { pageSlug, resource: `pages:${pageSlug}` });
    return { page: null, sourceStatus: "error", sourceIssue: error.message };
  }

  if (!data) return { page: null, sourceStatus: "missing" };
  return { page: data as PublishedPageRow, sourceStatus: "database" };
}

/**
 * Shared published-page lookup for composition loaders (hero / blocks / feeds).
 * React cache() dedupes within a render; unstable_cache covers ISR across requests.
 */
export const getPublishedPageStateBySlug = cache(async function getPublishedPageStateBySlug(
  pageSlug: string,
): Promise<PublishedPageLookupResult> {
  return unstable_cache(
    async () => queryPublishedPageBySlug(pageSlug),
    ["published-page-state-by-slug", pageSlug],
    { revalidate: 300, tags: ["pages", "page-composition", `page:${pageSlug}`] },
  )();
});

export const getPublishedPageBySlug = cache(async function getPublishedPageBySlug(
  pageSlug: string,
): Promise<PublishedPageRow | null> {
  const result = await getPublishedPageStateBySlug(pageSlug);
  return result.page;
});
