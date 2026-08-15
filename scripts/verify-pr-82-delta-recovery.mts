import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildPublicMenuTree,
  type MenuItemRow,
} from "../src/lib/navigation/build-public-menu.ts";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\r\n?/gu, "\n");

const navigationOwner = read("src/lib/navigation/get-public-navigation.ts");
const navigationRoute = read("src/app/api/navigation/[location]/route.ts");
const redirectLoader = read("src/lib/redirects/load-active-redirects.ts");
const redirectResolver = read("src/lib/redirects/resolve-public-redirect.ts");
const pageOwner = read("src/lib/pages/get-published-page-by-slug.ts");
const mediaHubLoader = read("src/lib/media-hub-modules/load-media-hub-modules.ts");
const mediaSidebarLoader = read("src/lib/media-sidebar-modules/load-media-sidebar-modules.ts");
const mediaHubResolver = read("src/lib/media-hub-modules/resolve-hub-section-data.ts");
const feedResolver = read("src/lib/feed-modules/resolve-topics-feed.ts");
const feedLoader = read("src/lib/feed-modules/load-feed-modules.ts");
const pageBlockLoader = read("src/lib/page-blocks/load-page-blocks.ts");
const linkResolver = read("src/lib/admin/links/block-config-links.ts");
const siteLayout = read("src/app/(site)/layout.tsx");
const topicDetail = read("src/app/(site)/topics/[slug]/page.tsx");
const mediaDetail = read("src/components/media-center/MediaDetailPage.tsx");
const navbar = read("src/components/SiteNavbar.tsx");
const homeProjects = read("src/components/home/HomeProjectsSection.tsx");
const dynamicHero = read("src/components/sections/DynamicHeroSection.tsx");
const publicE2e = read("tests/e2e/public-foundation.spec.ts");

assert.ok(navigationOwner.includes('.eq("is_active", true)'));
assert.equal(
  navigationOwner.match(
    /\.eq\(\s*"status"\s*,\s*"published"\s*\)\s*\.is\(\s*"deleted_at"\s*,\s*null\s*\)/gu,
  )?.length,
  2,
);
assert.ok(navigationOwner.includes('.eq("publication_status", "published")'));
assert.ok(navigationRoute.includes("getPublicNavigationSnapshot"));
assert.equal(navigationRoute.includes("getSupabaseAdmin"), false);

const row = (input: Partial<MenuItemRow> & Pick<MenuItemRow, "id" | "label">): MenuItemRow => ({
  id: input.id,
  label: input.label,
  parent_id: input.parent_id ?? null,
  item_type: input.item_type ?? "link",
  href: input.href ?? null,
  linked_type: input.linked_type ?? null,
  linked_id: input.linked_id ?? null,
  anchor: input.anchor ?? null,
  target: input.target ?? "_self",
  css_class: input.css_class ?? null,
  style_preset: input.style_preset ?? null,
  is_visible: input.is_visible ?? true,
  sort_order: input.sort_order ?? 0,
});
const menu = buildPublicMenuTree(
  [
    row({ id: 1, label: "Empty", item_type: "parent" }),
    row({ id: 2, label: "Missing", linked_type: "topics", linked_id: 404 }),
    row({ id: 4, label: "Incomplete", linked_type: "projects" }),
    row({ id: 3, label: "Published", linked_type: "topics", linked_id: 7 }),
  ],
  {
    topics: new Map([[7, "published-topic"]]),
    topicCategories: new Map(),
    projects: new Map(),
  },
);
assert.deepEqual(menu.map(({ label, href }) => ({ label, href })), [
  { label: "Published", href: "/topics/published-topic" },
]);

assert.ok(redirectLoader.includes("source_path: `eq.${sourcePath}`"));
assert.ok(redirectLoader.includes('limit: "1"'));
assert.ok(redirectResolver.includes("loadActiveRedirectForRuntime(pathname)"));
assert.equal(redirectResolver.includes("for (const rule"), false);

assert.ok(pageOwner.includes("getPublishedPageStateBySlug"));
assert.ok(pageOwner.includes('sourceStatus: "database"'));
for (const loader of [mediaHubLoader, mediaSidebarLoader]) {
  assert.ok(loader.includes("getPublishedPageStateBySlug"));
  assert.equal(loader.includes('.from("pages")'), false);
}
assert.ok(mediaHubResolver.includes("requiredTypes"));
assert.ok(mediaHubResolver.includes("module.isVisible"));

assert.ok(feedResolver.includes('../content/public-content-read/owner'));
assert.ok(feedResolver.includes('.eq("topics.status", "published")'));
assert.ok(feedResolver.includes('.eq("topics.content_type", "article")'));
assert.ok(feedResolver.includes('.is("topics.deleted_at", null)'));
assert.equal(feedResolver.includes("PUBLIC_CONTENT_VISIBILITY_CONTRACT"), false);

for (const source of [feedLoader, pageBlockLoader, linkResolver, siteLayout, topicDetail, mediaDetail]) {
  assert.ok(source.includes("Promise.all("), "independent public reads must resolve in parallel");
}
assert.ok(mediaDetail.includes("globalSeoPromise"));
assert.ok(mediaDetail.includes("getRelatedMediaItems"));

for (const source of [navbar, homeProjects, dynamicHero]) {
  assert.ok(source.includes("prefetchEnabled ? null : false"));
  assert.ok(source.includes("onMouseEnter"));
  assert.ok(source.includes("onFocus"));
  assert.ok(source.includes("onTouchStart"));
}
assert.ok(
  navbar.includes(
    "const [brandPrefetchEnabled, setBrandPrefetchEnabled] = useState(false)",
  ),
);
assert.equal(
  navbar.match(/prefetch=\{brandPrefetchEnabled \? null : false\}/gu)?.length,
  2,
  "desktop and mobile brand links must defer prefetch until intent",
);
for (const handler of ["onMouseEnter", "onFocus", "onTouchStart"]) {
  assert.equal(
    navbar.match(new RegExp(`${handler}=\\{\\(\\) => setBrandPrefetchEnabled\\(true\\)\\}`, "gu"))
      ?.length,
    2,
    `desktop and mobile brand links must enable prefetch on ${handler}`,
  );
}
assert.ok(navbar.includes("group-focus-within/media:visible"));
assert.ok(navbar.includes("aria-expanded={isSubmenuOpen}"));
assert.ok(publicE2e.includes('page.route("**/api/content/topics/*/view"'));
assert.ok(publicE2e.includes("setTimeout(resolve, 1000)"));

console.log(
  "PASS PR #82 delta recovery: current owners preserve publication truth, exact redirects, shared page identity, parallel reads, and intent navigation.",
);
