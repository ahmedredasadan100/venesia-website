import "server-only";

import { getSupabaseAdmin } from "../supabase-admin";
import { logError } from "../logging";

export type PublishedPageByPath = {
  id: number;
  title: string;
  slug: string;
  path: string;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  status: "published";
};

type DbPublishedPageRow = {
  id: number;
  title: string;
  slug: string;
  path: string;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  status: string;
};

/**
 * Resolves one published CMS page by its exact public path.
 * Returns null when the page is missing, unpublished, or lookup fails.
 */
export async function getPublishedPageByPath(path: string): Promise<PublishedPageByPath | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("pages")
      .select("id,title,slug,path,seo_title,seo_description,seo_keywords,status")
      .eq("path", path)
      .eq("status", "published")
      .maybeSingle<DbPublishedPageRow>();

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
      seo_keywords: Array.isArray(data.seo_keywords) ? data.seo_keywords : null,
      status: "published",
    };
  } catch (error) {
    logError("getPublishedPageByPath unexpected failure", error, { path });
    return null;
  }
}
