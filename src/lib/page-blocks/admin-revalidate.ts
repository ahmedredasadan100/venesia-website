import "server-only";

import { withAdminActionCacheWarning, type AdminActionResult } from "../admin/admin-action-result";

import { revalidatePath, revalidateTag } from "next/cache";
import {
  runBoundedPublicCacheRevalidation,
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

async function collectAssignedPublicPaths(affectedPageIds: readonly number[] = []) {
  // Keep detached pages in the same read as current assignments so their old
  // public path is invalidated after a module save, too.
  const pageIds = new Set(affectedPageIds);

  await Promise.all(
    ALL_ASSIGNMENT_TABLES.map(async (table) => {
      const { data, error } = await getSupabaseAdmin().from(table).select("page_id");
      if (error) throw new Error(`Assignment path read failed for ${table}: ${error.message}`);
      for (const row of data ?? []) {
        pageIds.add(row.page_id);
      }
    }),
  );

  return readPublicPathsForPageIds([...pageIds]);
}

async function readPublicPathsForPageIds(pageIds: readonly number[]) {
  const paths = new Set<string>(BASE_PUBLIC_PATHS);

  if (pageIds.length) {
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

export async function revalidatePublicPagesWithBlockAssignments(affectedPageIds: readonly number[] = []) {
  await revalidatePageCompositionCache();
  let paths: Set<string>;
  try {
    paths = await collectAssignedPublicPaths(affectedPageIds);
  } catch (error) {
    // An unrelated assignment read must not prevent invalidation of pages this
    // mutation already changed. Keep the successful path as one batched read.
    if (affectedPageIds.length) {
      try {
        const affectedPaths = await readPublicPathsForPageIds([...new Set(affectedPageIds)]);
        for (const path of affectedPaths) revalidateStoredPublicPagePath(path);
      } catch (fallbackError) {
        throw new AggregateError(
          [error, fallbackError],
          error instanceof Error ? error.message : "Page revalidation failed.",
          { cause: error },
        );
      }
    }
    // The original failure still reaches the bounded retry/warning owner.
    throw error;
  }

  for (const path of paths) {
    revalidateStoredPublicPagePath(path);
  }
}

export async function revalidateBlockModulePaths(
  modulePath: string,
  affectedPageIds: readonly number[] = [],
) {
  revalidatePath("/admin/pages-blocks/pages", "layout");
  for (const pageId of new Set(affectedPageIds)) {
    revalidatePath(`/admin/pages-blocks/pages/${pageId}`);
  }
  await revalidateBlockModuleCache(modulePath);
  await revalidatePublicPagesWithBlockAssignments(affectedPageIds);
}

export async function revalidatePageBlocksPath(pageId: number) {
  await revalidatePageCompositionCache();
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

/** Only an already-confirmed domain result reaches this cache-only boundary. */
export async function revalidateCommittedPageBlockAction<T extends AdminActionResult>(
  result: T,
  revalidate: () => void | Promise<void>,
): Promise<T> {
  if (!result.ok) return result;
  if (result.completion !== "committed") throw new Error("Cache settlement requires an acknowledged domain commit.");
  const cache = await runBoundedPublicCacheRevalidation(revalidate);
  if (!cache.ok) console.error("Page block mutation committed; cache revalidation failed", cache.error);
  return withAdminActionCacheWarning(result, cache.ok);
}
