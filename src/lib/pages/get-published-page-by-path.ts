import "server-only";

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

/**
 * Resolves one published CMS page by its exact public path.
 * Returns null when the page is missing, unpublished, or lookup fails.
 */
export async function getPublishedPageByPath(path: string): Promise<PublishedPageByPath | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("pages")
      .select("id,title,slug,path,seo_title,seo_description,focus_keyword,seo_keywords,canonical_url,robots_index,robots_follow,og_image,og_image_alt,status")
      .eq("path", path)
      .eq("status", "published")
      .maybeSingle();

    if (error) {
      logError("getPublishedPageByPath failed", error, { path });
      return null;
    }

    if (!data) {
      return null;
    }

    return {
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
    };
  } catch (error) {
    logError("getPublishedPageByPath unexpected failure", error, { path });
    return null;
  }
}
