import "server-only";

import { cache } from "react";

import { getSupabaseAdmin } from "../supabase-admin";
import { logError } from "../logging";
import type { EntitySeoPersistenceRecord } from "../seo/entity-seo-types";

export type PublishedPageByPath = EntitySeoPersistenceRecord & {
  id: number;
  title: string;
  slug: string;
  path: string;
  status: "published";
};

export type PublishedPageByPathLookupResult = {
  page: PublishedPageByPath | null;
  sourceStatus: "database" | "missing" | "error";
  sourceIssue?: string;
  sourceError?: unknown;
};

async function queryPublishedPageStateByPath(
  path: string,
): Promise<PublishedPageByPathLookupResult> {
  const { data, error } = await getSupabaseAdmin()
    .from("pages")
    .select("id,title,slug,path,seo_title,seo_description,focus_keyword,seo_keywords,canonical_url,robots_index,robots_follow,og_image,og_image_alt,status")
    .eq("path", path)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return {
      page: null,
      sourceStatus: "missing",
      sourceIssue: `Published page ${path} is not persisted.`,
    };
  }

  return {
    page: {
      id: data.id,
      title: data.title,
      slug: data.slug,
      path: data.path,
      seo_title: data.seo_title,
      seo_description: data.seo_description,
      focus_keyword: data.focus_keyword,
      seo_keywords: Array.isArray(data.seo_keywords) ? data.seo_keywords : [],
      canonical_url: data.canonical_url,
      robots_index: data.robots_index,
      robots_follow: data.robots_follow,
      og_image: data.og_image,
      og_image_alt: data.og_image_alt,
      status: "published",
    },
    sourceStatus: "database",
  };
}

/**
 * Resolves one published CMS page by its exact public path. React cache()
 * dedupes within one render without persisting a source failure across requests.
 */
export const getPublishedPageStateByPath = cache(
  async function getPublishedPageStateByPath(
    path: string,
  ): Promise<PublishedPageByPathLookupResult> {
    try {
      return await queryPublishedPageStateByPath(path);
    } catch (error) {
      logError("getPublishedPageByPath failed", error, { path });
      return {
        page: null,
        sourceStatus: "error",
        sourceIssue:
          error instanceof Error
            ? error.message
            : "Published page query failed.",
        sourceError: error,
      };
    }
  },
);

export const getPublishedPageByPath = cache(async function getPublishedPageByPath(
  path: string,
): Promise<PublishedPageByPath | null> {
  const state = await getPublishedPageStateByPath(path);

  if (state.sourceStatus === "error") {
    if (state.sourceError instanceof Error) {
      throw state.sourceError;
    }
    throw new Error(state.sourceIssue ?? "Published page query failed.");
  }

  return state.page;
});
