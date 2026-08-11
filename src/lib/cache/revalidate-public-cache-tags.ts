import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

export const PUBLIC_CACHE_TAG_GROUPS = {
  navigation: ["navigation", "menus"],
  footer: ["footer", "site-settings"],
  projects: ["projects", "project"],
  media: ["public-content", "media-center", "media-item", "media-sidebar"],
  pageComposition: ["page-composition", "hero", "page-blocks", "feed-modules", "media-center", "media-sidebar"],
  topics: ["public-content", "topics", "topic", "topic-related"],
  seo: ["seo-global", "site-settings", "page-seo", "projects", "public-content", "topics", "media-center"],
} as const;

export function revalidatePublicCacheTags(tags: readonly string[]) {
  for (const tag of tags) {
    revalidateTag(tag, "max");
  }
}

export function revalidateNavigationCache() {
  revalidatePublicCacheTags(PUBLIC_CACHE_TAG_GROUPS.navigation);
}

export function revalidateFooterCache() {
  revalidatePublicCacheTags(PUBLIC_CACHE_TAG_GROUPS.footer);
}

export function revalidateProjectsCache() {
  revalidatePublicCacheTags(PUBLIC_CACHE_TAG_GROUPS.projects);
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

export function revalidatePageCompositionCache() {
  revalidatePublicCacheTags(PUBLIC_CACHE_TAG_GROUPS.pageComposition);
}

export function revalidateHeroCache() {
  revalidatePublicCacheTags(["page-composition", "hero"]);
}

export function revalidatePageBlocksCache() {
  revalidatePublicCacheTags(["page-composition", "page-blocks"]);
}

export function revalidateFeedModulesCache() {
  revalidatePublicCacheTags(["page-composition", "feed-modules"]);
}

export function revalidateMediaSidebarCache() {
  revalidatePublicCacheTags(["page-composition", "media-center", "media-sidebar"]);
}

export function revalidateBlockModuleCache(modulePath: string) {
  if (modulePath === "feed") {
    revalidateFeedModulesCache();
    return;
  }

  if (modulePath === "media-sidebar") {
    revalidateMediaSidebarCache();
    return;
  }

  if (modulePath === "hero") {
    revalidateHeroCache();
    return;
  }

  revalidatePageBlocksCache();
}
