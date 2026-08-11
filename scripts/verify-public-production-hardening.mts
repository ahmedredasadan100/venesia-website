import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildPublicMenuTree } from "../src/lib/navigation/build-public-menu.ts";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) =>
  readFileSync(resolve(root, path), "utf8").replace(/\r\n?/g, "\n");

const visibility = read("src/lib/content-public-visibility.ts");
const topics = read("src/lib/topics/load-public-topics.ts");
const media = read("src/lib/media-center/unified-provider.ts");
const feeds = read("src/lib/feed-modules/resolve-topics-feed.ts");
const feedLoader = read("src/lib/feed-modules/load-feed-modules.ts");
const projects = read("src/lib/projects/load-published-projects.ts");
const pagesBySlug = read("src/lib/pages/get-published-page-by-slug.ts");
const sitemap = read("src/lib/seo/generate-sitemap-entries.ts");
const redirects = read("src/lib/redirects/load-active-redirects.ts");
const redirectResolver = read("src/lib/redirects/resolve-public-redirect.ts");
const layout = read("src/app/(site)/layout.tsx");
const pageBlocks = read("src/lib/page-blocks/load-page-blocks.ts");
const mediaHub = read("src/lib/media-hub-modules/resolve-hub-section-data.ts");
const mediaHubLoader = read("src/lib/media-hub-modules/load-media-hub-modules.ts");
const mediaSidebarLoader = read("src/lib/media-sidebar-modules/load-media-sidebar-modules.ts");
const navigation = read("src/lib/navigation/get-public-navigation.ts");
const navigationBuilder = read("src/lib/navigation/build-public-menu.ts");
const navigationApi = read("src/app/api/navigation/[location]/route.ts");
const navbar = read("src/components/SiteNavbar.tsx");
const hero = read("src/components/sections/DynamicHeroSection.tsx");
const homeProjects = read("src/components/home/HomeProjectsSection.tsx");

assert.ok(visibility.includes("export const PUBLIC_CONTENT_VISIBILITY_CONTRACT"));
for (const [label, source] of [
  ["topics", topics],
  ["media", media],
  ["feeds", feeds],
  ["projects", projects],
  ["pages", pagesBySlug],
  ["sitemap", sitemap],
] as const) {
  assert.ok(
    source.includes("PUBLIC_CONTENT_VISIBILITY_CONTRACT"),
    `${label} must consume the shared public visibility contract`,
  );
}

assert.ok(feeds.includes('.eq("topics.status", PUBLIC_CONTENT_VISIBILITY_CONTRACT.status)'));
assert.ok(feeds.includes('.eq("topics.content_type", "article")'));
assert.ok(feeds.includes('.is("topics.deleted_at", PUBLIC_CONTENT_VISIBILITY_CONTRACT.deletedAt)'));

assert.ok(redirects.includes("source_path: `eq.${sourcePath}`"));
assert.ok(redirects.includes('limit: "1"'));
assert.ok(redirects.includes('cache: "no-store"'));
assert.ok(!redirects.includes("loadActiveRedirectsForRuntime"));
assert.ok(redirectResolver.includes("loadActiveRedirectForRuntime(pathname)"));
assert.ok(!redirectResolver.includes("for (const rule"));

assert.ok(layout.includes("const [loadedFooterSettings, globalSeo, [navigationItems, footerNavItems]]"));
assert.ok(feedLoader.includes("const modules = await Promise.all("));
assert.ok(pageBlocks.includes("const blocks = await Promise.all(blockPromises)"));

assert.ok(mediaHub.includes("requiredTypes"));
assert.ok(mediaHub.includes("new Set("));
assert.ok(!mediaHub.includes("getFeaturedNews"));
assert.ok(pagesBySlug.includes("getPublishedPageStateBySlug"));
assert.ok(pagesBySlug.includes('sourceStatus: "error"'));
assert.ok(mediaHubLoader.includes("getPublishedPageStateBySlug(pageSlug)"));
assert.ok(mediaSidebarLoader.includes("getPublishedPageStateBySlug(pageSlug)"));

assert.ok(navigation.includes("getPublicNavigationSnapshot"));
assert.ok(navigation.includes('.select("id, is_active")'));
assert.ok((navigation.match(/\.eq\("is_active", true\)/g) ?? []).length >= 2);
assert.ok(navigation.includes('.eq("status", PUBLIC_CONTENT_VISIBILITY_CONTRACT.status)'));
assert.ok(navigation.includes('.eq("publication_status", PUBLIC_CONTENT_VISIBILITY_CONTRACT.status)'));
assert.ok(navigationBuilder.includes("if (!slug) return null"));
assert.ok(navigationBuilder.includes('item.item_type === "parent" && children.length === 0'));
assert.ok(navigationApi.includes("getPublicNavigationSnapshot(location)"));
assert.ok(!navigationApi.includes('from("menus")'));
assert.ok(navbar.includes("prefetch={prefetchEnabled ? null : false}"));
assert.ok(navbar.includes("prefetch={brandPrefetchEnabled ? null : false}"));
assert.ok(navbar.includes("aria-expanded={isSubmenuOpen}"));
assert.ok(navbar.includes("group-focus-within/media:visible"));
assert.ok(hero.includes("prefetch={prefetchEnabled ? null : false}"));
assert.ok(homeProjects.includes("prefetch={prefetchEnabled ? null : false}"));

const missingLinkedTargetTree = buildPublicMenuTree(
  [
    {
      id: 1,
      parent_id: null,
      label: "Parent",
      item_type: "parent",
      href: null,
      linked_type: null,
      linked_id: null,
      anchor: null,
      target: "_self",
      css_class: null,
      style_preset: null,
      is_visible: true,
      sort_order: 0,
    },
    {
      id: 2,
      parent_id: 1,
      label: "Unpublished Topic",
      item_type: "link",
      href: "/legacy-unpublished-topic",
      linked_type: "topics",
      linked_id: 99,
      anchor: null,
      target: "_self",
      css_class: null,
      style_preset: null,
      is_visible: true,
      sort_order: 0,
    },
  ],
  {
    topics: new Map(),
    topicCategories: new Map(),
    projects: new Map(),
  },
);
assert.deepEqual(missingLinkedTargetTree, []);

console.log(
  "PASS Public production hardening: one visibility contract, truthful counters, exact redirects, parallel public reads, canonical navigation owner, and intent-only prefetch are guarded.",
);
