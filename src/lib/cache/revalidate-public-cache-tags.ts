import "server-only";

import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { advancePublicCacheGeneration } from "./public-cache-generation";

export const PUBLIC_CACHE_TAG_GROUPS = {
  navigation: ["navigation", "menus"],
  footer: ["footer", "site-settings"],
  projects: ["projects", "project"],
  media: ["public-content", "media-center", "media-item", "media-sidebar"],
  pageComposition: ["page-composition", "hero", "page-blocks", "feed-modules", "media-center", "media-sidebar"],
  topics: ["public-content", "topics", "topic", "topic-related"],
  seo: ["seo-global", "site-settings", "page-seo", "projects", "public-content", "topics", "media-center"],
} as const;

export const PUBLIC_CACHE_REVALIDATION_MAX_ATTEMPTS = 2 as const;

export type BoundedPublicCacheRevalidationResult =
  | { ok: true; attempts: 1 | 2 }
  | { ok: false; attempts: 2; error: unknown };

/**
 * Retries an idempotent cache invalidation once. This is intentionally a
 * bounded in-request retry, not durable or crash-safe delivery.
 */
export async function runBoundedPublicCacheRevalidation(
  revalidate: () => void | Promise<void>,
): Promise<BoundedPublicCacheRevalidationResult> {
  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= PUBLIC_CACHE_REVALIDATION_MAX_ATTEMPTS;
    attempt += 1
  ) {
    try {
      await revalidate();
      return { ok: true, attempts: attempt as 1 | 2 };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    ok: false,
    attempts: PUBLIC_CACHE_REVALIDATION_MAX_ATTEMPTS,
    error: lastError,
  };
}

export function revalidatePublicCacheTags(tags: readonly string[]) {
  for (const tag of tags) {
    revalidateTag(tag, "max");
  }
}

async function updatePublicCacheTags(tags: readonly string[]) {
  await advancePublicCacheGeneration();
  for (const tag of tags) {
    updateTag(tag);
  }
}

export function revalidateNavigationCache() {
  revalidatePublicCacheTags(PUBLIC_CACHE_TAG_GROUPS.navigation);
}

export function revalidateFooterCache() {
  revalidatePublicCacheTags(PUBLIC_CACHE_TAG_GROUPS.footer);
}

export async function revalidateProjectsCache() {
  await updatePublicCacheTags(PUBLIC_CACHE_TAG_GROUPS.projects);
  revalidatePath("/sitemap.xml");
}

export function revalidateMediaCenterCache() {
  revalidatePublicCacheTags(PUBLIC_CACHE_TAG_GROUPS.media);
  revalidatePath("/sitemap.xml");
}

export function revalidateTopicsCache() {
  revalidatePublicCacheTags([
    ...PUBLIC_CACHE_TAG_GROUPS.topics,
    "media-center",
    "feed-modules",
  ]);
  revalidatePath("/sitemap.xml");
}

export function revalidateGlobalSeoCaches() {
  revalidatePublicCacheTags(PUBLIC_CACHE_TAG_GROUPS.seo);
  revalidatePath("/", "layout");
  revalidatePath("/robots.txt");
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/seo/meta-manager");
  revalidatePath("/admin/seo/sitemap");
}

export async function revalidatePageCompositionCache() {
  await updatePublicCacheTags(PUBLIC_CACHE_TAG_GROUPS.pageComposition);
}

export async function revalidateHeroCache() {
  await updatePublicCacheTags(["page-composition", "hero"]);
}

export async function revalidatePageBlocksCache() {
  await updatePublicCacheTags(["page-composition", "page-blocks"]);
}

export async function revalidateFeedModulesCache() {
  await updatePublicCacheTags(["page-composition", "feed-modules"]);
}

export async function revalidateMediaSidebarCache() {
  await updatePublicCacheTags(["page-composition", "media-center", "media-sidebar"]);
}

export async function revalidateBlockModuleCache(modulePath: string) {
  if (modulePath === "feed") {
    await revalidateFeedModulesCache();
    return;
  }

  if (modulePath === "media-sidebar") {
    await revalidateMediaSidebarCache();
    return;
  }

  if (modulePath === "hero") {
    await revalidateHeroCache();
    return;
  }

  await revalidatePageBlocksCache();
}

/** Explicit expire:0 has the same immediate fence as updateTag. */
export async function expirePublicCacheTags(tags: readonly string[]) {
  await advancePublicCacheGeneration();
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
}
