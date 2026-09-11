import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { findPublicPageRouteByCmsSlug } from "../admin/links/static-routes";
import type { Tables } from "../database.types";
import { getSupabaseAdmin } from "../supabase-admin";
import { logError } from "../logging";

export type PublishedPageRow = Pick<
  Tables<"pages">,
  "id" | "title" | "slug" | "path" | "page_type" | "status"
>;

/** Runtime identity shared by public page shells and composition consumers. */
export type PublicPageIdentity = {
  id: PublishedPageRow["id"];
  title: PublishedPageRow["title"];
  slug: PublishedPageRow["slug"];
  path: PublishedPageRow["path"];
  pageType: PublishedPageRow["page_type"];
};

export type PublishedPageLookupResult = {
  page: PublishedPageRow | null;
  sourceStatus: "database" | "missing" | "error";
  sourceIssue?: string;
};

async function queryPublishedPageStateBySlug(
  pageSlug: string,
): Promise<PublishedPageLookupResult> {
  const { data, error } = await getSupabaseAdmin()
    .from("pages")
    .select("id,title,slug,path,page_type,status")
    .eq("slug", pageSlug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    // A rejected cached read is retried on the next request; returning an
    // error-shaped value here would persist a transient source failure.
    throw new Error(error.message);
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

export function toPublicPageIdentity(
  page: PublishedPageRow,
): PublicPageIdentity {
  const registeredRoute = findPublicPageRouteByCmsSlug(page.slug);
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    path: registeredRoute?.href ?? page.path,
    pageType: page.page_type,
  };
}

/**
 * Shared published-page lookup for composition loaders (hero / blocks / feeds).
 * React cache() dedupes within a render; unstable_cache covers ISR across requests.
 */
export const getPublishedPageStateBySlug = cache(
  async function getPublishedPageStateBySlug(
    pageSlug: string,
  ): Promise<PublishedPageLookupResult> {
    try {
      return await unstable_cache(
        async () => queryPublishedPageStateBySlug(pageSlug),
        ["published-page-state-by-slug", pageSlug],
        {
          revalidate: 300,
          tags: ["pages", "page-composition", `page:${pageSlug}`],
        },
      )();
    } catch (error) {
      logError("getPublishedPageBySlug failed", error, {
        pageSlug,
        resource: `pages:${pageSlug}`,
      });
      return {
        page: null,
        sourceStatus: "error",
        sourceIssue:
          error instanceof Error
            ? error.message
            : "Published page query failed.",
      };
    }
  },
);

export const getPublishedPageBySlug = cache(async function getPublishedPageBySlug(
  pageSlug: string,
): Promise<PublishedPageRow | null> {
  const state = await getPublishedPageStateBySlug(pageSlug);
  return state.page;
});
