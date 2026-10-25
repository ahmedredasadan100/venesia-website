import { normalizeVerificationText } from "./lib/verification-text.mjs";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => normalizeVerificationText(readFileSync(resolve(ROOT, path), "utf8"));
const jiti = createJiti(import.meta.url);
const {
  SEARCH_PLATFORM_SCOPES,
  SEARCH_PLATFORM_PRESENTATIONS,
  SEARCH_PLATFORM_RESULT_LIMITS,
  SEARCH_PLATFORM_FILTERS,
  DEFAULT_SEARCH_PLATFORM_INTERFACE_DISPLAY,
  asSearchPlatformConfig,
  isSearchPlatformTemplate,
  buildSearchPlatformInterfaceDisplayFromFormData,
  resolveSearchPlatformInterfaceDisplay,
} = await jiti.import<
  typeof import("../src/lib/page-blocks/search-platform-config.ts")
>("../src/lib/page-blocks/search-platform-config.ts");

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
const mediaListingModule = read("src/components/media-center/MediaListingModule.tsx");
const mediaCenterShell = read("src/components/media-center/MediaCenterShellLayout.tsx");
const mediaDetailPage = read("src/components/media-center/MediaDetailPage.tsx");
const mediaCompositionLoader = read("src/lib/page-blocks/load-page-composition.ts");
const mediaSlotPlan = read("src/components/page-composition/build-slot-render-plan.ts");
const pageSlotLayout = read("src/components/page-composition/PageSlotLayout.tsx");
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
const contentEditor = read("src/components/admin/page-blocks/ContentModuleEditClient.tsx");
const contentActions = read("src/app/admin/pages-blocks/blocks/content/actions.ts");
const moduleRegistry = read("src/lib/page-blocks/module-edit-registry.ts");
const moduleRegistryMetadata = read(
  "src/lib/page-composition/module-registry-metadata.ts",
);
const slotRenderer = read("src/components/page-composition/slot-module-nodes.tsx");
const slotPresentationContract = read(
  "src/components/page-composition/slot-module-presentation-contract.ts",
);
const dynamicPage = read("src/app/(site)/[...slug]/page.tsx");
const publicSiteError = read("src/app/(site)/error.tsx");
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
const replaceNavigationStart = input.indexOf("const navigateToQuery = useCallback(");
const submitNavigationStart = input.indexOf("const submitSearch = useCallback(");
const navigationSyncStart = input.indexOf(
  "useLayoutEffect(() => {",
  submitNavigationStart,
);
const replaceNavigationSource = input.slice(
  replaceNavigationStart,
  submitNavigationStart,
);
const submitNavigationSource = input.slice(
  submitNavigationStart,
  navigationSyncStart,
);
assert.ok(
  replaceNavigationStart >= 0 &&
    submitNavigationStart > replaceNavigationStart &&
    navigationSyncStart > submitNavigationStart &&
    replaceNavigationSource.includes("buildSearchHref(basePath, normalized, persistentParams)") &&
    replaceNavigationSource.includes("router.replace(href, { scroll: false })") &&
    submitNavigationSource.includes("submitPath") &&
    submitNavigationSource.includes("submitPersistentParams") &&
    submitNavigationSource.includes("router.push(href)"),
  "Typing must replace the current URL while explicit submission pushes the canonical destination",
);
assert.ok(input.includes("PUBLIC_CONTENT_SEARCH_DEBOUNCE_MS"));
assert.ok(input.includes("maxLength={PUBLIC_CONTENT_SEARCH_MAX_LENGTH}"));
assert.ok(input.includes('role="combobox"'));
assert.ok(input.includes('role="listbox"'));
assert.ok(input.includes('role="option"'));
assert.match(
  input,
  /type="button"\s+tabIndex=\{-1\}\s+role="option"/u,
  "Combobox options must remain arrow-operated without adding Tab stops",
);
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
assert.ok(
  input.includes('params.delete("page")') &&
    input.indexOf('params.delete("page")') < input.indexOf('params.set("q", normalized)'),
  "Search navigation must reset pagination before writing the normalized query",
);
assert.ok(
  input.includes('data-public-content-search-preview-label=""') &&
    input.includes("نتائج مبدئية") &&
    input.includes("preliminaryResults"),
  "Launcher suggestions must identify themselves as a preliminary preview",
);
assert.ok(
  input.includes("!preliminaryResults && showSuggestions") &&
    input.includes("submitSearch(normalizedDraft)"),
  "Launcher Enter must submit the full search while non-preview comboboxes may select an active option",
);
assert.ok(
  input.includes('data-public-content-search-state={') &&
    ["loading", "idle", "data", "empty"].every((state) =>
      input.includes(`? "${state}"`) || input.includes(`: "${state}"`),
    ) &&
    input.includes('data-public-content-search-loading=""') &&
    input.includes("جارٍ تحديث النتائج"),
  "Search must expose distinct idle/loading/data/empty states and visible pending feedback",
);
assert.ok(input.includes('aria-label="تنفيذ البحث"'));
assert.ok(input.includes('data-public-content-search-field=""'));
assert.ok(input.includes('className="absolute end-2.5 top-1/2'));
assert.ok(input.includes('className="absolute start-3 top-1/2'));
assert.ok(input.includes("helpTextDisplay"));
assert.ok(input.includes("showSearchAction"));
assert.ok(input.includes('data-public-content-search-help=""'));
assert.ok(input.includes('data-public-content-search-action=""'));
assert.ok(input.includes("pageBlockTextAlignClass"));
assert.ok(!input.includes("pageBlockTextPlacementClass"));
assert.ok(!input.includes("searchAction.text"));
assert.ok(input.includes("[&::-webkit-search-cancel-button]:hidden"));
assert.ok(input.includes("VENESIA_SCROLLBAR_VISUAL_CLASSES"));
assert.ok(input.includes('from "../venesia-scrollbar-styles"'));
assert.ok(!input.includes("admin-scrollbar"));
assert.ok(scrollbarOwner.includes("VENESIA_SCROLLBAR_VISUAL_CLASSES"));
assert.ok(scrollbarOwner.includes('VENESIA_SCROLLBAR_VISUAL_CLASSES = "venesia-scrollbar"'));
const scrollbarUtility = /@utility venesia-scrollbar\s*\{([^}]+)\}/.exec(globalStyles)?.[1] ?? "";
assert.ok(scrollbarUtility.includes("[scrollbar-width:thin]"));
assert.ok(scrollbarUtility.includes("[&::-webkit-scrollbar]:h-1.5"));
assert.ok(scrollbarUtility.includes("[&::-webkit-scrollbar]:w-1.5"));
assert.equal((globalStyles.match(/@utility venesia-scrollbar\b/g) ?? []).length, 1);
assert.ok(!scrollbarUtility.includes("overflow"), "The neutral scrollbar utility must remain visual only");
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
assert.ok(
  mediaDetailPage.includes("const pagePath = getMediaHref(item)") &&
    !/PageSlotLayout|PageSlotContent|SearchPlatform|searchParams/u.test(
      mediaDetailPage,
    ),
  "Media detail must resolve its canonical path without inheriting Listing search composition",
);
assert.ok(!mediaSidebar.includes("PublicContentSearchInput"));
assert.ok(
  topicsListing.includes("await loadPublicTopicsListing({") &&
    topicsListing.includes("itemsPerPage: listingConfig.itemLimit"),
);
assert.ok(topicsPage.includes("searchParams={params}"));
assert.ok(
  topicsListing.includes("<TopicsListingModule") &&
    !topicsListing.includes("<TopicCard"),
);
assert.ok(!topicsListing.includes("FeaturedTopic"));
assert.ok(
  topicsPage.includes("composition.featuredModules") &&
    topicsPage.includes("excludeContentIds:") &&
    topicsListing.includes("excludeIds: searchQuery"),
  "Topics Search/Listing must not own Featured while non-search listing results avoid assigned Featured identities",
);
assert.ok(mediaListingModule.includes("getMediaListingPage"));
assert.ok(mediaPage.includes("searchParams={params}"));
assert.ok(mediaCenterShell.includes("searchParams={searchParams}"));
assert.ok(
  mediaListingModule.includes("searchParams = {}") &&
    mediaListingModule.includes("firstParam(searchParams.q)"),
  "Assignment-scoped Media Listing must consume the shared route request context",
);
assert.ok(
  !mediaPage.includes("getMediaItems(") &&
    !mediaListingModule.includes("getMediaItems("),
  "Media search must not fetch a second catalog",
);
assert.ok(!mediaPage.includes("searchCatalog"));
assert.ok(!mediaListingModule.includes("searchCatalog"));
assert.ok(
  !mediaPage.includes("featuredNodes") &&
    mediaCompositionLoader.includes("slots[hubModule.slot].push") &&
    mediaSlotPlan.includes('kind: "media-hub"') &&
    venisiaMediaHubLayout.includes("renderVenesiaThemeMediaHubNodes"),
  "Featured Content must remain an Assignment-positioned module in the shared render plan",
);
assert.ok(!mediaListing.includes("children?: ReactNode"));
assert.ok(!mediaShell.includes("createContext") && !mediaShell.includes("useMediaSearch"));

for (const route of ["news", "videos", "gallery", "press", "site-updates"]) {
  const routePage = read(`src/app/(site)/media-center/${route}/page.tsx`);
  assert.ok(routePage.includes("MediaListingPage"), `${route} must adopt the shared Media listing`);
  assert.ok(routePage.includes("q?: string"), `${route} must expose the shared search query contract`);

  const detailRoutePage = read(
    `src/app/(site)/media-center/${route}/[slug]/page.tsx`,
  );
  assert.ok(
    !detailRoutePage.includes("searchParams") &&
      detailRoutePage.includes("const { slug } = await params"),
    `${route} detail must consume only its route identity, not Listing search context`,
  );
}

assert.ok(searchConfig.includes('SEARCH_PLATFORM_TEMPLATE_SLUG = "search-platform"'));
assert.ok(searchConfig.includes('"compact"') && searchConfig.includes('"full-list"') && searchConfig.includes('"full-grid"'));
assert.ok(searchConfig.includes('"content-type"') && searchConfig.includes('"category"') && searchConfig.includes('"series"'));
assert.ok(searchConfig.includes("DEFAULT_SEARCH_PLATFORM_INTERFACE_DISPLAY"));
assert.ok(searchConfig.includes("resolveSearchPlatformInterfaceDisplay"));
assert.ok(searchConfig.includes("buildSearchPlatformInterfaceDisplayFromFormData"));
assert.ok(moduleRegistry.includes('"search-platform"'));
assert.ok(slotRenderer.includes("<SearchPlatformModule"));
assert.ok(dynamicPage.includes("publicPath={page.path}") && dynamicPage.includes("searchParams={resolvedSearchParams}"));
assert.ok(searchModule.includes("basePath={publicPath}"));
assert.ok(searchModule.includes("submitPath={SEARCH_PLATFORM_PUBLIC_ROUTE.href}"));
assert.ok(
  searchModule.includes("if (publicPath !== SEARCH_PLATFORM_PUBLIC_ROUTE.href)") &&
    !searchModule.includes("publicPath !== SEARCH_PLATFORM_PUBLIC_ROUTE.href || config.presentation === \"compact\""),
  "/search identity must always select the full-results runtime even when presentation is compact",
);
const launcherRuntimeStart = searchModule.indexOf(
  "if (publicPath !== SEARCH_PLATFORM_PUBLIC_ROUTE.href)",
);
const launcherRuntimeEnd = searchModule.indexOf(
  "const scope = resolveScopedContentTypes",
  launcherRuntimeStart,
);
const launcherRuntimeSource = searchModule.slice(
  launcherRuntimeStart,
  launcherRuntimeEnd,
);
const launcherPresentationSource = searchModule.slice(
  searchModule.indexOf("function SearchLauncher("),
  searchModule.indexOf("function SearchFilters("),
);
assert.ok(
  launcherRuntimeStart >= 0 &&
    launcherRuntimeEnd > launcherRuntimeStart &&
    launcherRuntimeSource.includes("let listing = EMPTY_RESULT") &&
    launcherRuntimeSource.includes("listing = await loadPublicContentCollection({") &&
    launcherRuntimeSource.includes("contentTypes: selectedContentTypes") &&
    launcherRuntimeSource.includes("search: query") &&
    launcherRuntimeSource.includes("sort: selectedSort") &&
    launcherRuntimeSource.includes("categorySlugs: selectedCategory ? [selectedCategory] : []") &&
    launcherRuntimeSource.includes("seriesSlug: selectedSeries") &&
    launcherRuntimeSource.includes("submitPersistentParams={canonicalSearchParams}") &&
    launcherPresentationSource.includes("preliminaryResults"),
  "Launcher preview must read the same normalized scope, filters, and sort that Enter submits to full Search",
);
const canonicalSearchParamsStart = searchModule.indexOf(
  "const canonicalSearchParams = {",
);
const canonicalSearchParamsEnd = searchModule.indexOf(
  "satisfies Readonly<Record<string, string | undefined>>",
  canonicalSearchParamsStart,
);
const canonicalSearchParamsSource = searchModule.slice(
  canonicalSearchParamsStart,
  canonicalSearchParamsEnd,
);
assert.ok(
  canonicalSearchParamsStart >= 0 &&
    canonicalSearchParamsEnd > canonicalSearchParamsStart &&
    ["types", "type", "category", "series", "sort"].every((field) =>
      canonicalSearchParamsSource.includes(`${field}:`),
    ) &&
    searchModule.includes("query = normalizePublicContentSearchQuery(") &&
    input.includes('params.set("q", normalized)') &&
    searchModule.includes("submitPersistentParams={canonicalSearchParams}") &&
    searchModule.includes("persistentParams={canonicalSearchParams}"),
  "Preview reads and full-search navigation must preserve normalized q/types/type/category/series/sort",
);
const selectedSortStart = searchModule.indexOf("const selectedSort =");
const selectedSortEnd = searchModule.indexOf(
  "const selectedContentTypes =",
  selectedSortStart,
);
const selectedSortSource = searchModule.slice(selectedSortStart, selectedSortEnd);
assert.ok(
  selectedSortStart >= 0 &&
    selectedSortEnd > selectedSortStart &&
    selectedSortSource.includes('"newest"') &&
    selectedSortSource.includes('"oldest"') &&
    selectedSortSource.includes("config.defaultSort"),
  "An explicit newest or oldest URL sort must override the configured default",
);
assert.ok(searchModule.includes('data-search-platform-scope={scopeParam ?? ""}'));
assert.ok(searchModule.includes("pageSize: 8"));
assert.ok(searchModule.includes("suggestions={suggestions}"));
assert.ok(searchModule.includes("loadPublicContentCollection"));
assert.ok(searchModule.includes("loadPublicContentFilterOptions"));
assert.ok(searchModule.includes("<PublicPagination"));
assert.ok(searchModule.includes("action={SEARCH_PLATFORM_PUBLIC_ROUTE.href}"));
assert.ok(
  searchModule.includes('<input type="hidden" name="q" defaultValue={query} />'),
  "Search filters must submit the active URL-owned query",
);
assert.ok(searchModule.includes('data-search-interface-display-formatting=""'));
for (const element of ["title", "description", "results-title", "empty-results"]) {
  assert.ok(
    searchModule.includes(`data-search-interface-element="${element}"`),
    `Public Search interface must apply ${element} formatting`,
  );
}
assert.ok(searchModule.includes("helpTextDisplay={display.helpText}"));
assert.ok(searchModule.includes("showSearchAction={display.searchAction.visible}"));
assert.ok(searchModule.includes("display.emptyResults.title"));
assert.ok(searchModule.includes("display.emptyResults.description"));
const searchResultCardStart = searchModule.indexOf("function SearchResultCard(");
const searchResultCardEnd = searchModule.indexOf(
  "function SearchLauncher(",
  searchResultCardStart,
);
const searchResultCardSource = searchModule.slice(
  searchResultCardStart,
  searchResultCardEnd,
);
assert.equal(
  searchResultCardSource.match(/<Link\b/gu)?.length ?? 0,
  1,
  "Each search result card must expose exactly one link/focus target",
);
assert.ok(searchResultCardSource.includes('data-search-result-link=""'));
assert.ok(
  owner.includes("export class PublicContentReadError extends Error") &&
    owner.includes("throw new PublicContentReadError(") &&
    searchModule.includes("error instanceof PublicContentReadError") &&
    searchModule.includes('data-search-runtime-state={hasReadError ? "error"') &&
    searchModule.match(/hasReadError=\{hasReadError\}/gu)?.length === 3 &&
    input.includes('hasReadError?: boolean;') &&
    input.includes('? "error"') &&
    input.includes('aria-invalid={hasReadError || undefined}') &&
    input.includes('? "تعذر تحميل نتائج البحث"') &&
    searchModule.includes('data-search-interface-element="error-results"') &&
    searchModule.includes("لم تُعرض حالة فارغة بديلة") &&
    !searchModule.includes(".catch("),
  "Public Content read failures must render the explicit Search error state, never become empty results",
);
assert.ok(
  publicSiteError.includes("تعذّر تحميل الصفحة") &&
    publicSiteError.includes("retry"),
  "Public Search must retain a distinct recoverable error presentation",
);
assert.ok(!searchModule.includes("pg_trgm") && !searchModule.includes("highlight"));
assert.ok(!searchModule.includes('.from("topics")') && !searchModule.includes("getSupabaseAdmin"));
assert.ok(searchEditor.includes('name="search_scope"'));
assert.ok(searchEditor.includes('name="content_types"'));
assert.ok(searchEditor.includes('name="result_limit"'));
assert.ok(searchEditor.includes('name="search_presentation"'));
assert.ok(searchEditor.includes('name="search_filters"'));
assert.ok(searchEditor.includes('name="default_sort"'));
assert.ok(searchEditor.includes('data-search-interface-display-formatting=""'));
for (const field of [
  "search_title",
  "search_description",
  "search_help_text",
  "search_results_title",
]) {
  assert.ok(searchEditor.includes(`showName="show_${field}"`));
  assert.ok(searchEditor.includes(`boldName="${field}_bold"`));
  assert.ok(searchEditor.includes(`alignmentName="${field}_alignment"`));
}
assert.ok(searchEditor.includes('label="أيقونة البحث"'));
assert.ok(searchEditor.includes('showName="show_search_action"'));
assert.ok(searchEditor.includes('controlMode="visibility-only"'));
for (const field of ["placeholder", "empty_results_title", "empty_results_description"]) {
  assert.ok(searchEditor.includes(`name="${field}"`));
}
// The approved split changes layout only: the exact original field inventory
// remains partitioned once across text/search/presentation, with mounted tabs.
const searchTextNames = ["title", "description", "help_text", "placeholder", "empty_results_title", "empty_results_description"];
function assertSearchEditorAdoptionSource(searchEditor: string, contentEditor: string) {
const searchEditorAst = ts.createSourceFile("SearchPlatformModuleEditor.tsx", searchEditor, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
type SearchJsxNode = ts.JsxOpeningElement | ts.JsxSelfClosingElement;
function searchJsxNodes(node: ts.Node): SearchJsxNode[] {
  const result: SearchJsxNode[] = [];
  function visit(current: ts.Node) {
    if (ts.isJsxOpeningElement(current) || ts.isJsxSelfClosingElement(current)) result.push(current);
    ts.forEachChild(current, visit);
  }
  visit(node);
  return result;
}
function searchAttribute(node: SearchJsxNode, name: string) {
  return node.attributes.properties.find((attribute): attribute is ts.JsxAttribute =>
    ts.isJsxAttribute(attribute) && attribute.name.getText() === name);
}
function searchLiteral(node: SearchJsxNode, name: string) {
  const value = searchAttribute(node, name)?.initializer;
  return value && ts.isStringLiteral(value) ? value.text : undefined;
}
function searchTag(node: SearchJsxNode) { return node.tagName.getText(searchEditorAst); }
const searchControlTags = new Set(["TextField", "ModuleEditorVisibilityAlignRow", "AdminFormListboxSelect", "AdminCheckbox"]);
const searchControls = searchJsxNodes(searchEditorAst).filter(node => searchControlTags.has(searchTag(node)));
const searchNamedAttributes = ["name", "showName", "boldName", "alignmentName"];
const searchFormattingNames = ["search_title", "search_description", "search_help_text", "search_results_title"].flatMap(field => [`show_${field}`, `${field}_bold`, `${field}_alignment`]);
const expectedSearchFormNames = [...searchTextNames, ...searchFormattingNames, "show_search_action", "search_scope", "content_types", "search_filters", "result_limit", "search_presentation", "default_sort"];
const authoredSearchFormNames = searchControls.flatMap(node => searchNamedAttributes.flatMap(name => searchLiteral(node, name) ? [searchLiteral(node, name)!] : []));
assert.equal(expectedSearchFormNames.length, 25);
assert.deepEqual(authoredSearchFormNames.slice().sort(), expectedSearchFormNames.slice().sort(), "All 25 config names occur exactly once, without new or missing capabilities");
assert.equal(searchControls.filter(node => searchTag(node) === "TextField").length, 6);
assert.equal(searchControls.filter(node => searchTag(node) === "ModuleEditorVisibilityAlignRow").length, 5);
assert.equal(searchControls.filter(node => searchTag(node) === "AdminFormListboxSelect").length, 4);
assert.equal(searchControls.filter(node => searchTag(node) === "AdminCheckbox").length, 2);
assert.ok(searchControls.every(node => !searchAttribute(node, "disabled") && !searchAttribute(node, "readOnly")), "Adoption must not disable an existing setting");
const originalSearchBindings: Record<string, string> = {
  title: "{config.title}", description: "{config.description}", help_text: "{config.helpText}", placeholder: "{config.placeholder}",
  empty_results_title: "{config.interfaceDisplay.emptyResults.title}", empty_results_description: "{config.interfaceDisplay.emptyResults.description}",
  search_scope: "{config.scope}", result_limit: "{String(config.resultLimit)}", search_presentation: "{config.presentation}", default_sort: "{config.defaultSort}",
};
for (const node of searchControls) {
  const name = searchLiteral(node, "name");
  if (name && originalSearchBindings[name]) assert.equal(searchAttribute(node, "defaultValue")?.initializer?.getText(searchEditorAst), originalSearchBindings[name], `${name} retains its canonical initial value`);
  if (searchTag(node) === "AdminFormListboxSelect") {
    const header = searchJsxNodes(searchAttribute(node, "label")!).filter(child => searchTag(child) === "AdminFormControlHeader");
    assert.equal(header.length, 1, `${name} uses one shared control header as its label`);
    assert.equal(searchLiteral(header[0], "presentation"), "leading-icon");
    assert.equal(searchLiteral(node, "sizing"), "full");
    let ancestor: ts.Node | undefined = node.parent;
    while (ancestor && !(ts.isJsxElement(ancestor) && searchTag(ancestor.openingElement) === "AdminCard")) ancestor = ancestor.parent;
    assert.ok(ancestor && ts.isJsxElement(ancestor), `${name} retains its premium setting card`);
    assert.equal(searchLiteral(ancestor.openingElement, "presentation"), "premium");
  }
}
for (const row of searchControls.filter(node => searchTag(node) === "ModuleEditorVisibilityAlignRow")) {
  assert.ok(!searchAttribute(row, "presentation"), "Search consumes the unified shared row without an obsolete visual selector");
  assert.ok(searchAttribute(row, "icon"));
  const showName = searchLiteral(row, "showName")!;
  const key = ({ show_search_title: "title", show_search_description: "description", show_search_help_text: "helpText", show_search_results_title: "resultsTitle", show_search_action: "searchAction" } as Record<string, string>)[showName];
  assert.equal(searchAttribute(row, "showDefault")?.initializer?.getText(searchEditorAst), `{config.interfaceDisplay.${key}.visible}`);
  if (key === "searchAction") {
    assert.equal(searchLiteral(row, "controlMode"), "visibility-only");
    assert.ok(!searchAttribute(row, "boldName") && !searchAttribute(row, "alignmentName"));
  } else {
    assert.equal(searchAttribute(row, "boldDefault")?.initializer?.getText(searchEditorAst), `{config.interfaceDisplay.${key}.bold}`);
    assert.equal(searchAttribute(row, "alignmentDefault")?.initializer?.getText(searchEditorAst), `{config.interfaceDisplay.${key}.alignment}`);
  }
}
const sectionBranches = new Map<string, ts.Node>();
function visitSearchSection(node: ts.Node) {
  if (ts.isConditionalExpression(node)) {
    const match = /^section === "all" \|\| section === "(text|search|presentation)"$/u.exec(node.condition.getText(searchEditorAst));
    if (match) {
      assert.equal(sectionBranches.has(match[1]), false, "Each section has one owner");
      sectionBranches.set(match[1], node.whenTrue);
    }
  }
  ts.forEachChild(node, visitSearchSection);
}
visitSearchSection(searchEditorAst);
assert.deepEqual([...sectionBranches.keys()], ["text", "search", "presentation"]);
const sectionExpectedNames = {
  text: [...searchTextNames, ...searchFormattingNames, "show_search_action"],
  search: ["search_scope", "content_types", "search_filters"],
  presentation: ["result_limit", "search_presentation", "default_sort"],
};
for (const [section, branch] of sectionBranches) {
  const nodes = searchJsxNodes(branch);
  const names = nodes.filter(node => searchControlTags.has(searchTag(node))).flatMap(node => searchNamedAttributes.flatMap(name => searchLiteral(node, name) ? [searchLiteral(node, name)!] : []));
  assert.deepEqual(names.sort(), sectionExpectedNames[section as keyof typeof sectionExpectedNames].slice().sort(), `${section} retains its exact functional field group`);
  const grids = nodes.filter(node => searchTag(node) === "AdminFormGrid");
  assert.deepEqual(grids.map(node => searchAttribute(node, "columns")?.initializer?.getText(searchEditorAst)), section === "search" ? ["{1}", "{2}", "{3}", "{3}"] : ["{3}"], `${section} delegates responsive composition to the current grid`);
  assert.equal(nodes.filter(node => searchTag(node) === "ModuleEditorSectionHeading").length, 1);
  assert.ok(branch.getText(searchEditorAst).includes('section === "all" ? ('), "Split tabs must not duplicate their existing shared section header");
}
assert.ok(searchEditor.includes('section = "all"'), "The existing direct editor retains all sections by default");
assert.ok(!searchEditor.includes("ModuleEditorFieldGrid") && !searchEditor.includes("ModuleEditorField") && !searchEditor.includes("MODULE_EDITOR_CONTROL_CARD_CLASS_NAME") && !/\bgrid-cols-/u.test(searchEditor), "Search owns composition, not a parallel grid or card style");
assert.ok(!searchEditor.includes("useState") && !searchEditor.includes("AdminRichTextEditor"), "Presentation adoption adds no local state or unsupported editor");
const nativeSearchInputs = searchJsxNodes(searchEditorAst).filter(node => searchTag(node) === "input");
assert.equal(nativeSearchInputs.length, 1, "The existing TextField remains the single native text-input template");
assert.ok(searchAttribute(nativeSearchInputs[0], "required") && searchAttribute(nativeSearchInputs[0], "defaultValue"));
assert.ok(!searchAttribute(nativeSearchInputs[0], "value") && !searchAttribute(nativeSearchInputs[0], "maxLength"));
const searchTabsSource = contentEditor.slice(contentEditor.indexOf("const searchPlatformTabs ="), contentEditor.indexOf("const savedMessage ="));
assert.ok(searchTabsSource.includes('isSearchPlatform') && searchTabsSource.includes('["content", "search", "presentation"] as const') && searchTabsSource.includes('id: "pages"'));
assert.ok(searchTabsSource.includes('section={section === "content" ? "text" : section}') && searchTabsSource.includes('sectionHeaderPresentation: "control"'));
const searchTabsAst = ts.createSourceFile("SearchPlatformTabs.tsx", searchTabsSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const assignmentTabs = searchJsxNodes(searchTabsAst).filter(node => node.tagName.getText(searchTabsAst) === "ModuleEditorPagesTab");
assert.equal(assignmentTabs.length, 1, "Search delegates assignments to one shared Pages tab");
assert.equal(searchAttribute(assignmentTabs[0], "moduleName")?.initializer?.getText(searchTabsAst), "{block.name}");
assert.equal(searchAttribute(assignmentTabs[0], "assignmentContext")?.initializer?.getText(searchTabsAst), "{assignmentContext}");
assert.ok(!searchAttribute(assignmentTabs[0], "presentation") && !searchAttribute(assignmentTabs[0], "showUsageBanner"), "Shared assignment defaults preserve multi-page usage and position information");
assert.ok(contentEditor.includes('const isSearchPlatform = editorKey === "search-platform"') && contentEditor.includes('tabs={searchPlatformTabs}'));
assert.ok(searchJsxNodes(searchEditorAst).every(node => !["AdminModuleTabs", "ModuleEditorTabs"].includes(searchTag(node))), "The parent remains the only rendered tab owner; importing its shared icon does not create tabs");
const sharedTabsSource = read("src/components/admin/ui/AdminModuleTabs.tsx");
assert.ok(sharedTabsSource.includes("{tabs.map((tab) => (") && sharedTabsSource.includes("hidden={tab.id !== activeId}"), "Inactive field groups remain mounted for native FormData and draft preservation");
assert.equal(
  searchEditor.match(/^\s+hideLabel\r?$/gmu)?.length,
  3,
  "Title, description, and help text must keep accessible labels without repeating them visually",
);
for (const removedSearchActionControl of [
  'name="search_action_text"',
  'boldName="search_action_bold"',
  'alignmentName="search_action_alignment"',
  'label="نص زر البحث"',
]) {
  assert.ok(!searchEditor.includes(removedSearchActionControl));
}
assert.ok(
  !searchEditor.includes("<textarea") && !searchEditor.includes("multiline"),
  "Search description and Help Text must remain single-line controls",
);
assert.ok(searchEditor.includes('<legend className="sr-only">أنواع المحتوى</legend>'));
assert.ok(searchEditor.includes('<legend className="sr-only">الفلاتر المتاحة</legend>'));
assert.ok(searchEditor.includes('data-search-platform-option-group="content-types"'));
assert.ok(searchEditor.includes('data-search-platform-option-group="filters"'));
// Search has two premium multi-selection groups. Each option consumes the
// shared checkbox-row tile inside its three-column grid, without nested cards.
const sharedCheckboxRowImport = searchEditorAst.statements.filter(ts.isImportDeclaration).find(node =>
  ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "../../../../lib/admin/admin-ui-styles");
assert.ok(sharedCheckboxRowImport?.importClause?.namedBindings && ts.isNamedImports(sharedCheckboxRowImport.importClause.namedBindings));
assert.ok(sharedCheckboxRowImport.importClause.namedBindings.elements.some(node => !node.propertyName && node.name.text === "ADMIN_FORM"), "Search choice tiles consume the canonical shared row token directly");
const searchOptionGroupContracts = [
  { group: "content-types", legend: "أنواع المحتوى", source: "CONTENT_TYPES", option: "contentType", name: "content_types", checked: "config.contentTypes.includes(contentType)", label: "getContentTypeLabel(contentType)" },
  { group: "filters", legend: "الفلاتر المتاحة", source: "SEARCH_PLATFORM_FILTERS", option: "filter", name: "search_filters", checked: "config.filters.includes(filter)", label: "FILTER_LABELS[filter]" },
] as const;
for (const contract of searchOptionGroupContracts) {
  const groups = searchJsxNodes(searchEditorAst).filter(node => searchLiteral(node, "data-search-platform-option-group") === contract.group);
  assert.equal(groups.length, 1, `${contract.group} has one rendered group owner`);
  const group = groups[0];
  let fieldset: ts.Node | undefined = group.parent;
  while (fieldset && !(ts.isJsxElement(fieldset) && searchTag(fieldset.openingElement) === "fieldset")) fieldset = fieldset.parent;
  assert.ok(fieldset && ts.isJsxElement(fieldset), `${contract.group} remains a semantic fieldset`);
  const groupNodes = searchJsxNodes(fieldset);
  const optionGrids = groupNodes.filter(node => searchTag(node) === "AdminFormGrid");
  assert.equal(optionGrids.length, 1, `${contract.group} has one shared option grid`);
  assert.equal(searchAttribute(optionGrids[0], "columns")?.initializer?.getText(searchEditorAst), "{3}", `${contract.group} adopts the existing responsive three-column grid`);
  assert.ok(!searchAttribute(optionGrids[0], "presentation") && !searchAttribute(optionGrids[0], "className"), `${contract.group} retains shared grid breakpoints and spacing without local layout overrides`);
  const cards = groupNodes.filter(node => searchTag(node) === "AdminCard");
  assert.equal(cards.length, 1, `${contract.group} uses one grouped card, without nested option cards`);
  assert.equal(searchLiteral(cards[0], "presentation"), "premium");
  let cardAncestor: ts.Node | undefined = group.parent;
  while (cardAncestor && cardAncestor !== fieldset && cardAncestor !== cards[0].parent) cardAncestor = cardAncestor.parent;
  assert.equal(cardAncestor, cards[0].parent, `${contract.group} is contained by its premium card`);
  const legends = groupNodes.filter(node => searchTag(node) === "legend");
  assert.equal(legends.length, 1, `${contract.group} retains one native group label`);
  assert.ok(ts.isJsxElement(legends[0].parent));
  assert.equal(legends[0].parent.children.filter(ts.isJsxText).map(node => node.text.trim()).join(""), contract.legend);
  const headers = groupNodes.filter(node => searchTag(node) === "AdminFormControlHeader");
  assert.equal(headers.length, 1, `${contract.group} has one shared visible header`);
  assert.equal(searchLiteral(headers[0], "title"), contract.legend);
  assert.equal(searchLiteral(headers[0], "presentation"), "leading-icon");
  assert.ok(searchAttribute(headers[0], "icon"));
  const description = searchAttribute(headers[0], "description");
  assert.ok(description, `${contract.group} retains supporting copy`);
  const descriptionNodes = searchJsxNodes(description).filter(node => searchLiteral(node, "id"));
  assert.equal(descriptionNodes.length, 1);
  const descriptionId = searchLiteral(descriptionNodes[0], "id");
  assert.ok(descriptionId);
  assert.equal(searchLiteral(fieldset.openingElement, "aria-describedby"), descriptionId, `${contract.group} describes its fieldset with the visible header copy`);
  assert.equal(searchJsxNodes(searchEditorAst).filter(node => searchLiteral(node, "id") === descriptionId).length, 1);
  const checkboxes = groupNodes.filter(node => searchTag(node) === "AdminCheckbox");
  assert.equal(checkboxes.length, 1, `${contract.group} maps its options through one shared checkbox template`);
  const checkbox = checkboxes[0];
  assert.equal(searchLiteral(checkbox, "name"), contract.name);
  assert.equal(searchAttribute(checkbox, "value")?.initializer?.getText(searchEditorAst), `{${contract.option}}`);
  assert.equal(searchAttribute(checkbox, "defaultChecked")?.initializer?.getText(searchEditorAst), `{${contract.checked}}`);
  assert.equal(searchAttribute(checkbox, "label")?.initializer?.getText(searchEditorAst), `{${contract.label}}`);
  for (const prop of ["checked", "onChange", "onClick", "disabled", "readOnly"]) assert.ok(!searchAttribute(checkbox, prop), `${contract.group} retains native uncontrolled selection without ${prop}`);
  assert.ok(checkbox.attributes.properties.every(ts.isJsxAttribute), `${contract.group} cannot replace native bindings through a spread`);
  assert.ok(ts.isJsxElement(checkbox.parent) && searchTag(checkbox.parent.openingElement) === "label", `${contract.group} keeps the clickable native label around its checkbox`);
  const nativeLabel = checkbox.parent;
  assert.equal(searchAttribute(nativeLabel.openingElement, "className")?.initializer?.getText(searchEditorAst), "{ADMIN_FORM.checkboxRow}", `${contract.group} tiles reuse the shared frame, padding and typography without local CSS`);
  assert.ok(!searchAttribute(nativeLabel.openingElement, "style"), `${contract.group} tiles do not override their shared surface`);
  let optionGridAncestor: ts.Node | undefined = nativeLabel.parent;
  while (optionGridAncestor && optionGridAncestor !== fieldset && optionGridAncestor !== optionGrids[0].parent) optionGridAncestor = optionGridAncestor.parent;
  assert.equal(optionGridAncestor, optionGrids[0].parent, `${contract.group} native option labels are children of its three-column grid`);
  const visibleLabels = nativeLabel.children.filter(ts.isJsxElement).filter(node => searchTag(node.openingElement) === "span");
  assert.equal(visibleLabels.length, 1);
  assert.equal(searchLiteral(visibleLabels[0].openingElement, "className"), "min-w-0 flex-1", `${contract.group} tile text can shrink and align beside its native checkbox in RTL`);
  assert.equal(visibleLabels[0].children.filter(ts.isJsxExpression).map(node => node.expression?.getText(searchEditorAst)).join(""), contract.label, `${contract.group} visible and accessible option labels match`);
  let optionsMap: ts.Node | undefined = nativeLabel.parent;
  while (optionsMap && optionsMap !== fieldset && !ts.isCallExpression(optionsMap)) optionsMap = optionsMap.parent;
  assert.ok(optionsMap && ts.isCallExpression(optionsMap) && ts.isPropertyAccessExpression(optionsMap.expression), `${contract.group} uses its canonical option collection`);
  assert.equal(optionsMap.expression.name.text, "map");
  assert.equal(optionsMap.expression.expression.getText(searchEditorAst), contract.source);
  const callback = optionsMap.arguments[0];
  assert.ok(callback && ts.isArrowFunction(callback));
  assert.equal(callback.parameters.length, 1);
  assert.equal(callback.parameters[0].name.getText(searchEditorAst), contract.option);
  assert.equal(searchJsxNodes(callback.body).filter(node => searchTag(node) === "label").length, 1, `${contract.group} has no nested option labels`);
  assert.ok(groupNodes.every(node => !["button", "input", "AdminFormSwitch", "AdminFormListboxSelect"].includes(searchTag(node))), `${contract.group} keeps multi-select checkbox semantics`);
  assert.ok(groupNodes.every(node => !searchAttribute(node, "disabled") && !searchAttribute(node, "onClick")), `${contract.group} adds no disabled group or local click handler`);
}
for (const [source, path, names] of [
  [searchEditorAst, "../ModuleEditorPresentation", ["ModuleEditorVisibilityAlignRow"]],
  [ts.createSourceFile("ContentModuleEditClient.tsx", contentEditor, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), "./ModuleEditorPresentation", ["ModuleEditorPagesTab"]],
] as const) {
  for (const name of names) assert.ok(source.statements.filter(ts.isImportDeclaration).some(node =>
    ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === path &&
    node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) &&
    node.importClause.namedBindings.elements.some(binding => !binding.isTypeOnly && !binding.propertyName && binding.name.text === name)), `Search retains canonical ${name} ownership`);
}
}
assertSearchEditorAdoptionSource(searchEditor, contentEditor);

// The removed consumer selectors selected no behavior. Prove their current
// shared implementation, rather than treating an omitted prop as a surface.
function assertSearchSharedPresentationSource(presentation: string, card: string, ui: string) {
  const parse = (name: string, source: string) => ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const tree = parse("ModuleEditorPresentation.tsx", presentation);
  function nodes<T extends ts.Node>(root: ts.Node, predicate: (node: ts.Node) => node is T): T[] {
    const found: T[] = [];
    function visit(node: ts.Node) { if (predicate(node)) found.push(node); ts.forEachChild(node, visit); }
    visit(root); return found;
  }
  function attribute(node: ts.JsxOpeningElement | ts.JsxSelfClosingElement, name: string) {
    const value = node.attributes.properties.find((property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText() === name)?.initializer;
    return value && ts.isStringLiteral(value) ? value.text : value && ts.isJsxExpression(value) ? value.expression?.getText().replace(/\s+/gu, " ") : undefined;
  }
  const elements = (root: ts.Node, name: string) => nodes(root, (node): node is ts.JsxOpeningElement | ts.JsxSelfClosingElement => (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText() === name);
  function declaration(source: ts.SourceFile, name: string) {
    const matches = source.statements.filter(ts.isFunctionDeclaration).filter(node => node.name?.text === name);
    assert.equal(matches.length, 1, `One actual shared ${name} implementation`);
    assert.ok(matches[0].body); return matches[0];
  }
  function namedImport(path: string, name: string) {
    assert.ok(tree.statements.filter(ts.isImportDeclaration).some(node => ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === path && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some(binding => !binding.isTypeOnly && !binding.propertyName && binding.name.text === name)), `Shared ${name} resolves to its existing owner`);
  }
  for (const name of ["AdminCard", "AdminFormControlHeader", "AdminFormSwitch", "AdminTextFormatControls"]) namedImport("../ui", name);
  const row = declaration(tree, "ModuleEditorVisibilityAlignRow");
  assert.ok(row.body!.statements.every(node => ts.isVariableStatement(node) || ts.isReturnStatement(node) || ts.isEmptyStatement(node)), "No alternate row return path precedes the shared surface");
  const rowReturns = row.body!.statements.filter(ts.isReturnStatement);
  assert.equal(rowReturns.length, 1);
  let rowReturn = rowReturns[0].expression;
  while (rowReturn && ts.isParenthesizedExpression(rowReturn)) rowReturn = rowReturn.expression;
  assert.ok(rowReturn && ts.isJsxElement(rowReturn) && rowReturn.openingElement.tagName.getText() === "AdminCard", "The actual default row returns the canonical Card directly");
  assert.equal(attribute(rowReturn.openingElement, "presentation"), "premium");
  const header = elements(rowReturn, "AdminFormControlHeader");
  assert.equal(header.length, 1);
  for (const [name, value] of Object.entries({ title: "label", description: "description", icon: "icon", presentation: "compact-inline" })) assert.equal(attribute(header[0], name), value, `Shared row retains ${name}`);
  const mountedExpressions = nodes(rowReturn, ts.isJsxExpression).map(node => node.expression?.getText());
  assert.ok(mountedExpressions.includes("submittedValues") && mountedExpressions.includes("children"), "Shared Card retains submitted values and child fields");
  const hidden = elements(row, "input");
  assert.deepEqual(hidden.map(node => [attribute(node, "type"), attribute(node, "name"), attribute(node, "value")]), [
    ["hidden", "showName", "String(enableVisibility ? show : showDefault)"],
    ["hidden", "alignmentName", "hasAlignmentControl ? alignment : alignmentDefault"],
    ["hidden", "boldName", "String(submittedBold)"],
  ], "Shared row preserves its exact native visibility/formatting submission");
  const switches = elements(row, "AdminFormSwitch"), formatting = elements(row, "AdminTextFormatControls");
  assert.equal(switches.length, 1); assert.equal(formatting.length, 1);
  for (const [name, value] of Object.entries({ checked: "show", onChange: "(event) => setShow(event.target.checked)", surface: "false" })) assert.equal(attribute(switches[0], name), value, `Shared visibility ${name}`);
  for (const [name, value] of Object.entries({ alignment: "hasAlignmentControl ? alignment : undefined", onAlignmentChange: "hasAlignmentControl ? setAlignment : undefined", bold: "hasBoldControl ? (bold ?? false) : undefined", onBoldChange: "hasBoldControl ? setBold : undefined" })) assert.equal(attribute(formatting[0], name), value, `Shared formatting ${name}`);
  const cardTree = parse("AdminCard.tsx", card), cardOwner = declaration(cardTree, "AdminCard");
  assert.ok(cardOwner.body!.statements.length === 1 && ts.isReturnStatement(cardOwner.body!.statements[0]), "Card has one shared surface return, without a legacy branch");
  const surfaces = elements(cardOwner, "section");
  assert.equal(surfaces.length, 1);
  assert.ok(nodes(cardOwner, ts.isJsxExpression).some(node => node.expression?.getText() === "children"), "The shared Card retains its actual children");
  const className = surfaces[0].attributes.properties.find((property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText() === "className")?.initializer;
  assert.ok(className && nodes(className, ts.isIdentifier).some(node => node.text === "ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME"), "The actual default Card consumes the canonical premium surface token");
  assert.ok(cardTree.statements.filter(ts.isImportDeclaration).some(node => ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "../../../lib/admin/admin-ui-styles" && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some(binding => !binding.propertyName && binding.name.text === "ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME")));
  assert.ok(parse("ui/index.ts", ui).statements.filter(ts.isExportDeclaration).some(node => node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "./AdminCard" && node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.some(binding => binding.propertyName?.text === "default" && binding.name.text === "AdminCard")), "The UI barrel resolves AdminCard to the actual shared owner");
  const pages = declaration(tree, "ModuleEditorPagesTab");
  const parameters = pages.parameters[0].name;
  assert.ok(ts.isObjectBindingPattern(parameters) && parameters.elements.some(node => node.name.getText() === "showUsageBanner" && node.initializer?.kind === ts.SyntaxKind.TrueKeyword), "Shared Pages tab preserves the visible usage banner by default");
  for (const [name, path] of [["ModuleCrossPageUsageBanner", "./ModuleCrossPageUsageBanner"], ["ModulePageAssignmentsField", "./ModulePageAssignmentsField"]]) assert.ok(tree.statements.filter(ts.isImportDeclaration).some(node => ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === path && node.importClause?.name?.text === name), `Canonical shared assignment owner ${name}`);
  const banners = elements(pages, "ModuleCrossPageUsageBanner"), fields = elements(pages, "ModulePageAssignmentsField");
  assert.equal(banners.length, 1); assert.equal(fields.length, 2);
  assert.equal(attribute(banners[0], "moduleName"), "moduleName");
  assert.equal(attribute(banners[0], "assignments"), "assignmentContext.assignments");
  assert.ok(nodes(pages, ts.isConditionalExpression).some(node => node.condition.getText() === "showUsageBanner" && elements(node.whenTrue, "ModuleCrossPageUsageBanner").length === 1 && node.whenFalse.kind === ts.SyntaxKind.NullKeyword), "The usage default controls the actual mounted banner");
  for (const field of fields) {
    assert.equal(attribute(field, "pages"), "assignmentContext.pages");
    assert.equal(attribute(field, "assignedPageIds"), "assignmentContext.assignments.map( (row) => row.page_id, )");
  }
}
const searchPresentationSource = read("src/components/admin/page-blocks/ModuleEditorPresentation.tsx");
const searchCardSource = read("src/components/admin/ui/AdminCard.tsx");
const searchUiSource = read("src/components/admin/ui/index.ts");
assertSearchSharedPresentationSource(searchPresentationSource, searchCardSource, searchUiSource);
const searchPresentationNegatives = [
  ["parallel visibility owner", searchEditor.replace('from "../ModuleEditorPresentation";', 'from "../ParallelPresentation";'), contentEditor],
  ["lost visibility setting", searchEditor.replace('showName="show_search_title"', 'showName="missing_search_title"'), contentEditor],
  ["wrong visibility default", searchEditor.replace("showDefault={config.interfaceDisplay.title.visible}", "showDefault={false}"), contentEditor],
  ["wrong alignment default", searchEditor.replace("alignmentDefault={config.interfaceDisplay.title.alignment}", 'alignmentDefault="left"'), contentEditor],
  ["disabled text setting", searchEditor.replace('name="title"', 'name="title" disabled'), contentEditor],
  ["parallel assignment owner", searchEditor, contentEditor.replace('from "./ModuleEditorPresentation";', 'from "./ParallelPresentation";')],
  ["disconnected search assignments", searchEditor, contentEditor.replaceAll("assignmentContext={assignmentContext}", "assignmentContext={otherContext}")],
  ["hidden search usage banner", searchEditor, contentEditor.replaceAll("assignmentContext={assignmentContext}", "assignmentContext={assignmentContext} showUsageBanner={false}")],
] as const;
for (const [name, editor, parent] of searchPresentationNegatives) {
  assert.ok(editor !== searchEditor || parent !== contentEditor, `Effective negative ${name}`);
  assert.throws(() => assertSearchEditorAdoptionSource(editor, parent), name);
}
const searchOwnerNegatives = [
  ["parallel shared Card", searchPresentationSource.replace('from "../ui";', 'from "../ParallelUi";'), searchCardSource, searchUiSource],
  ["lost row surface", searchPresentationSource.replace('<AdminCard presentation="premium" className={`self-start p-3 ${className}`.trim()}>', '<section className={`self-start p-3 ${className}`.trim()}>'), searchCardSource, searchUiSource],
  ["lost submitted values", searchPresentationSource.replace("{submittedValues}", "{null}"), searchCardSource, searchUiSource],
  ["wrong visibility submission", searchPresentationSource.replace("String(enableVisibility ? show : showDefault)", '"false"'), searchCardSource, searchUiSource],
  ["disconnected visibility callback", searchPresentationSource.replace("setShow(event.target.checked)", "setShow(false)"), searchCardSource, searchUiSource],
  ["disconnected formatting callback", searchPresentationSource.replace("hasBoldControl ? setBold : undefined", "undefined"), searchCardSource, searchUiSource],
  ["lost default Card token", searchPresentationSource, searchCardSource.replaceAll("ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME", "LOCAL_SURFACE"), searchUiSource],
  ["parallel Card barrel", searchPresentationSource, searchCardSource, searchUiSource.replace('from "./AdminCard";', 'from "./ParallelCard";')],
  ["hidden usage by default", searchPresentationSource.replace("showUsageBanner = true", "showUsageBanner = false"), searchCardSource, searchUiSource],
  ["lost assignment IDs", searchPresentationSource.replaceAll("(row) => row.page_id", "(row) => row.id"), searchCardSource, searchUiSource],
] as const;
for (const [name, presentation, card, ui] of searchOwnerNegatives) {
  assert.ok(presentation !== searchPresentationSource || card !== searchCardSource || ui !== searchUiSource, `Effective negative ${name}`);
  assert.throws(() => assertSearchSharedPresentationSource(presentation, card, ui), name);
}
console.log(`PASS Search shared-default presentation: exact current owner/delegation, native bindings, and ${searchPresentationNegatives.length + searchOwnerNegatives.length} source regression negatives.`);
for (const englishProductCopy of [
  'label="Placeholder"',
  'label="Help Text"',
  'label="Search Scope"',
  'label="Presentation"',
  'label="Default Sort"',
  ">Content Types<",
  "Unified Content",
]) {
  assert.ok(
    !searchEditor.includes(englishProductCopy),
    `Search editor must not expose English product copy: ${englishProductCopy}`,
  );
}
assert.ok(
  moduleRegistryMetadata.includes(
    "مصدر النتائج هو نظام قراءة المحتوى العام، والظهور مملوك لتعيينات الصفحات",
  ) && !moduleRegistryMetadata.includes("Public Content Read"),
  "Search editor header copy must remain product-facing Arabic without changing the runtime owner",
);
assert.ok(contentActions.includes("buildSearchPlatformConfig"));
assert.ok(
  contentActions.includes("buildSearchPlatformInterfaceDisplayFromFormData") &&
    contentActions.includes("interfaceDisplay: buildSearchPlatformInterfaceDisplayFromFormData("),
  "Search save must map interface formatting through the Search Platform owner",
);
assert.ok(pageSlotLayout.includes("hasActiveSearchPlatformQuery"));
assert.ok(pageSlotLayout.includes("isSearchPlatformTemplate"));
assert.ok(pageSlotLayout.includes("suppressFeaturedDuringSearch"));
assert.ok(!pageSlotLayout.includes('"/topics"'));
assert.ok(
  mediaSlotPlan.includes("context.suppressFeaturedDuringSearch ||") &&
    mediaSlotPlan.includes("!isFeaturedModuleRenderable(entry.module)"),
  "Active Search Platform results must project Featured assignments out of the shared render plan",
);
assert.ok(
  slotPresentationContract.includes("suppressFeaturedDuringSearch?: boolean") &&
    slotRenderer.includes('from "./slot-module-presentation-contract"'),
  "The shared slot-render context must own the search-mode projection flag",
);

const interfaceForm = new FormData();
interfaceForm.set("show_search_title", "false");
interfaceForm.set("search_title_bold", "false");
interfaceForm.set("search_title_alignment", "left");
interfaceForm.set("show_search_description", "true");
interfaceForm.set("search_description_bold", "true");
interfaceForm.set("search_description_alignment", "center");
interfaceForm.set("show_search_help_text", "false");
interfaceForm.set("search_help_text_bold", "true");
interfaceForm.set("search_help_text_alignment", "left");
interfaceForm.set("show_search_action", "true");
interfaceForm.set("show_search_results_title", "false");
interfaceForm.set("search_results_title_bold", "true");
interfaceForm.set("search_results_title_alignment", "left");
interfaceForm.set("empty_results_title", "لا شيء هنا");
interfaceForm.set("empty_results_description", "جرّب صياغة أخرى.");

const savedInterfaceDisplay =
  buildSearchPlatformInterfaceDisplayFromFormData(interfaceForm);
assert.deepEqual(savedInterfaceDisplay, {
  title: { visible: false, bold: false, alignment: "left" },
  description: { visible: true, bold: true, alignment: "center" },
  helpText: { visible: false, bold: true, alignment: "left" },
  searchAction: { visible: true },
  resultsTitle: { visible: false, bold: true, alignment: "left" },
  emptyResults: {
    title: "لا شيء هنا",
    description: "جرّب صياغة أخرى.",
  },
});
assert.deepEqual(
  resolveSearchPlatformInterfaceDisplay(savedInterfaceDisplay),
  savedInterfaceDisplay,
  "Search parser must preserve every saved interface control",
);
assert.deepEqual(
  asSearchPlatformConfig({ interfaceDisplay: savedInterfaceDisplay })
    .interfaceDisplay,
  savedInterfaceDisplay,
  "Search config must carry saved interface formatting to Public UI",
);
assert.deepEqual(
  resolveSearchPlatformInterfaceDisplay(undefined),
  DEFAULT_SEARCH_PLATFORM_INTERFACE_DISPLAY,
  "Existing Search modules must receive backward-compatible formatting defaults",
);
assert.deepEqual(
  resolveSearchPlatformInterfaceDisplay({
    searchAction: {
      visible: false,
      text: "Legacy label",
      bold: true,
      alignment: "center",
    },
  }).searchAction,
  { visible: false },
  "Legacy Search action formatting must resolve safely to the icon visibility contract",
);

// Exercise the real private Action builder using the established source-extraction
// technique. Import only its real pure dependencies, never the Server Action or DB.
const searchContentTypes = await jiti.import<typeof import("../src/lib/admin/content/content-types.ts")>("../src/lib/admin/content/content-types.ts");
const searchAdminUtils = await jiti.import<typeof import("../src/lib/page-blocks/admin-utils.ts")>("../src/lib/page-blocks/admin-utils.ts");
const searchMetadataOwner = await jiti.import<typeof import("../src/lib/page-composition/module-registry-metadata.ts")>("../src/lib/page-composition/module-registry-metadata.ts");
const searchRegistryOwner = await jiti.import<typeof import("../src/lib/page-blocks/module-edit-registry.ts")>("../src/lib/page-blocks/module-edit-registry.ts");
const searchActionsAst = ts.createSourceFile("actions.ts", contentActions, ts.ScriptTarget.Latest, true);
const searchBuilders = searchActionsAst.statements.filter((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "buildSearchPlatformConfig");
assert.equal(searchBuilders.length, 1);
const searchBuilderDependencies = {
  cleanText: searchAdminUtils.cleanText,
  isContentType: searchContentTypes.isContentType,
  SEARCH_PLATFORM_SCOPES,
  SEARCH_PLATFORM_PRESENTATIONS,
  SEARCH_PLATFORM_RESULT_LIMITS,
  SEARCH_PLATFORM_FILTERS,
  buildSearchPlatformInterfaceDisplayFromFormData,
};
const searchBuilderJavascript = ts.transpileModule(searchBuilders[0].getText(searchActionsAst), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const actualSearchBuilder = new Function(...Object.keys(searchBuilderDependencies), searchBuilderJavascript + "\nreturn buildSearchPlatformConfig;")(...Object.values(searchBuilderDependencies)) as (form: FormData) => import("../src/lib/page-blocks/search-platform-config.ts").SearchPlatformConfig;
function searchContractForm() {
  const form = new FormData();
  for (const [key, value] of interfaceForm) form.append(key, value);
  for (const name of searchTextNames) form.set(name, `${name}: نص حرفي *نجمة* <tag> & "اقتباس" ١٢٣`);
  form.set("search_scope", "selected");
  form.append("content_types", "article");
  form.append("content_types", "news");
  for (const filter of SEARCH_PLATFORM_FILTERS) form.append("search_filters", filter);
  form.set("result_limit", "12");
  form.set("search_presentation", "full-grid");
  form.set("default_sort", "newest");
  return form;
}
assert.deepEqual([...SEARCH_PLATFORM_SCOPES], ["all", "selected"]);
assert.deepEqual([...SEARCH_PLATFORM_PRESENTATIONS], ["compact", "full-list", "full-grid"]);
assert.deepEqual([...SEARCH_PLATFORM_RESULT_LIMITS], [6, 9, 12, 24]);
assert.deepEqual([...SEARCH_PLATFORM_FILTERS], ["content-type", "category", "series"]);
assert.deepEqual([...searchContentTypes.CONTENT_TYPES], ["article", "news", "press", "site_update", "video", "gallery"]);
let searchRoundtrips = 0;
for (const scope of SEARCH_PLATFORM_SCOPES) {
  for (const presentation of SEARCH_PLATFORM_PRESENTATIONS) {
    for (const limit of SEARCH_PLATFORM_RESULT_LIMITS) {
      for (const sort of ["newest", "oldest"] as const) {
        const form = searchContractForm();
        form.set("search_scope", scope);
        form.set("search_presentation", presentation);
        form.set("result_limit", String(limit));
        form.set("default_sort", sort);
        form.delete("content_types");
        const types = scope === "all" ? [...searchContentTypes.CONTENT_TYPES] : ["article", "news"];
        for (const type of types) form.append("content_types", type);
        const built = actualSearchBuilder(form);
        const reloaded = asSearchPlatformConfig(JSON.parse(JSON.stringify(built)));
        assert.deepEqual(reloaded, built, `${scope}/${presentation}/${limit}/${sort}: actual Action config survives JSON save/read`);
        assert.deepEqual(reloaded, {
          title: form.get("title"), description: form.get("description"), placeholder: form.get("placeholder"), helpText: form.get("help_text"),
          scope, contentTypes: types, resultLimit: limit, presentation, filters: [...SEARCH_PLATFORM_FILTERS], defaultSort: sort,
          interfaceDisplay: { ...savedInterfaceDisplay, emptyResults: { title: form.get("empty_results_title"), description: form.get("empty_results_description") } },
        }, "Every authored field, literal character and formatting state retains its original meaning");
        searchRoundtrips += 1;
      }
    }
  }
}
assert.equal(searchRoundtrips, 48);
for (const type of searchContentTypes.CONTENT_TYPES) {
  const form = searchContractForm();
  form.delete("content_types");
  form.append("content_types", type);
  assert.deepEqual(asSearchPlatformConfig(actualSearchBuilder(form)).contentTypes, [type], `Selected scope accepts ${type}`);
}
for (const name of searchTextNames) {
  const form = searchContractForm();
  form.set(name, "  ");
  assert.throws(() => actualSearchBuilder(form), /أكمل/u, `${name} remains required at the save boundary`);
}
for (const [name, invalidValues] of Object.entries({ search_scope: ["", "topics", "__proto__"], result_limit: ["0", "1", "5", "10", "13", "25", "NaN"], search_presentation: ["", "list", "hero"], default_sort: ["", "popular", "random"] })) {
  for (const value of invalidValues) {
    const form = searchContractForm();
    form.set(name, value);
    assert.throws(() => actualSearchBuilder(form), /غير مدعوم/u, `${name} rejects ${value}`);
  }
}
const noTypesForm = searchContractForm();
noTypesForm.delete("content_types");
assert.throws(() => actualSearchBuilder(noTypesForm), /نوع محتوى واحد/u);
noTypesForm.append("content_types", "not-a-content-type");
assert.throws(() => actualSearchBuilder(noTypesForm), /نوع محتوى واحد/u);
noTypesForm.set("search_scope", "all");
assert.deepEqual(actualSearchBuilder(noTypesForm).contentTypes, [], "All-scope writes retain the existing submitted-list contract");
assert.deepEqual(asSearchPlatformConfig(actualSearchBuilder(noTypesForm)).contentTypes, [...searchContentTypes.CONTENT_TYPES], "All-scope reads intentionally expand to every canonical type");
const sanitizedForm = searchContractForm();
sanitizedForm.append("content_types", "not-a-content-type");
sanitizedForm.append("content_types", "article");
sanitizedForm.append("search_filters", "unsafe-filter");
sanitizedForm.append("search_filters", "category");
const sanitizedBuilt = actualSearchBuilder(sanitizedForm);
assert.deepEqual(sanitizedBuilt.contentTypes, ["article", "news", "article"]);
assert.deepEqual(sanitizedBuilt.filters, [...SEARCH_PLATFORM_FILTERS, "category"]);
assert.deepEqual(asSearchPlatformConfig(sanitizedBuilt).contentTypes, ["article", "news"]);
assert.deepEqual(asSearchPlatformConfig(sanitizedBuilt).filters, [...SEARCH_PLATFORM_FILTERS]);
sanitizedForm.delete("search_filters");
assert.deepEqual(asSearchPlatformConfig(actualSearchBuilder(sanitizedForm)).filters, [], "An explicitly empty filter selection remains empty");
const literalLegacy = "نص قديم *حرفي* <tag> & ١٢٣";
const legacySearchConfig = asSearchPlatformConfig({
  title: literalLegacy, description: literalLegacy, placeholder: literalLegacy,
  help_text: literalLegacy, scope: "selected", contentTypes: ["news", "news", "invalid"], result_limit: "24", presentation: "full-list", default_sort: "oldest", filters: ["series", "series", "invalid"],
  interface_display: { title: { visible: "false", bold: "true", alignment: "left" }, help_text: { visible: "0", bold: "1", alignment: "center" }, search_action: { visible: false }, results_title: { visible: false, bold: true, alignment: "right" }, empty_results: { title: literalLegacy, description: literalLegacy } },
});
assert.equal(legacySearchConfig.title, literalLegacy);
assert.equal(legacySearchConfig.description, literalLegacy);
assert.equal(legacySearchConfig.placeholder, literalLegacy);
assert.equal(legacySearchConfig.helpText, literalLegacy);
assert.equal(legacySearchConfig.resultLimit, 24);
assert.equal(legacySearchConfig.presentation, "full-list");
assert.equal(legacySearchConfig.defaultSort, "oldest");
assert.deepEqual(legacySearchConfig.contentTypes, ["news"]);
assert.deepEqual(legacySearchConfig.filters, ["series"]);
assert.deepEqual(legacySearchConfig.interfaceDisplay.title, { visible: false, bold: true, alignment: "left" });
assert.deepEqual(legacySearchConfig.interfaceDisplay.helpText, { visible: false, bold: true, alignment: "center" });
assert.deepEqual(legacySearchConfig.interfaceDisplay.searchAction, { visible: false });
assert.deepEqual(legacySearchConfig.interfaceDisplay.resultsTitle, { visible: false, bold: true, alignment: "right" });
assert.deepEqual(legacySearchConfig.interfaceDisplay.emptyResults, { title: literalLegacy, description: literalLegacy });
for (const [slug, variant] of [["search-platform", "default"], ["topics-search", "search-platform"], ["qa-new-search-consumer", "search-platform"]]) {
  assert.equal(isSearchPlatformTemplate(slug, variant), true);
  assert.equal(searchRegistryOwner.getContentModuleEditorKey(slug, variant), "search-platform");
  assert.deepEqual(searchRegistryOwner.resolveContentModuleEditorConfig({ slug, variant, config: legacySearchConfig }), legacySearchConfig, "Every family alias consumes the same canonical reader");
}
assert.equal(isSearchPlatformTemplate("home-story", "default"), false);
const searchTabIds = ["content", "search", "presentation", "pages"];
assert.deepEqual(searchTabIds.map(id => searchMetadataOwner.getModuleEditorSectionMetadata("content", id, "search-platform")?.navigationLabelAr), ["النصوص", "إعدادات البحث", "إعدادات العرض", "الظهور"]);
for (const id of searchTabIds) {
  assert.equal(searchAdminUtils.resolveModuleEditorTabId(id, searchTabIds), id, `Existing and new ${id} navigation remains addressable`);
  const redirectForm = new FormData();
  redirectForm.set("module_editor_tab", id);
  redirectForm.set("return_page_id", "14");
  redirectForm.set("return_to", "/admin/pages-blocks/pages");
  const redirect = new URL(searchAdminUtils.withModuleEditorReturnContextFromForm("/admin/pages-blocks/blocks/content/187?saved=1", redirectForm), "http://localhost:3000");
  assert.equal(redirect.searchParams.get("tab"), id, `${id} survives the actual save redirect owner`);
  assert.equal(redirect.searchParams.get("returnPageId"), "14");
  assert.equal(redirect.searchParams.get("saved"), "1");
}
assert.equal(searchAdminUtils.resolveModuleEditorTabId("unsupported", searchTabIds), "content");
console.log(`PASS Search UI adoption: exact 25-field inventory, four flat tabs, ${searchRoundtrips} actual Action/JSON/read roundtrips, canonical limits, invalid-input rejection and legacy aliases.`);
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
  "PASS Search Platform: unified owner, full /search identity, canonical preview navigation, explicit runtime states, and single-target keyboard-accessible results are intact.",
);
