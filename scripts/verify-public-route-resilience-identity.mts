import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { createJiti } from "jiti";

import {
  ADMIN_STATIC_ROUTES,
  PUBLIC_DYNAMIC_PAGE_ROUTES,
  PUBLIC_PAGE_ROUTE_REGISTRY,
  PUBLIC_STATIC_PAGE_ROUTES,
  getPublicDynamicPageRoute,
  getPublicPageRoute,
  interpolatePublicRoute,
} from "../src/lib/admin/links/static-routes.ts";
import type { MediaDetailPageKey } from "../src/lib/media-center/detail-page-config.ts";
import type { MediaListingPageKey } from "../src/lib/media-center/listing-page-config.ts";
import type { MediaContentType } from "../src/lib/media-center/types.ts";

const ROOT = resolve(import.meta.dirname, "..");
const APP_ROOT = resolve(ROOT, "src/app");
const SITE_ROOT = resolve(APP_ROOT, "(site)");
const jiti = createJiti(import.meta.url);
const {
  resolvePublicContentBasePath,
  resolvePublicContentPageRoute,
  resolvePublicContentPath,
} = await jiti.import<
  typeof import("../src/lib/content/public-content-path.ts")
>("../src/lib/content/public-content-path.ts");
const { MEDIA_DETAIL_PAGE_CONFIG } = await jiti.import<
  typeof import("../src/lib/media-center/detail-page-config.ts")
>("../src/lib/media-center/detail-page-config.ts");
const { MEDIA_LISTING_PAGE_CONFIG } = await jiti.import<
  typeof import("../src/lib/media-center/listing-page-config.ts")
>("../src/lib/media-center/listing-page-config.ts");
const {
  parseProjectsHubFeaturedPublicConfig,
  parseProjectsHubHeroPublicConfig,
  parseProjectsHubListingPublicConfig,
  parseProjectsHubMapPublicConfig,
} = await jiti.import<
  typeof import("../src/lib/page-blocks/projects-hub-config.ts")
>("../src/lib/page-blocks/projects-hub-config.ts");
const { getProjectHref, getProjectTrackHref } = await jiti.import<
  typeof import("../src/lib/projects/public-helpers.ts")
>("../src/lib/projects/public-helpers.ts");

const read = (path: string) =>
  readFileSync(resolve(ROOT, path), "utf8").replace(/\r\n?/gu, "\n");

function walkFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(root, entry.name);
    return entry.isDirectory() ? walkFiles(path) : [path];
  });
}

function appRouteForPageFile(pageFile: string) {
  const segments = relative(APP_ROOT, dirname(pageFile))
    .split(/[\\/]/u)
    .filter((segment) => segment && !/^\(.+\)$/u.test(segment));
  return segments.length ? `/${segments.join("/")}` : "/";
}

function sorted(values: readonly string[]) {
  return [...values].sort((left, right) => left.localeCompare(right, "en"));
}

const sourceFiles = walkFiles(resolve(ROOT, "src")).filter((path) =>
  /\.[cm]?[jt]sx?$/u.test(path),
);
const sourceEntries = sourceFiles.map((path) => ({
  path: relative(ROOT, path).replace(/\\/gu, "/"),
  source: readFileSync(path, "utf8").replace(/\r\n?/gu, "\n"),
}));

const registryDeclarations = sourceEntries.filter(({ source }) =>
  /\bexport\s+const\s+PUBLIC_PAGE_ROUTE_REGISTRY\s*=\s*\[/u.test(source),
);
assert.deepEqual(
  registryDeclarations.map(({ path }) => path),
  ["src/lib/admin/links/static-routes.ts"],
  "PUBLIC_PAGE_ROUTE_REGISTRY must have one literal source declaration",
);

const routeOwnerSource = read("src/lib/admin/links/static-routes.ts");
assert.match(
  routeOwnerSource,
  /export const PUBLIC_PAGE_ROUTE_REGISTRY\s*=\s*\[[\s\S]*?\]\s*as const satisfies readonly PublicPageRouteRegistration\[\]/u,
  "public route owner must remain a literal typed registry",
);
assert.ok(
  routeOwnerSource.includes(
    "PUBLIC_STATIC_PAGE_ROUTES = PUBLIC_PAGE_ROUTE_REGISTRY.filter",
  ) &&
    routeOwnerSource.includes(
      "PUBLIC_DYNAMIC_PAGE_ROUTES = PUBLIC_PAGE_ROUTE_REGISTRY.filter",
    ) &&
    routeOwnerSource.includes(
      "ADMIN_STATIC_ROUTES = PUBLIC_STATIC_PAGE_ROUTES",
    ),
  "static, dynamic, and Admin inventories must be projections of the registry",
);

assert.equal(
  new Set(PUBLIC_PAGE_ROUTE_REGISTRY.map((route) => route.key)).size,
  PUBLIC_PAGE_ROUTE_REGISTRY.length,
  "public route keys must be unique",
);
assert.equal(
  new Set(PUBLIC_PAGE_ROUTE_REGISTRY.map((route) => route.href)).size,
  PUBLIC_PAGE_ROUTE_REGISTRY.length,
  "public route hrefs must be unique",
);
const cmsPageSlugs = PUBLIC_PAGE_ROUTE_REGISTRY.flatMap((route) =>
  "cmsPageSlug" in route && route.cmsPageSlug ? [route.cmsPageSlug] : [],
);
assert.equal(
  new Set(cmsPageSlugs).size,
  cmsPageSlugs.length,
  "public CMS page slugs must be unique",
);
assert.deepEqual(
  PUBLIC_STATIC_PAGE_ROUTES.map((route) => route.key),
  PUBLIC_PAGE_ROUTE_REGISTRY.filter((route) => route.linkableFromAdmin).map(
    (route) => route.key,
  ),
  "static routes must be the linkable registry projection",
);
assert.deepEqual(
  PUBLIC_DYNAMIC_PAGE_ROUTES.map((route) => route.key),
  PUBLIC_PAGE_ROUTE_REGISTRY.filter(
    (route) => route.verification === "compiled_dynamic",
  ).map((route) => route.key),
  "dynamic routes must be the compiled registry projection",
);
assert.strictEqual(
  ADMIN_STATIC_ROUTES,
  PUBLIC_STATIC_PAGE_ROUTES,
  "Admin links must reuse the static projection by reference",
);
for (const route of PUBLIC_PAGE_ROUTE_REGISTRY) {
  assert.equal(
    route.verification,
    route.href.includes("[") ? "compiled_dynamic" : "http_exact",
    `${route.key} verification must match its App Router shape`,
  );
}

const sitePageFiles = walkFiles(SITE_ROOT).filter((path) =>
  /[\\/]page\.tsx$/u.test(path),
);
const publicPageFiles = [
  ...sitePageFiles,
  resolve(APP_ROOT, "maintenance/page.tsx"),
];
const appRouterInventory = publicPageFiles.map(appRouteForPageFile);
assert.equal(sitePageFiles.length, 21, "the current public site inventory must contain 21 pages");
assert.equal(
  publicPageFiles.length,
  22,
  "the executable public inventory must contain 21 site pages plus maintenance",
);
assert.deepEqual(
  sorted(appRouterInventory),
  sorted(PUBLIC_PAGE_ROUTE_REGISTRY.map((route) => route.href)),
  "the registry must exactly match the executable public App Router inventory",
);

const forbiddenParallelRouteOwners = sourceEntries.filter(({ source }) =>
  /\bgetDynamicLabel\b|\bMEDIA_TYPE_PATHS\b/u.test(source),
);
assert.deepEqual(
  forbiddenParallelRouteOwners.map(({ path }) => path),
  [],
  "parallel public route label/path owners must stay absent",
);

const publicContentPathSource = read("src/lib/content/public-content-path.ts");
assert.ok(
  publicContentPathSource.includes("getPublicPageRoute(") &&
    publicContentPathSource.includes("getPublicDynamicPageRoute(") &&
    publicContentPathSource.includes("interpolatePublicRoute(") &&
    !/['"]\/(?:topics|media-center)(?:\/|['"])/u.test(
      publicContentPathSource,
    ),
  "public content helpers must project paths from registry keys without path literals",
);

const contentRouteCases = [
  { type: "article", listingKey: "topics", detailKey: "topic-detail" },
  { type: "news", listingKey: "media-news", detailKey: "media-news-detail" },
  { type: "press", listingKey: "media-press", detailKey: "media-press-detail" },
  {
    type: "site_update",
    listingKey: "media-site-updates",
    detailKey: "media-site-update-detail",
  },
  { type: "video", listingKey: "media-videos", detailKey: "media-video-detail" },
  { type: "gallery", listingKey: "media-gallery", detailKey: "media-gallery-detail" },
] as const;
for (const routeCase of contentRouteCases) {
  const pageRoute = resolvePublicContentPageRoute(routeCase.type);
  const detailRoute = getPublicDynamicPageRoute(routeCase.detailKey);
  assert.deepEqual(pageRoute, getPublicPageRoute(routeCase.listingKey));
  assert.equal(resolvePublicContentBasePath(routeCase.type), pageRoute.href);
  assert.equal(
    resolvePublicContentPath(routeCase.type, "identity-guard"),
    interpolatePublicRoute(detailRoute.href, { slug: "identity-guard" }),
  );
}

const projectHelpersSource = read("src/lib/projects/public-helpers.ts");
assert.ok(
  projectHelpersSource.includes('getPublicDynamicPageRoute("project-detail")') &&
    projectHelpersSource.includes('getPublicDynamicPageRoute("tracking-detail")') &&
    (projectHelpersSource.match(/interpolatePublicRoute\(/gu) ?? []).length >= 2 &&
    !projectHelpersSource.includes('"/projects/') &&
    !projectHelpersSource.includes('"/track-your-project/'),
  "Project and tracking helpers must derive dynamic hrefs from the public registry",
);
assert.equal(getProjectHref({ slug: "identity-guard" }), "/projects/identity-guard");
assert.equal(
  getProjectTrackHref({ slug: "identity-guard" }),
  "/track-your-project/identity-guard",
);

const routeConsumerSources = {
  topicCard: read("src/components/topics/TopicCard.tsx"),
  topicDetail: read("src/app/(site)/topics/[slug]/page.tsx"),
  trackingExperience: read(
    "src/components/track/ProjectTrackingExperience.tsx",
  ),
  projectPublishReview: read(
    "src/components/admin/projects/ProjectPublishChecklistPanel.tsx",
  ),
  projectPublishingContract: read(
    "src/lib/admin/projects/project-publishing-capability.ts",
  ),
  trackingCollections: read(
    "src/components/admin/projects/tracking/TrackingCollections.tsx",
  ),
};
assert.ok(
  routeConsumerSources.topicCard.includes(
    'resolvePublicContentPath("article", slug)',
  ) &&
    routeConsumerSources.topicDetail.includes(
      'resolvePublicContentPageRoute("article").cmsPageSlug',
    ),
  "Topic detail and card consumers must project identity from the content route owner",
);
assert.ok(
  routeConsumerSources.trackingExperience.includes(
    "getProjectTrackHref(detail.project)",
  ) &&
    routeConsumerSources.projectPublishReview.includes(
      "getProjectHref(project)",
    ) &&
    routeConsumerSources.projectPublishingContract.includes(
      "publicView: getProjectHref(input)",
    ) &&
    (routeConsumerSources.trackingCollections.match(/getProjectTrackHref\(/gu) ?? [])
      .length >= 2,
  "Project and tracking public-link consumers must use the project route owner",
);

const seoRoutesSource = read("src/config/seo/seo-routes.ts");
const adminRevalidateSource = read("src/lib/page-blocks/admin-revalidate.ts");
const footerDefaultsSource = read("src/lib/footer/defaults.ts");
const mediaSidebarConfigSource = read(
  "src/lib/media-sidebar-modules/parse-config.ts",
);
assert.ok(
  seoRoutesSource.includes("getPublicPageRoute") &&
    seoRoutesSource.includes("pathFor(") &&
    adminRevalidateSource.includes("PUBLIC_STATIC_PAGE_ROUTES") &&
    adminRevalidateSource.includes("findPublicPageRouteByCmsSlug") &&
    footerDefaultsSource.includes('getPublicPageRoute("media-center").href') &&
    mediaSidebarConfigSource.includes(
      'getPublicPageRoute("media-center").href',
    ),
  "SEO, revalidation, Footer, and Media Sidebar consumers must project fixed paths from the registry",
);

const compositionTypesSource = read(
  "src/lib/page-blocks/page-composition-types.ts",
);
const compositionLoaderSource = read(
  "src/lib/page-blocks/load-page-composition.ts",
);
const slotLayoutSource = read(
  "src/components/page-composition/PageSlotLayout.tsx",
);
assert.ok(
  compositionTypesSource.includes("pageIdentity: PublicPageIdentity | null") &&
    compositionLoaderSource.includes("getPublishedPageStateBySlug") &&
    compositionLoaderSource.includes("toPublicPageIdentity") &&
    compositionLoaderSource.includes(
      "pageIdentity: pageState.page ? toPublicPageIdentity(pageState.page) : null",
    ),
  "Page Composition must carry the canonical published page identity",
);
assert.ok(
  slotLayoutSource.includes(
    "breadcrumbCurrentLabel ?? composition.pageIdentity?.title",
  ) &&
    slotLayoutSource.includes("publicPath ?? composition.pageIdentity?.path") &&
    !slotLayoutSource.includes(
      "composition.pageIdentity?.title ?? breadcrumbCurrentLabel",
    ) &&
    !slotLayoutSource.includes("composition.pageIdentity?.path ?? publicPath"),
  "PageSlotLayout must honor explicit identity overrides before the composition default",
);

const listingConfigSource = read(
  "src/lib/media-center/listing-page-config.ts",
);
const detailConfigSource = read("src/lib/media-center/detail-page-config.ts");
for (const [label, source] of [
  ["Media listing", listingConfigSource],
  ["Media detail", detailConfigSource],
] as const) {
  assert.doesNotMatch(
    source,
    /\b(?:basePath|metadataPath|cmsPageSlug|breadcrumbSectionLabel)\b/u,
    `${label} config must remain copy/presentation-only`,
  );
}

const mediaDetailCases: ReadonlyArray<{
  route: string;
  key: MediaDetailPageKey & MediaListingPageKey;
  type: MediaContentType;
  detailRouteKey:
    | "media-news-detail"
    | "media-press-detail"
    | "media-site-update-detail"
    | "media-video-detail"
    | "media-gallery-detail";
}> = [
  { route: "news", key: "news", type: "news", detailRouteKey: "media-news-detail" },
  { route: "press", key: "press", type: "press", detailRouteKey: "media-press-detail" },
  {
    route: "site-updates",
    key: "site-updates",
    type: "site_update",
    detailRouteKey: "media-site-update-detail",
  },
  { route: "videos", key: "videos", type: "video", detailRouteKey: "media-video-detail" },
  { route: "gallery", key: "gallery", type: "gallery", detailRouteKey: "media-gallery-detail" },
];
assert.deepEqual(
  sorted(Object.keys(MEDIA_LISTING_PAGE_CONFIG)),
  sorted(mediaDetailCases.map(({ key }) => key)),
  "Media listing config keys must match the five route families",
);
assert.deepEqual(
  sorted(Object.keys(MEDIA_DETAIL_PAGE_CONFIG)),
  sorted(mediaDetailCases.map(({ key }) => key)),
  "Media detail config keys must match the five route families",
);
for (const routeCase of mediaDetailCases) {
  const routeSource = read(
    `src/app/(site)/media-center/${routeCase.route}/[slug]/page.tsx`,
  );
  assert.equal(MEDIA_LISTING_PAGE_CONFIG[routeCase.key].mediaType, routeCase.type);
  assert.equal(MEDIA_DETAIL_PAGE_CONFIG[routeCase.key].mediaType, routeCase.type);
  assert.equal(
    getPublicDynamicPageRoute(routeCase.detailRouteKey).href,
    `/media-center/${routeCase.route}/[slug]`,
  );
  assert.ok(
    routeSource.includes(
      `generateMediaDetailMetadata("${routeCase.key}", props)`,
    ) &&
      routeSource.includes(`configKey="${routeCase.key}"`) &&
      routeSource.includes("const { slug } = await params"),
    `${routeCase.route} detail route must preserve its matching metadata/config identity`,
  );
  assert.doesNotMatch(
    routeSource,
    /loadPageCompositionBySlug|PageSlotLayout|PageSlotContent|listingContext|searchParams/u,
    `${routeCase.route} detail route must not inherit Listing composition`,
  );
}

const mediaDetailPageSource = read(
  "src/components/media-center/MediaDetailPage.tsx",
);
const mediaDetailArticleSource = read(
  "src/components/media-center/MediaDetailArticle.tsx",
);
const dynamicHeroSource = read("src/components/sections/DynamicHeroSection.tsx");
assert.doesNotMatch(
  mediaDetailPageSource,
  /loadPageCompositionBySlug|PageSlotLayout|PageSlotContent|getHeroSlotPeerEntries|listingContext|searchParams/u,
  "the shared Media detail runtime must stay isolated from Listing composition",
);
assert.ok(
  mediaDetailPageSource.includes(
    "const sectionIdentity = resolvePublicContentPageRoute(config.mediaType)",
  ) &&
    mediaDetailPageSource.includes(
      "getPublishedPageStateBySlug(\n    sectionIdentity.cmsPageSlug",
    ) &&
    mediaDetailPageSource.includes("const pagePath = getMediaHref(item)"),
  "Media detail labels, CMS identity, and entity href must come from current owners",
);
assert.ok(
  mediaDetailPageSource.includes("showTitle={item.showTitleOnPage !== false}") &&
    mediaDetailPageSource.includes("{item.showTitleOnPage === false ? (") &&
    mediaDetailPageSource.includes('<h1 className="sr-only">{item.title}</h1>') &&
    dynamicHeroSource.includes("fallbackVisibility={fallbackVisibility}") &&
    dynamicHeroSource.includes("return <h1 className={titleClass}>{title}</h1>") &&
    !mediaDetailArticleSource.includes("<h1"),
  "Media detail must expose exactly one semantic H1, including the hidden-title fallback",
);
assert.ok(
  [
    'item.type === "gallery" && item.galleryImages?.length',
    "item.galleryImages.map((image, index)",
    "data-public-media-gallery",
    "data-public-media-gallery-item",
    "src={image.url}",
    'alt={image.alt ?? ""}',
    "{image.caption ? (",
    "{image.caption}",
    "data-public-media-markdown",
    "<RichTextContent",
    "value={content}",
    'mode="markdown"',
    "demoteHeadings",
  ].every((token) => mediaDetailArticleSource.includes(token)) &&
    mediaDetailPageSource.includes(
      "item.topicId ? <TopicViewTracker topicId={item.topicId} /> : null",
    ),
  "Media detail Gallery, Markdown, alt, caption, and view-tracking contracts must remain intact",
);

const projectsPlanSource = read(
  "src/lib/projects/build-projects-hub-render-plan.ts",
);
const projectsPlanLoaderSource = read(
  "src/lib/projects/load-and-build-projects-hub-plan.ts",
);
const projectsCompositionSource = read(
  "src/lib/projects/load-projects-hub-composition.ts",
);
const projectsConfigSource = read(
  "src/lib/page-blocks/projects-hub-config.ts",
);
const projectsRouteSource = read("src/app/(site)/projects/page.tsx");
assert.ok(
  projectsRouteSource.includes('getPublicPageRoute("projects")') &&
    projectsRouteSource.includes("path: PAGE_IDENTITY.href") &&
    projectsCompositionSource.includes('getPublicPageRoute("projects")') &&
    projectsCompositionSource.includes(
      "PROJECTS_HUB_PAGE_IDENTITY.cmsPageSlug",
    ) &&
    !projectsCompositionSource.includes(
      'PROJECTS_HUB_PAGE_SLUG = "projects"',
    ),
  "Projects metadata and CMS lookup must derive from the public route registry",
);
for (const status of ["ready", "unavailable", "error"] as const) {
  assert.ok(
    projectsPlanSource.includes(`status: "${status}"`) &&
      (status === "ready" ||
        projectsPlanLoaderSource.includes(`status: "${status}"`)),
    `Projects Hub must preserve the typed ${status} result`,
  );
}
assert.ok(
  projectsRouteSource.includes('plan.status === "unavailable"') &&
    projectsRouteSource.includes('plan.status === "error"') &&
    projectsRouteSource.includes("throw new ProjectsHubPublicReadError(plan.reason)"),
  "Projects route must distinguish unavailable publication from infrastructure errors",
);
assert.ok(
  [
    "parseProjectsHubHeroPublicConfig",
    "parseProjectsHubFeaturedPublicConfig",
    "parseProjectsHubListingPublicConfig",
    "parseProjectsHubMapPublicConfig",
  ].every((token) => projectsPlanSource.includes(token)) &&
    !/\basProjectsHub(?:Hero|Featured|Listing|Map)Config\b/u.test(
      projectsPlanSource,
    ) &&
    projectsConfigSource.includes("function publicConfigRecord(") &&
    projectsConfigSource.includes("function hasRequiredKeys("),
  "Projects public plan must use strict decoders instead of Admin fallback normalizers",
);
for (const parse of [
  parseProjectsHubHeroPublicConfig,
  parseProjectsHubFeaturedPublicConfig,
  parseProjectsHubListingPublicConfig,
  parseProjectsHubMapPublicConfig,
]) {
  assert.equal(parse(null).ok, false, "strict Projects parser must reject null");
  assert.equal(parse({}).ok, false, "strict Projects parser must reject incomplete config");
}
assert.doesNotMatch(
  `${projectsPlanSource}\n${projectsPlanLoaderSource}\n${projectsCompositionSource}`,
  /\bpage_missing\b/u,
  "missing Projects publication must not be classified as an infrastructure error",
);
const projectsLoadErrorReasonsLiteral =
  projectsPlanSource.match(
    /PROJECTS_HUB_LOAD_ERROR_REASONS\s*=\s*\[([\s\S]*?)\]\s*as const/u,
  )?.[1] ?? "";
assert.ok(
  projectsCompositionSource.includes(
    'return { status: "unavailable", ok: false, reason: "page_unavailable" }',
  ) &&
    projectsPlanSource.includes('"page_unavailable"') &&
    !projectsLoadErrorReasonsLiteral.includes("page_unavailable"),
  "missing Projects publication must remain typed unavailable, not error",
);

const publishedPageByPathOwnerSource = read(
  "src/lib/pages/get-published-page-by-path.ts",
);
const dynamicCmsPageSource = read("src/app/(site)/[...slug]/page.tsx");
const dynamicPathErrorCheck = dynamicCmsPageSource.indexOf(
  'result.sourceStatus === "error"',
);
const dynamicPathMissingCheck = dynamicCmsPageSource.indexOf(
  "if (!result.page)",
  dynamicPathErrorCheck,
);
assert.ok(
  publishedPageByPathOwnerSource.includes(
    'sourceStatus: "database" | "missing" | "error"',
  ) &&
    publishedPageByPathOwnerSource.includes('sourceStatus: "missing"') &&
    publishedPageByPathOwnerSource.includes('sourceStatus: "error"') &&
    publishedPageByPathOwnerSource.includes("throw error;") &&
    publishedPageByPathOwnerSource.includes('from "react"') &&
    !publishedPageByPathOwnerSource.includes("unstable_cache") &&
    !publishedPageByPathOwnerSource.includes('"use cache"'),
  "path lookup must distinguish missing from source errors without persisting either in the Data Cache",
);
assert.ok(
  dynamicCmsPageSource.includes("getPublishedPageStateByPath") &&
    dynamicPathErrorCheck >= 0 &&
    dynamicPathMissingCheck > dynamicPathErrorCheck &&
    dynamicCmsPageSource.includes("throw result.sourceError") &&
    dynamicCmsPageSource.includes("notFound();"),
  "dynamic CMS routes must propagate source errors before mapping true missing pages to notFound",
);

const pageBlockStateSource = read("src/lib/page-blocks/load-page-blocks.ts");
const pageBlockCacheStart = pageBlockStateSource.indexOf(
  "export const loadPageBlockStateBySlug",
);
const pageBlockCacheCall = pageBlockStateSource.indexOf(
  "return await unstable_cache(",
  pageBlockCacheStart,
);
const pageBlockCacheCatch = pageBlockStateSource.indexOf(
  "} catch (error)",
  pageBlockCacheCall,
);
assert.ok(
  pageBlockStateSource.includes("class PageBlockStateReadError extends Error") &&
    pageBlockStateSource.includes("readonly partialResult: PageBlockLoadResult") &&
    pageBlockStateSource.includes(
      "async () => queryPageBlockStateBySlug(pageSlug)",
    ) &&
    pageBlockStateSource.includes('["page-block-state-v4", pageSlug]') &&
    pageBlockCacheCall > pageBlockCacheStart &&
    pageBlockCacheCatch > pageBlockCacheCall &&
    pageBlockStateSource.includes("return error.partialResult;") &&
    pageBlockStateSource.includes('pageState.sourceStatus === "error"') &&
    pageBlockStateSource.includes("throw new PageBlockStateReadError(result);") &&
    pageBlockStateSource.includes("const assignmentFailures: PageBlockReadFailure[] = []") &&
    pageBlockStateSource.includes(
      "throw new PageBlockStateReadError(result, assignmentFailures);",
    ) &&
    pageBlockStateSource.includes("hasCompositionError"),
  "Page Block source and assignment failures must reject inside cache v4, then return partial error state only outside the cache",
);

const publishedPageOwnerSource = read(
  "src/lib/pages/get-published-page-by-slug.ts",
);
const publishedPageQueryEnd = publishedPageOwnerSource.indexOf(
  "export function toPublicPageIdentity",
);
const publishedPageQuerySource = publishedPageOwnerSource.slice(
  0,
  publishedPageQueryEnd,
);
const publishedPageCacheStart = publishedPageOwnerSource.indexOf(
  "export const getPublishedPageStateBySlug",
);
const publishedPageCacheCall = publishedPageOwnerSource.indexOf(
  "return await unstable_cache(",
  publishedPageCacheStart,
);
const publishedPageCatch = publishedPageOwnerSource.indexOf(
  "} catch (error)",
  publishedPageCacheCall,
);
assert.ok(
  publishedPageQuerySource.includes("throw new Error(error.message)") &&
    publishedPageOwnerSource.includes(
      "findPublicPageRouteByCmsSlug(page.slug)",
    ) &&
    publishedPageOwnerSource.includes(
      "path: registeredRoute?.href ?? page.path",
    ) &&
    publishedPageCacheCall > publishedPageCacheStart &&
    publishedPageCatch > publishedPageCacheCall &&
    publishedPageOwnerSource.includes("revalidate: 300"),
  "published-page cache owner must throw inside the cached query and shape errors outside its 300-second cache",
);

const projectsCacheCall = projectsCompositionSource.indexOf(
  "return await unstable_cache(queryProjectsHubComposition",
);
const projectsCacheCatch = projectsCompositionSource.indexOf(
  "} catch (error)",
  projectsCacheCall,
);
assert.ok(
  projectsCompositionSource.includes(
    "throw new ProjectsHubCompositionReadError(reason, error)",
  ) &&
    projectsCacheCall >= 0 &&
    projectsCacheCatch > projectsCacheCall &&
    projectsCompositionSource.includes("revalidate: 300"),
  "Projects composition cache must preserve its throw boundary outside the 300-second cached result",
);

console.log(
  `PASS Public route resilience and identity: ${PUBLIC_PAGE_ROUTE_REGISTRY.length} registry routes match ${sitePageFiles.length} site pages plus maintenance; path missing/error identity and non-cached Page Block partial-failure contracts are intact.`,
);
