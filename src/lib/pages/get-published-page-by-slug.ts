import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import type { Tables } from "../database.types";
import { getSupabaseAdmin } from "../supabase-admin";
import { logError } from "../logging";

export type PublishedPageRow = Pick<
  Tables<"pages">,
  "id" | "title" | "slug" | "path" | "page_type" | "status"
>;

export type PublishedPageLookupResult = {
  page: PublishedPageRow | null;
  sourceStatus: "database" | "missing" | "error";
  sourceIssue?: string;
};

async function queryPublishedPageStateBySlug(pageSlug: string): Promise<PublishedPageLookupResult> {
  const { data, error } = await getSupabaseAdmin()
    .from("pages")
    .select("id,title,slug,path,page_type,status")
    .eq("slug", pageSlug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    logError("getPublishedPageBySlug failed", error, { pageSlug, resource: `pages:${pageSlug}` });
    return { page: null, sourceStatus: "error", sourceIssue: error.message };
  }

  if (!data) {
    return {
      page: null,
      sourceStatus: "missing",
      sourceIssue: `Published page ${pageSlug} is not persisted.`,
    };
  }

  return { page: data, sourceStatus: "database" };
}

/**
 * Shared published-page lookup for composition loaders (hero / blocks / feeds).
 * React cache() dedupes within a render; unstable_cache covers ISR across requests.
 */
export const getPublishedPageStateBySlug = cache(async function getPublishedPageStateBySlug(
  pageSlug: string,
): Promise<PublishedPageLookupResult> {
  return unstable_cache(
    async () => queryPublishedPageStateBySlug(pageSlug),
    ["published-page-state-by-slug", pageSlug],
    { revalidate: 300, tags: ["pages", "page-composition", `page:${pageSlug}`] },
  )();
});

export const getPublishedPageBySlug = cache(async function getPublishedPageBySlug(
  pageSlug: string,
): Promise<PublishedPageRow | null> {
  const state = await getPublishedPageStateBySlug(pageSlug);
  return state.page;
});
