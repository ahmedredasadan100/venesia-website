import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

const contract = read("src/lib/content/public-content-read/contract.ts");
const owner = read("src/lib/content/public-content-read/owner.ts");
const publicEntry = read("src/lib/content/public-content-read/index.ts");
const publicPaths = read("src/lib/content/public-content-path.ts");
const contentTypes = read("src/lib/admin/content/content-types.ts");
const input = read("src/components/public/PublicContentSearchInput.tsx");
const topicsPage = read("src/app/(site)/topics/page.tsx");
const topicsAdapter = read("src/lib/topics/load-public-topics.ts");
const topicsListing = read("src/components/topics/TopicsListingContent.tsx");
const topicsSearchPanel = read("src/components/topics/TopicsSidebarSearchPanel.tsx");
const mediaPage = read("src/components/media-center/MediaListingPage.tsx");
const mediaListing = read("src/components/media-center/MediaListingContent.tsx");
const mediaShell = read("src/components/media-center/MediaPageShell.tsx");
const mediaSidebar = read("src/components/media-center/MediaSidebar.tsx");
const mediaAdapter = read("src/lib/media-center/unified-provider.ts");
const mediaTypes = read("src/lib/media-center/types.ts");
const hero = read("src/lib/load-hero-section.ts");
const feed = read("src/lib/feed-modules/resolve-topics-feed.ts");
const sitemap = read("src/lib/seo/generate-sitemap-entries.ts");
const cacheTags = read("src/lib/cache/revalidate-public-cache-tags.ts");

assert.equal(
  (contract.match(/export type PublicContentCollectionInput\b/g) ?? []).length,
  1,
  "There must be exactly one Public Collection input contract",
);
assert.equal(
  (contract.match(/export type PublicContentCollectionResult\b/g) ?? []).length,
  1,
  "There must be exactly one Public Collection output contract",
);
assert.ok(contract.includes("contentTypes: readonly ContentType[]"));
assert.ok(contract.includes("items: PublicContentSummary[]"));
assert.ok(!existsSync(resolve(ROOT, "src/lib/public-content-search.ts")));
assert.ok(publicEntry.includes('export * from "./contract"'));
assert.ok(!publicEntry.includes("owner"), "Client-safe contract entry must not expose the server owner");

for (const field of [
  "title",
  "excerpt",
  "seo_description",
  "slug",
  "category",
  "category_slug",
  "series",
  "series_slug",
  "date_label",
  "media_project",
]) {
  assert.ok(contract.includes(`"${field}"`), `Shared search contract is missing ${field}`);
}
assert.ok(contract.includes('normalize("NFKC")'));
assert.ok(contract.includes('.replace(/[\\u200B-\\u200D\\uFEFF]/gu, "")'));
assert.ok(contract.includes('.replace(/[%_*]/gu, "\\\\$&")'));
assert.ok(contract.includes("PUBLIC_CONTENT_SEARCH_FIELDS.map"));

assert.ok(owner.includes('from("topics")'));
assert.ok(owner.includes('eq("status", "published")'));
assert.ok(owner.includes('is("deleted_at", null)'));
assert.ok(owner.includes("resolvePublicContentPath"));
assert.ok(owner.includes("loadPublicContentCollection"));
assert.ok(owner.includes('tags: [PUBLIC_CONTENT_CACHE_TAG]'));
assert.ok(cacheTags.includes('"public-content"'));

const collectionSelect = owner.match(/PUBLIC_CONTENT_COLLECTION_SELECT =\s*\n?\s*"([^"]+)"/)?.[1] ?? "";
const detailSelect = owner.match(/PUBLIC_CONTENT_DETAIL_SELECT =\s*\n?\s*"([^"]+)"/)?.[1] ?? "";
const sitemapSelect = owner.match(/PUBLIC_CONTENT_SITEMAP_SELECT =\s*\n?\s*"([^"]+)"/)?.[1] ?? "";
assert.ok(collectionSelect && !collectionSelect.split(", ").includes("content"));
for (const forbidden of [
  "seo_title",
  "seo_keywords",
  "canonical_url",
  "robots_index",
  "faq",
  "media_payload",
]) {
  assert.ok(!collectionSelect.split(", ").includes(forbidden), `Collection projection over-fetches ${forbidden}`);
}
assert.ok(detailSelect.includes("content") && detailSelect.includes("seo_title"));
assert.ok(collectionSelect.includes("media_duration:media_payload->>duration"));
assert.ok(collectionSelect.includes("media_gallery_cover:media_payload->images->0->>url"));
assert.ok(sitemapSelect.includes("updated_at") && !sitemapSelect.includes("title"));

for (const [label, source] of [
  ["Topics adapter", topicsAdapter],
  ["Media adapter", mediaAdapter],
] as const) {
  assert.ok(source.includes("loadPublicContentCollection"), `${label} must adopt the owner`);
  assert.ok(!source.includes('.from("topics")'), `${label} must not own a database read`);
  assert.ok(!source.includes("getSupabaseAdmin"), `${label} must not own a database client`);
}
assert.ok(topicsAdapter.includes('contentTypes: ["article"]'));
assert.ok(mediaTypes.includes("CONTENT_TYPES.filter"));
assert.ok(!mediaTypes.includes('= [\n  "news"'));
for (const type of ["article", "news", "press", "site_update", "video", "gallery"]) {
  assert.ok(contentTypes.includes(`"${type}"`));
  assert.ok(publicPaths.includes(`${type}:`));
}

for (const [label, source] of [
  ["Hero", hero],
  ["Topics Feed", feed],
] as const) {
  assert.ok(source.includes("loadPublicContentCollection"), `${label} must consume the Public Collection owner`);
  assert.ok(!source.includes('.from("topics")'), `${label} must not keep a parallel public content read`);
}
assert.ok(sitemap.includes("loadPublicContentSitemapRows"));
assert.ok(!sitemap.includes('.from("topics")'));

assert.ok(input.includes('router.replace(href, { scroll: false })'));
assert.ok(input.includes("PUBLIC_CONTENT_SEARCH_DEBOUNCE_MS"));
assert.ok(input.includes("maxLength={PUBLIC_CONTENT_SEARCH_MAX_LENGTH}"));
assert.ok(input.includes('role="combobox"'));
assert.ok(input.includes('role="listbox"'));
assert.ok(input.includes('role="option"'));
assert.ok(input.includes('aria-live="polite"'));
assert.ok(input.includes("ArrowDown") && input.includes("ArrowUp") && input.includes("Escape"));
assert.ok(input.includes('event.key === "Enter" && normalizedDraft !== committedQuery'));
assert.ok(input.includes("window.clearTimeout(searchTimerRef.current)"));
assert.ok(input.includes("navigateToSearch(normalizedDraft)"));
for (const forbidden of ["router.refresh", "window.location.reload", "fetch("]) {
  assert.ok(!input.includes(forbidden), `Shared search input must not use ${forbidden}`);
}

assert.ok(topicsSearchPanel.includes("PublicContentSearchInput"));
assert.ok(mediaSidebar.includes("PublicContentSearchInput"));
assert.ok(topicsPage.includes("listingPromise") && topicsPage.includes("Promise.all"));
assert.ok(topicsListing.includes("topics.map"));
assert.ok(topicsListing.includes("!isSearching ? <FeaturedTopic"));
assert.ok(mediaPage.includes("getMediaListingPage"));
assert.ok(!mediaPage.includes("getMediaItems("), "Media search must not fetch a second catalog");
assert.ok(!mediaPage.includes("searchCatalog"));
assert.ok(mediaListing.includes("!isSearching ? children : null"));
assert.ok(!mediaShell.includes("createContext") && !mediaShell.includes("useMediaSearch"));

for (const route of ["news", "videos", "gallery", "press", "site-updates"]) {
  const routePage = read(`src/app/(site)/media-center/${route}/page.tsx`);
  assert.ok(routePage.includes("MediaListingPage"), `${route} must adopt the shared Media listing`);
  assert.ok(routePage.includes("q?: string"), `${route} must expose the shared search query contract`);
}

console.log(
  "PASS Public Content: one Unified Content Public Collection owner and contract; Topics, Media, Hero, Feed and Sitemap adopt it; autocomplete reuses loaded results; projections remain bounded.",
);
