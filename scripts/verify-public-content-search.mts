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
const scrollbarOwner = read("src/components/venesia-scrollbar-styles.ts");
const adminScrollbarAlias = read(
  "src/components/admin/ui/admin-scrollbar-styles.ts",
);
const globalStyles = read("src/app/globals.css");
const topicsPage = read("src/app/(site)/topics/page.tsx");
const topicsDetailPage = read("src/app/(site)/topics/[slug]/page.tsx");
const topicsAdapter = read("src/lib/topics/load-public-topics.ts");
const topicsListing = read("src/components/topics/TopicsListingContent.tsx");
const mediaPage = read("src/components/media-center/MediaListingPage.tsx");
const mediaCenterShell = read("src/components/media-center/MediaCenterShellLayout.tsx");
const mediaDetailPage = read("src/components/media-center/MediaDetailPage.tsx");
const mediaCompositionLoader = read("src/lib/page-blocks/load-page-composition.ts");
const mediaSlotPlan = read("src/components/page-composition/build-slot-render-plan.ts");
const venisiaMediaHubLayout = read("src/components/page-composition/VenesiaThemeMediaHubLayout.tsx");
const mediaListing = read("src/components/media-center/MediaListingContent.tsx");
const mediaShell = read("src/components/media-center/MediaPageShell.tsx");
const mediaSidebar = read("src/components/media-center/MediaSidebar.tsx");
const mediaAdapter = read("src/lib/media-center/unified-provider.ts");
const mediaTypes = read("src/lib/media-center/types.ts");
const hero = read("src/lib/load-hero-section.ts");
const feed = read("src/lib/feed-modules/resolve-topics-feed.ts");
const sitemap = read("src/lib/seo/generate-sitemap-entries.ts");
const cacheTags = read("src/lib/cache/revalidate-public-cache-tags.ts");
const searchConfig = read("src/lib/page-blocks/search-platform-config.ts");
const searchModule = read("src/components/search-platform/SearchPlatformModule.tsx");
const searchEditor = read("src/components/admin/page-blocks/editors/SearchPlatformModuleEditor.tsx");
const contentActions = read("src/app/admin/pages-blocks/blocks/content/actions.ts");
const moduleRegistry = read("src/lib/page-blocks/module-edit-registry.ts");
const slotRenderer = read("src/components/page-composition/slot-module-nodes.tsx");
const dynamicPage = read("src/app/(site)/[...slug]/page.tsx");
const migration = read("sql/migrations/20260830232134_search_platform_module.sql");
const regressionMigration = read(
  "sql/migrations/20260831202338_search_platform_autocomplete_regression.sql",
);
const architecture = read("AI_ARCHITECTURE_PRINCIPLES.md");
const currentState = read("docs/CURRENT_PROJECT_STATE.md");
const systems = read("docs/SYSTEMS_RUNTIMES_CAPABILITIES.md");

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
assert.ok(owner.includes('from("topic_categories")'));
assert.ok(owner.includes("getCategoryAndDescendantIds"));
assert.ok(owner.includes("expandPublicCategoryHierarchy"));
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
assert.ok(
  owner.includes("faq?: Json") &&
    owner.includes("for (const item of value)") &&
    owner.includes('typeof item.question !== "string"') &&
    owner.includes('typeof item.answer !== "string"') &&
    !owner.includes("return value.flatMap((item) =>"),
  "Public FAQ parsing must reject the complete malformed Database JSON payload",
);

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

assert.ok(feed.includes("loadPublicContentCollection"), "Topics Feed must consume the Public Collection owner");
assert.ok(!feed.includes('.from("topics")'), "Topics Feed must not keep a parallel public content read");
assert.ok(
  !hero.includes("loadPublicContentCollection") &&
    !hero.includes('.from("topics")') &&
    !hero.includes("resolvedItems"),
  "Hero must remain presentation-only and outside the Public Collection consumer set",
);
assert.ok(sitemap.includes("loadPublicContentSitemapRows"));
assert.ok(!sitemap.includes('.from("topics")'));

assert.ok(input.includes('router.replace(href, { scroll: false })'));
assert.ok(input.includes("persistentParams"));
assert.ok(input.includes("submitPath"));
assert.ok(input.includes("submitPersistentParams"));
assert.ok(input.includes("router.push(href)"));
assert.ok(input.includes("PUBLIC_CONTENT_SEARCH_DEBOUNCE_MS"));
assert.ok(input.includes("maxLength={PUBLIC_CONTENT_SEARCH_MAX_LENGTH}"));
assert.ok(input.includes('role="combobox"'));
assert.ok(input.includes('role="listbox"'));
assert.ok(input.includes('role="option"'));
assert.ok(input.includes("createPortal("));
assert.ok(input.includes('position: "fixed"'));
assert.ok(input.includes('data-public-content-search-listbox=""'));
assert.ok(input.includes("window.addEventListener(\"scroll\", updateFloatingPosition, true)"));
assert.ok(!input.includes("z-[9999]") && !input.includes("zIndex: 9999"));
assert.ok(input.includes('aria-live="polite"'));
assert.ok(input.includes("ArrowDown") && input.includes("ArrowUp") && input.includes("Escape"));
assert.ok(input.includes('event.key === "Enter"'));
assert.ok(input.includes("window.clearTimeout(searchTimerRef.current)"));
assert.ok(input.includes("navigateToQuery(normalizedDraft)"));
assert.ok(input.includes("submitSearch(normalizedDraft)"));
assert.ok(input.includes('aria-label="تنفيذ البحث"'));
assert.ok(input.includes("VENESIA_SCROLLBAR_VISUAL_CLASSES"));
assert.ok(input.includes('from "../venesia-scrollbar-styles"'));
assert.ok(!input.includes("admin-scrollbar"));
assert.ok(scrollbarOwner.includes("VENESIA_SCROLLBAR_VISUAL_CLASSES"));
assert.ok(scrollbarOwner.includes("[scrollbar-width:thin]"));
assert.ok(scrollbarOwner.includes("[&::-webkit-scrollbar]:h-1.5"));
assert.ok(scrollbarOwner.includes("[&::-webkit-scrollbar]:w-1.5"));
assert.ok(adminScrollbarAlias.includes("VENESIA_SCROLLBAR_VISUAL_CLASSES"));
assert.ok(!adminScrollbarAlias.includes("[scrollbar-width:thin]"));
assert.ok(!globalStyles.includes(".admin-scrollbar"));
for (const forbidden of ["router.refresh", "window.location.reload", "fetch("]) {
  assert.ok(!input.includes(forbidden), `Shared search input must not use ${forbidden}`);
}

assert.ok(mediaSidebar.includes("SidebarFeedPanel"));
assert.ok(!mediaSidebar.includes("function SidebarPanel"));
assert.ok(!topicsPage.includes("PublicContentSearchInput"));
assert.ok(!topicsPage.includes("TopicsSidebarSearchPanel"));
assert.ok(!topicsDetailPage.includes("TopicsSidebarSearchPanel"));
assert.ok(topicsDetailPage.includes("<PageSlotContent"));
assert.ok(!mediaPage.includes("MediaSidebarSearch"));
assert.ok(!mediaDetailPage.includes("MediaSidebarSearch"));
assert.ok(mediaDetailPage.includes("publicPath={pagePath}"));
assert.ok(!mediaSidebar.includes("PublicContentSearchInput"));
assert.ok(
  topicsPage.includes("await loadPublicTopicsListing({") &&
    topicsPage.includes("itemsPerPage: listingConfig.itemLimit"),
);
assert.ok(topicsPage.includes("searchParams={params}"));
assert.ok(
  topicsListing.includes("<TopicsListingModule") &&
    !topicsListing.includes("<TopicCard"),
);
assert.ok(!topicsListing.includes("FeaturedTopic"));
assert.ok(
  topicsPage.includes("composition.featuredModules") &&
    topicsPage.includes("excludeIds: searchQuery"),
  "Topics Search/Listing must not own Featured while non-search listing results avoid assigned Featured identities",
);
assert.ok(mediaPage.includes("getMediaListingPage"));
assert.ok(mediaPage.includes("searchParams={params}"));
assert.ok(mediaCenterShell.includes("searchParams={searchParams}"));
assert.ok(!mediaPage.includes("getMediaItems("), "Media search must not fetch a second catalog");
assert.ok(!mediaPage.includes("searchCatalog"));
assert.ok(
  !mediaPage.includes("featuredNodes") &&
    mediaCompositionLoader.includes("slots[hubModule.slot].push") &&
    mediaSlotPlan.includes('kind: "media-hub"') &&
    venisiaMediaHubLayout.includes("renderVenesiaThemeMediaHubNodes"),
  "Featured Content must remain an Assignment-positioned module during listing search",
);
assert.ok(!mediaListing.includes("children?: ReactNode"));
assert.ok(!mediaShell.includes("createContext") && !mediaShell.includes("useMediaSearch"));

for (const route of ["news", "videos", "gallery", "press", "site-updates"]) {
  const routePage = read(`src/app/(site)/media-center/${route}/page.tsx`);
  assert.ok(routePage.includes("MediaListingPage"), `${route} must adopt the shared Media listing`);
  assert.ok(routePage.includes("q?: string"), `${route} must expose the shared search query contract`);
}

assert.ok(searchConfig.includes('SEARCH_PLATFORM_TEMPLATE_SLUG = "search-platform"'));
assert.ok(searchConfig.includes('"compact"') && searchConfig.includes('"full-list"') && searchConfig.includes('"full-grid"'));
assert.ok(searchConfig.includes('"content-type"') && searchConfig.includes('"category"') && searchConfig.includes('"series"'));
assert.ok(moduleRegistry.includes('"search-platform"'));
assert.ok(slotRenderer.includes("<SearchPlatformModule"));
assert.ok(dynamicPage.includes("publicPath={page.path}") && dynamicPage.includes("searchParams={resolvedSearchParams}"));
assert.ok(searchModule.includes("basePath={publicPath}"));
assert.ok(searchModule.includes('submitPath="/search"'));
assert.ok(searchModule.includes("submitPersistentParams={{ types: scopeParam }}"));
assert.ok(searchModule.includes('data-search-platform-scope={scopeParam ?? ""}'));
assert.ok(searchModule.includes("pageSize: 8"));
assert.ok(searchModule.includes("suggestions={suggestions}"));
assert.ok(searchModule.includes("loadPublicContentCollection"));
assert.ok(searchModule.includes("loadPublicContentFilterOptions"));
assert.ok(searchModule.includes("<PublicPagination"));
assert.ok(searchModule.includes('action="/search"'));
assert.ok(!searchModule.includes("pg_trgm") && !searchModule.includes("highlight"));
assert.ok(!searchModule.includes('.from("topics")') && !searchModule.includes("getSupabaseAdmin"));
assert.ok(searchEditor.includes('name="search_scope"'));
assert.ok(searchEditor.includes('name="content_types"'));
assert.ok(searchEditor.includes('name="result_limit"'));
assert.ok(searchEditor.includes('name="search_presentation"'));
assert.ok(searchEditor.includes('name="search_filters"'));
assert.ok(searchEditor.includes('name="default_sort"'));
assert.ok(contentActions.includes("buildSearchPlatformConfig"));
assert.ok(/'search',\r?\n\s*'\/search'/u.test(migration));
assert.ok(migration.includes("'search-platform'"));
assert.ok(migration.includes("mutate_page_composition"));
assert.ok(!migration.includes("create table") && !migration.includes("create extension") && !migration.includes("pg_trgm"));
assert.ok(searchConfig.includes('filters: ["content-type"]'));
assert.ok(regressionMigration.includes("update public.content_block_templates"));
assert.ok(regressionMigration.includes("'[\"content-type\"]'::jsonb"));
assert.ok(regressionMigration.includes("where slug = 'search-platform'"));
assert.ok(regressionMigration.includes("variant = 'search-platform'"));
assert.ok(regressionMigration.includes("for update"));
assert.ok(regressionMigration.includes("is distinct from"));
assert.ok(!/(create\s+table|alter\s+table|create\s+extension|pg_trgm)/iu.test(regressionMigration));
assert.ok(!/(create\s+index|alter\s+column|owner\s+to|grant\s+|revoke\s+)/iu.test(regressionMigration));
assert.ok(
  !migration.includes("menu_items") &&
    !migration.includes("navigation_menu") &&
    !migration.includes("footer_settings") &&
    !migration.includes("footer_links"),
);
assert.ok(contract.includes("page: Math.max(1, Math.floor(Number(input.page ?? 1)) || 1)"));
assert.ok(contract.includes("input.pageSize ?? (search ? PUBLIC_CONTENT_SEARCH_RESULT_LIMIT : 12)"));
assert.ok(architecture.includes("## 7.16 Search Platform Module"));
assert.ok(architecture.includes("Public Content Read remains the only search data"));
assert.ok(currentState.includes("Search is a portable Page Composition Content Module"));
assert.ok(systems.includes("| Search Platform Module"));

console.log(
  "PASS Search Platform: one Unified Content Public Collection owner and contract; CMS Search uses Content assignments and /search without a parallel runtime, engine, source of truth, navigation, footer, or performance extension.",
);
