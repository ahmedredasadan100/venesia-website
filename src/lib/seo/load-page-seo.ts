import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { getSupabaseAdmin } from "../supabase-admin";
import { logError } from "../logging";
import {
  ENTITY_SEO_SELECT,
  entitySeoDataFromPersistence,
  type EntitySeoData,
} from "./entity-seo-types";
import { normalizePath } from "./seo-utils";

async function queryPageSeoByPath(path: string): Promise<EntitySeoData | null> {
  const normalizedPath = normalizePath(path);

  const { data, error } = await getSupabaseAdmin()
    .from("pages")
    .select(`path,${ENTITY_SEO_SELECT}`)
    .eq("path", normalizedPath)
    .maybeSingle();

  if (error) {
    logError("loadPageSeoByPath failed", error, { path: normalizedPath, resource: `page-seo:${normalizedPath}` });
    throw new Error(error.message);
  }

  if (!data) return null;

  return entitySeoDataFromPersistence(data);
}

export const loadPageSeoByPath = cache(async function loadPageSeoByPath(
  path: string,
): Promise<EntitySeoData | null> {
  const normalizedPath = normalizePath(path);

  try {
    return await unstable_cache(
      async () => queryPageSeoByPath(normalizedPath),
      ["page-seo", normalizedPath],
      { revalidate: 300, tags: ["page-seo", "pages", `page-seo:${normalizedPath}`] },
    )();
  } catch (error) {
    logError("Page SEO safe rendering after source failure", error, { path: normalizedPath });
    return null;
  }
});
