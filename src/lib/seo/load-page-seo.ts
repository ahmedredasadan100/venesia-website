import "server-only";

import { unstable_cache } from "next/cache";

import { getSupabaseAdmin } from "../supabase-admin";
import { logError } from "../logging";
import type { PageSeoData } from "./entity-seo-types";
import { normalizePath } from "./seo-utils";

type DbPageSeoRow = {
  path: string;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
};

function mapPageSeoRow(row: DbPageSeoRow): PageSeoData {
  return {
    title: row.seo_title,
    description: row.seo_description,
    keywords: Array.isArray(row.seo_keywords) ? row.seo_keywords : null,
  };
}

async function queryPageSeoByPath(path: string): Promise<PageSeoData | null> {
  const normalizedPath = normalizePath(path);

  const { data, error } = await getSupabaseAdmin()
    .from("pages")
    .select("path, seo_title, seo_description, seo_keywords")
    .eq("path", normalizedPath)
    .maybeSingle<DbPageSeoRow>();

  if (error) {
    logError("loadPageSeoByPath failed", error, { path: normalizedPath });
    return null;
  }

  if (!data) return null;

  return mapPageSeoRow(data);
}

export async function loadPageSeoByPath(path: string): Promise<PageSeoData | null> {
  const normalizedPath = normalizePath(path);

  return unstable_cache(
    async () => queryPageSeoByPath(normalizedPath),
    ["page-seo", normalizedPath],
    { revalidate: 300, tags: ["page-seo", "pages", `page-seo:${normalizedPath}`] },
  )();
}
