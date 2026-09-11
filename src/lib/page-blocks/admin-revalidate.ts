import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import {
  revalidateBlockModuleCache,
  revalidatePageCompositionCache,
} from "../cache/revalidate-public-cache-tags";
import { getSupabaseAdmin } from "../supabase-admin";
import {
  findPublicPageRouteByCmsSlug,
  PUBLIC_STATIC_PAGE_ROUTES,
} from "../admin/links/static-routes";
import { normalizePath } from "../seo/seo-utils";

import { ALL_ASSIGNMENT_TABLES } from "./block-module-registry";

const BASE_PUBLIC_PATHS = PUBLIC_STATIC_PAGE_ROUTES.map((route) => route.href);

function revalidateStoredPublicPagePath(path: string | null | undefined) {
  if (!path) return;

  const normalizedPath = normalizePath(path);
  revalidatePath(normalizedPath);
  revalidateTag(`page-seo:${normalizedPath}`, "max");
}

function addPagePaths(paths: Set<string>, page?: { path: string | null; slug: string | null } | null) {
  if (!page) return;
  if (page.path) paths.add(page.path);
  const registeredRoute = page.slug
    ? findPublicPageRouteByCmsSlug(page.slug)
    : null;
  if (registeredRoute) paths.add(registeredRoute.href);
}

async function collectAssignedPublicPaths() {
  const pageIds = new Set<number>();

  await Promise.all(
    ALL_ASSIGNMENT_TABLES.map(async (table) => {
      const { data, error } = await getSupabaseAdmin().from(table).select("page_id");
      if (error) throw new Error(`Assignment path read failed for ${table}: ${error.message}`);
      for (const row of data ?? []) {
        pageIds.add(row.page_id);
      }
    }),
  );

  const paths = new Set<string>(BASE_PUBLIC_PATHS);

  if (pageIds.size) {
    const { data: pages, error } = await getSupabaseAdmin()
      .from("pages")
      .select("path,slug")
      .in("id", [...pageIds]);

    if (error) throw new Error(`Assigned page path read failed: ${error.message}`);

    for (const page of pages ?? []) {
      addPagePaths(paths, page);
    }
  }

  return paths;
}

export async function revalidatePublicPagesWithBlockAssignments() {
  revalidatePageCompositionCache();
  const paths = await collectAssignedPublicPaths();

  for (const path of paths) {
    revalidateStoredPublicPagePath(path);
  }
}

export async function revalidateBlockModulePaths(modulePath: string) {
  revalidatePath("/admin/pages-blocks/pages", "layout");
  revalidateBlockModuleCache(modulePath);
  await revalidatePublicPagesWithBlockAssignments();
}

export async function revalidatePageBlocksPath(pageId: number) {
  revalidatePageCompositionCache();
  revalidatePath("/admin/pages-blocks/pages", "layout");
  revalidatePath(`/admin/pages-blocks/pages/${pageId}`);

  const { data: page, error } = await getSupabaseAdmin()
    .from("pages")
    .select("path,slug")
    .eq("id", pageId)
    .maybeSingle();

  if (error) throw new Error(`Page revalidation path read failed: ${error.message}`);

  const paths = new Set<string>(BASE_PUBLIC_PATHS);
  addPagePaths(paths, page);

  for (const path of paths) {
    revalidateStoredPublicPagePath(path);
  }
}
