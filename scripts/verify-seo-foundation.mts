import assert from "node:assert/strict";
import { createElement, Fragment, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types.ts";
import type { EntitySeoData } from "../src/lib/seo/entity-seo-types.ts";
import type { VideoProvider } from "../src/lib/admin/media-topic-payload.ts";
import type { MediaContentItem } from "../src/lib/media-center/types.ts";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");
const mod = require("node:module") as { _load(request: string, parent: NodeModule | null, main: boolean): unknown };
const originalLoad = mod._load;
const originalTs = require.extensions[".ts"];
const originalTsx = require.extensions[".tsx"];
let pageSeo: EntitySeoData | null = null;
let pagesFail = false;
const fixtures: Record<string, Array<Record<string, unknown>>> = {
  pages: [
    { id: 1, path: "/", slug: "home", status: "published", robots_index: null },
    { id: 2, path: "/about", slug: "about", status: "published", robots_index: false },
    { id: 3, path: "/search", slug: "search", status: "published", robots_index: false },
    { id: 4, path: "/draft", slug: "draft", status: "unpublished", robots_index: true },
    { id: 5, path: "/custom", slug: "custom", status: "published", robots_index: true },
    { id: 6, path: "/alias", slug: "alias", status: "published", canonical_url: "https://seo.test/custom" },
  ],
  projects: [
    { id: 1, slug: "live", publication_status: "published", robots_index: true },
    { id: 2, slug: "hidden", publication_status: "unpublished", robots_index: true },
    { id: 3, slug: "noindex", publication_status: "published", robots_index: false },
  ],
  topics: [
    { id: 1, slug: "article", content_type: "article", status: "published", deleted_at: null, robots_index: true },
    { id: 2, slug: "news", content_type: "news", status: "published", deleted_at: null, robots_index: null },
    { id: 3, slug: "deleted", content_type: "article", status: "published", deleted_at: "2026-01-01", robots_index: true },
    { id: 4, slug: "draft", content_type: "article", status: "unpublished", deleted_at: null },
    { id: 5, slug: "copy", content_type: "article", status: "published", deleted_at: null, canonical_url: "https://seo.test/topics/article" },
  ],
};
const client = createClient<Database>("http://127.0.0.1:1", "isolated-fixture", {
  auth: { persistSession: false }, global: { fetch: async input => {
    const url = new URL(String(input)), table = url.pathname.split("/").at(-1)!;
    assert.ok(fixtures[table], `Unexpected DB source ${table}`);
    if (table === "pages" && pagesFail) return new Response(JSON.stringify({ message: "isolated outage" }), { status: 503 });
    let rows = fixtures[table];
    for (const [key, value] of url.searchParams) {
      if (value.startsWith("eq.")) rows = rows.filter(row => String(row[key]) === value.slice(3));
      if (value === "is.null") rows = rows.filter(row => row[key] == null);
      if (value === "not.is.null") rows = rows.filter(row => row[key] != null);
      if (value.startsWith("gt.")) rows = rows.filter(row => Number(row[key]) > Number(value.slice(3)));
    }
    return new Response(JSON.stringify(rows), { headers: { "Content-Type": "application/json" } });
  } },
});
require.extensions[".tsx"] = require.extensions[".ts"] = (module, filename) => {
  const code = ts.transpileModule(readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  (module as NodeModule & { _compile(code: string, filename: string): void })._compile(code, filename);
};
const load = <T,>(file: string): T => require(resolve(root, file)) as T;
const { getGlobalSeoDefaults } = load<typeof import("../src/lib/seo/global-seo-defaults")>("src/lib/seo/global-seo-defaults.ts");
const global = { ...getGlobalSeoDefaults(), canonicalBaseUrl: "https://seo.test", siteUrl: "https://seo.test" };
mod._load = (request, parent, main) => {
  if (request === "server-only") return {};
  if (request === "next/server") return { connection: async () => {} };
  // Render the real shared preview and adapters; only unrelated media/form widgets are ports.
  if (request.endsWith("/AdminFormRuntime")) return {
    useOptionalAdminFormRuntime: () => null,
    AdminFormError: () => null,
    AdminFormGrid: ({ children }: { children: ReactNode }) => createElement(Fragment, null, children),
    AdminFormGridItem: ({ children }: { children: ReactNode }) => createElement(Fragment, null, children),
  };
  if (/\/(AdminTagsField|AdminMediaImageField|AdminFormListboxSelect)$/.test(request)) return { default: () => null, __esModule: true };
  if (request.endsWith("/AdminSingleOpenAccordion")) return { __esModule: true, default: ({ items }: { items: Array<{ content: ReactNode }> }) => createElement(Fragment, null, ...items.map(item => item.content)) };
  if (request.endsWith("/cache/public-cache-generation")) return { cachePublicRead: (fn: unknown) => fn };
  if (request.endsWith("/supabase-admin")) return { getSupabaseAdmin: () => client };
  if (request.endsWith("/load-global-seo-settings")) return { loadGlobalSeoSettings: async () => global };
  if (request.endsWith("/load-page-seo")) return { loadPageSeoByPath: async () => pageSeo };
  return originalLoad(request, parent, main);
};
const { resolveSeoMetadata } = load<typeof import("../src/lib/seo/resolve-seo-metadata")>("src/lib/seo/resolve-seo-metadata.ts");
const { generatePublicMetadata } = load<typeof import("../src/lib/seo/generate-public-metadata")>("src/lib/seo/generate-public-metadata.ts");
const { buildMetadataFromResolved } = load<typeof import("../src/lib/seo/build-metadata-from-resolved")>("src/lib/seo/build-metadata-from-resolved.ts");
const { buildPageJsonLd } = load<typeof import("../src/lib/seo/build-jsonld")>("src/lib/seo/build-jsonld.ts");
const { MediaVideoPlayback } = load<typeof import("../src/components/media-center/MediaDetailArticle")>("src/components/media-center/MediaDetailArticle.tsx");
const { presentSeoText } = load<typeof import("../src/lib/seo/seo-utils")>("src/lib/seo/seo-utils.ts");
const { NO_INDEX_ROBOTS } = load<typeof import("../src/config/seo/seo-rules")>("src/config/seo/seo-rules.ts");
const { generateSitemapEntries, resolveSitemapCandidate } = load<typeof import("../src/lib/seo/generate-sitemap-entries")>("src/lib/seo/generate-sitemap-entries.ts");
const { resolveRobots } = require("next/dist/lib/metadata/resolvers/resolve-basics") as typeof import("next/dist/lib/metadata/resolvers/resolve-basics");
const { default: SeoPanel } = load<typeof import("../src/components/admin/SeoPanel")>("src/components/admin/SeoPanel.tsx");
const { default: AdminEntitySeoPanel } = load<typeof import("../src/components/admin/seo/AdminEntitySeoPanel")>("src/components/admin/seo/AdminEntitySeoPanel.tsx");
const { default: manifest } = load<typeof import("../src/app/manifest")>("src/app/manifest.ts");
const isolatedTypeScriptLoader = require.extensions[".tsx"]!;
mod._load = originalLoad;
if (originalTs) require.extensions[".ts"] = originalTs; else delete require.extensions[".ts"];
if (originalTsx) require.extensions[".tsx"] = originalTsx; else delete require.extensions[".tsx"];

const manifestOutput = await manifest();
assert.equal(manifestOutput.name, global.organizationName || global.siteName);
assert.equal(manifestOutput.description, global.organizationTagline);
assert.equal(manifestOutput.start_url, "/");
assert.equal(manifestOutput.icons?.[0]?.src, "/icons/icon-192.png");

for (const entitySeo of [undefined, null, {}]) {
  const resolved = resolveSeoMetadata({ path: "/track-your-project/test", title: "Project specific", description: "Local description", entitySeo, robots: NO_INDEX_ROBOTS }, global);
  assert.ok(resolved.title.startsWith("Project specific |"));
  assert.equal(resolved.description, "Local description");
  assert.equal(resolved.robots.index, false);
  assert.equal(resolved.robots.follow, false);
}
for (pageSeo of [null, {}]) {
  const result = await generatePublicMetadata({ path: "/track-your-project/test", title: "Project specific", description: "Local description", robots: NO_INDEX_ROBOTS });
  assert.ok(String(result.title).startsWith("Project specific |"));
  assert.equal(result.description, "Local description");
}
const canonical = "https://seo.test/topics/original";
const input = { path: "/topics/copy", title: "Authored title ".repeat(10), description: "Authored description ".repeat(20), entitySeo: { canonical, robotsIndex: true, robotsFollow: false } };
const resolved = resolveSeoMetadata(input, global);
const metadata = buildMetadataFromResolved(resolved);
assert.equal(metadata.alternates?.canonical, canonical);
assert.equal(metadata.openGraph?.url, canonical);
assert.equal(metadata.title, presentSeoText(resolved).title);
assert.equal(metadata.description, presentSeoText(resolved).description);
assert.equal(metadata.twitter?.title, metadata.title);
assert.equal(metadata.twitter?.description, metadata.description);
const schemas = buildPageJsonLd({ path: input.path, canonical, title: "Title", description: "Description", type: "article", project: { name: "Project", description: "Description", locationLabel: "Cairo" }, breadcrumbs: [{ name: "Home", path: "/" }, { name: "Copy", path: input.path }] }, global);
const json = JSON.stringify(schemas);
assert.ok(json.includes(canonical));
const listing = schemas.find(schema => typeof schema === "object" && schema !== null && !Array.isArray(schema) && schema["@type"] === "RealEstateListing") as Record<string, unknown>;
assert.equal(listing.address, undefined);
assert.deepEqual(listing.contentLocation, { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: "Cairo" } });
assert.ok(!json.includes(input.path));
assert.ok(json.includes("https://seo.test#organization"));

const videoSchemaInput = {
  path: "/media-center/videos/verified-video", title: "فيديو منشور", description: "وصف الفيديو المنشور",
  publishedAt: "2026-10-23T12:00:00Z",
};
for (const [provider, url, expectedMode, startSeconds] of [
  ["youtube", "https://youtu.be/dQw4w9WgXcQ", "embed", 75],
  ["vimeo", "https://vimeo.com/123456789", "embed", 75],
  ["facebook", "https://www.facebook.com/watch/?v=123456789", "external", 0],
  ["tiktok", "https://www.tiktok.com/@venesia/video/1234567890123456789", "embed", 0],
  ["instagram", "https://www.instagram.com/reel/ABCdef123_-", "external", 0],
  ["direct", "https://cdn.example.com/movie.mp4", "direct", 75],
] as const) {
  const schemas = buildPageJsonLd({ ...videoSchemaInput, type: "article", image: "/video-poster.jpg" }, global);
  const serializedSchemas = JSON.stringify(schemas);
  assert.ok(serializedSchemas.includes('"image":"https://seo.test/video-poster.jpg"'));
  assert.ok(!serializedSchemas.includes("VideoObject") && !serializedSchemas.includes("uploadDate") && !serializedSchemas.includes('"duration"'), `${provider}: CMS publication dates and legacy duration must not become invented provider metadata`);
  const playbackHtml = renderToStaticMarkup(createElement(MediaVideoPlayback, {
    item: { title: videoSchemaInput.title, videoProvider: provider, videoUrl: url, videoStartSeconds: startSeconds, image: "/video-poster.jpg" },
  }));
  assert.ok(playbackHtml.includes(`data-public-media-video-mode="${expectedMode}"`), `${provider}: the shared playback owner renders its canonical mode`);
  assert.ok(playbackHtml.includes('target="_blank"') && playbackHtml.includes('rel="noopener noreferrer"'), `${provider}: restricted or unavailable content retains its verified source action`);
  assert.ok(!/(?:[?&]|&amp;)autoplay=1|\sautoplay(?:=|;|\s|>)/i.test(playbackHtml), `${provider}: preview and public playback never autoplay`);
  if (expectedMode === "embed") {
    assert.ok(playbackHtml.includes("<iframe") && !playbackHtml.includes("<video"));
    assert.ok(playbackHtml.includes('loading="lazy"') && playbackHtml.includes('referrerPolicy="strict-origin-when-cross-origin"'));
  } else if (expectedMode === "direct") {
    assert.ok(playbackHtml.includes("<video") && !playbackHtml.includes("<iframe"));
    assert.ok(playbackHtml.includes('poster="/video-poster.jpg"') && playbackHtml.includes('preload="none"') && playbackHtml.includes("object-contain"));
  } else {
    assert.ok(!playbackHtml.includes("<video") && !playbackHtml.includes("<iframe"));
  }
}
for (const videoUrl of ["", "https://notyoutube.com/watch?v=dQw4w9WgXcQ"]) {
  const invalidHtml = renderToStaticMarkup(createElement(MediaVideoPlayback, { item: { title: "Unavailable", videoUrl } }));
  assert.ok(invalidHtml.includes("data-public-media-video-unavailable") && !invalidHtml.includes("<iframe") && !invalidHtml.includes("<video") && !invalidHtml.includes('target="_blank"'));
}
console.log("PASS Video public playback and SEO: six providers use the shared resolver, source-only limits are honest, embeds/native video do not autoplay, and page metadata invents no provider upload date or duration.");

// Exercise the real rendering entry points; only their existing data/service ports
// are isolated. Meta reads must never leak into unrelated providers or SEO reads.
const originalRenderLoad = mod._load;
const { default: MediaDetailArticle } = load<typeof import("../src/components/media-center/MediaDetailArticle")>("src/components/media-center/MediaDetailArticle.tsx");
let renderItem: MediaContentItem;
let previewTopic: Record<string, unknown>;
let embedReads = 0;
let previewAuthReads = 0;
let deniedEmbed = false;
const renderPort = ({ children }: { children?: ReactNode }) => createElement(Fragment, null, children);
function findRenderedComponent(node: ReactNode, component: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findRenderedComponent(child, component);
      if (found) return found;
    }
  } else if (isValidElement<{ children?: ReactNode }>(node)) {
    if (node.type === component) return node.props;
    return findRenderedComponent(node.props.children, component);
  }
}
try {
  require.extensions[".tsx"] = require.extensions[".ts"] = isolatedTypeScriptLoader;
  mod._load = (request, parent, main) => {
    if (request === "server-only") return {};
    if (request.endsWith("/media-center")) return {
      getMediaItemBySlug: async () => renderItem,
      getRelatedMediaItems: async () => [],
    };
    if (request.endsWith("/content/public-content-read/owner")) return {
      readMetaVideoEmbed: async (payload: { provider: VideoProvider; video_url: string }) => {
        embedReads++;
        assert.ok(payload.provider === "facebook" || payload.provider === "instagram", "Only Meta reaches the oEmbed read port");
        if (deniedEmbed) return { status: "unavailable", reason: "denied" };
        return { status: "ready", provider: payload.provider, sourceUrl: payload.video_url };
      },
    };
    if (request.endsWith("/pages/get-published-page-by-slug")) return { getPublishedPageStateBySlug: async () => ({ page: null }) };
    if (request.endsWith("/require-admin-session")) return { requireAdminSession: async () => { previewAuthReads++; } };
    if (request.endsWith("/media-catalog/deleted-reference-state")) return {
      readDeletedManagedValues: async () => [], readMissingManagedValues: async () => [],
    };
    if (request.endsWith("/AdminDeletedMediaNotice")) return { AdminMediaPreview: renderPort };
    if (request.endsWith("/components/admin/ui")) return { AdminPageHeader: renderPort, AdminStatusPill: renderPort };
    if (/\/(InternalPageLayout|MediaPageShell|JsonLd|TopicViewTracker)$/.test(request)) return { __esModule: true, default: renderPort };
    if (request.endsWith("/supabase-admin")) return { getSupabaseAdmin: () => ({ from: (table: string) => {
      assert.equal(table, "admin_content_topics");
      const query = { select: () => query, eq: () => query, is: () => query, maybeSingle: async () => ({ data: previewTopic, error: null }) };
      return query;
    } }) };
    return originalRenderLoad(request, parent, main);
  };
  const { default: MediaDetailPage } = load<typeof import("../src/components/media-center/MediaDetailPage")>("src/components/media-center/MediaDetailPage.tsx");
  const { default: ContentPreviewPage } = load<typeof import("../src/app/admin/content/topics/[id]/preview/page")>("src/app/admin/content/topics/[id]/preview/page.tsx");
  const { generateMediaDetailMetadata } = load<typeof import("../src/lib/media-center/generate-media-detail-metadata")>("src/lib/media-center/generate-media-detail-metadata.ts");
  for (const [provider, videoUrl, eligible] of [
    ["facebook", "https://www.facebook.com/watch?v=123456789", true],
    ["instagram", "https://www.instagram.com/reel/ABCdef123_-/", true],
    ["facebook", "https://www.facebook.com/share/v/123456789", false],
    ["facebook", "https://www.facebook.com.evil.test/watch?v=123456789", false],
    ["instagram", "https://www.instagram.com/p/ABCdef123_-/", false],
    ["youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", false],
    ["vimeo", "https://vimeo.com/123456789", false],
    ["tiktok", "https://www.tiktok.com/@venesia/video/1234567890123456789", false],
    ["direct", "https://cdn.example.com/movie.mp4", false],
  ] as const) {
    renderItem = {
      id: "42", slug: "isolated-render", title: "Isolated Video", excerpt: "", category: "", date: "", publishedAt: "2026-10-23T12:00:00Z", image: "", type: "video",
      videoProvider: provider, videoUrl, showTitleOnPage: true, showImageOnPage: true, showExcerptOnPage: true,
      showDateOnPage: true, showCategoryOnPage: true, showSeriesOnPage: true, showIntroCardOnPage: true,
    };
    const before = embedReads;
    const page = await MediaDetailPage({ configKey: "videos", slug: renderItem.slug });
    const articleProps = findRenderedComponent(page, MediaDetailArticle);
    assert.ok(articleProps, `${provider}: public detail retains its existing Article owner`);
    assert.equal(embedReads - before, Number(eligible), `${provider}: only an eligible Meta detail reads oEmbed`);
    assert.equal((articleProps.metaEmbed as { status?: string } | undefined)?.status, eligible ? "ready" : undefined);

    previewTopic = { id: 42, title: "Isolated Video", content_type: "video", status: "unpublished", media_payload: { kind: "video", provider, video_url: videoUrl } };
    const beforePreview = embedReads;
    const beforeAuth = previewAuthReads;
    const preview = await ContentPreviewPage({ params: Promise.resolve({ id: "42" }) });
    const playerProps = findRenderedComponent(preview, MediaVideoPlayback);
    assert.ok(playerProps, `${provider}: saved preview retains the same single playback owner`);
    assert.equal(previewAuthReads - beforeAuth, 1, "Saved preview keeps its authenticated read boundary");
    assert.equal(embedReads - beforePreview, Number(eligible), `${provider}: an invalid draft URL or unrelated provider makes no oEmbed request`);
    assert.equal((playerProps.metaEmbed as { status?: string } | undefined)?.status, eligible ? "ready" : undefined);
  }
  renderItem = { ...renderItem!, videoProvider: "facebook", videoUrl: "https://www.facebook.com/watch?v=123456789" };
  previewTopic = { ...previewTopic!, media_payload: { kind: "video", provider: "facebook", video_url: renderItem.videoUrl } };
  deniedEmbed = true;
  const deniedPublic = await MediaDetailPage({ configKey: "videos", slug: renderItem.slug });
  const deniedPreview = await ContentPreviewPage({ params: Promise.resolve({ id: "42" }) });
  assert.deepEqual(findRenderedComponent(deniedPublic, MediaDetailArticle)?.metaEmbed, { status: "unavailable", reason: "denied" }, "Public detail passes provider denial to the existing fallback renderer without failing the content page");
  assert.deepEqual(findRenderedComponent(deniedPreview, MediaVideoPlayback)?.metaEmbed, { status: "unavailable", reason: "denied" }, "Saved preview preserves provider failure as a fallback result");
  const beforeMetadata = embedReads;
  const deniedMetadata = await generateMediaDetailMetadata("videos", { params: Promise.resolve({ slug: renderItem.slug }) });
  deniedEmbed = false;
  const readyMetadata = await generateMediaDetailMetadata("videos", { params: Promise.resolve({ slug: renderItem.slug }) });
  assert.deepEqual(readyMetadata, deniedMetadata, "oEmbed availability never changes public metadata");
  assert.equal(embedReads, beforeMetadata, "The existing Media metadata generator makes no oEmbed request");
  const beforeNews = embedReads;
  renderItem = { ...renderItem!, type: "news", videoProvider: "facebook", videoUrl: "https://www.facebook.com/watch?v=123456789" };
  await MediaDetailPage({ configKey: "news", slug: renderItem.slug });
  previewTopic = { ...previewTopic!, content_type: "article" };
  await ContentPreviewPage({ params: Promise.resolve({ id: "42" }) });
  assert.equal(embedReads, beforeNews, "Non-video public and saved-preview consumers never activate Meta even when payload contains a Meta URL");
} finally {
  mod._load = originalRenderLoad;
  if (originalTs) require.extensions[".ts"] = originalTs; else delete require.extensions[".ts"];
  if (originalTsx) require.extensions[".tsx"] = originalTsx; else delete require.extensions[".tsx"];
}
console.log("PASS Meta render bindings: public detail and authenticated saved preview opt in only after canonical eligibility; other providers, invalid drafts and non-video consumers make no oEmbed request.");

for (const [robots, expected] of [[resolved.robots, "index, nofollow"], [NO_INDEX_ROBOTS, "noindex, nofollow"]] as const) {
  const serialized = resolveRobots(robots);
  assert.equal(serialized?.basic, expected);
  assert.ok(serialized?.googleBot?.includes("max-image-preview:"));
  assert.ok(serialized?.googleBot?.includes("max-snippet:"));
  assert.ok(serialized?.googleBot?.includes("max-video-preview:"));
}

const previewSettings = { ...global, siteName: "Custom Brand", organizationAlternateName: "Custom Arabic Brand", defaultTitle: "Global title", defaultDescription: "Global description" };
const previewCases = [
  { path: "/topics/copy", seoTitle: "Authored title ".repeat(10), seoDescription: "Authored description ".repeat(20), canonicalUrl: canonical },
  { path: "/topics/copy", seoTitle: "", seoDescription: "", canonicalUrl: "" },
  { path: "/topics/copy", seoTitle: "Global title", seoDescription: "", canonicalUrl: "" },
  { path: "/media-center/videos/copy", seoTitle: "Video title", seoDescription: "", canonicalUrl: canonical },
  { path: "/projects/copy", seoTitle: "", seoDescription: "", canonicalUrl: "", shortDescription: "<p>Project short description</p>" },
  { path: "/about", seoTitle: "", seoDescription: "", canonicalUrl: "" },
  { path: "/", seoTitle: "", seoDescription: "", canonicalUrl: "" },
  { path: "/custom", seoTitle: "", seoDescription: "", canonicalUrl: "" },
];
for (const row of previewCases) {
  const adapter = SeoPanel({ title: "Entity source title", excerpt: "Entity source description", slug: "copy", content: "", image: "", imageAlt: "", seoTitle: row.seoTitle, seoDescription: row.seoDescription, seoKeywords: [], focusKeyword: "", canonicalUrl: row.canonicalUrl, robotsIndex: null, robotsFollow: null, ogImage: "", ogImageAlt: "", seoSettings: previewSettings });
  const entityRoute = row.path.split("/").length > 2;
  const props = { ...adapter.props, publicPathPrefix: entityRoute ? row.path.slice(0, row.path.lastIndexOf("/")) : "", slugPlaceholder: "", initial: { ...adapter.props.initial, slug: entityRoute ? "copy" : row.path.slice(1) }, ...(row.shortDescription ? { previewDescription: { fieldName: "short_description", value: row.shortDescription } } : {}) };
  const html = renderToStaticMarkup(createElement(AdminEntitySeoPanel, props));
  const preview = html.split("data-admin-entity-seo-search-preview")[1]?.split("data-admin-entity-seo-social-preview")[0];
  assert.ok(preview, row.path + " renders real shared preview");
  const expected = buildMetadataFromResolved(resolveSeoMetadata({ path: row.path, entitySeo: { title: row.seoTitle, description: row.seoDescription, canonical: row.canonicalUrl }, ...(entityRoute ? { title: row.seoTitle || "Entity source title", description: row.seoDescription || (row.shortDescription ? "Project short description" : "Entity source description") } : row.path === "/custom" ? { title: "Entity source title" } : {}) }, previewSettings));
  for (const value of [expected.title, expected.description, expected.alternates?.canonical]) {
    const escaped = renderToStaticMarkup(createElement("p", null, String(value))).slice(3, -4);
    assert.ok(preview.includes(">" + escaped + "</p>"), row.path + " renders exact Public value: " + value);
  }
}

const candidate = { path: "/topics/copy", url: "", source: "articles" as const };
assert.equal(resolveSitemapCandidate(candidate, { canonical }, global), null);
assert.equal(resolveSitemapCandidate(candidate, { canonical: "https://external.test/page" }, global), null);
assert.equal(resolveSitemapCandidate({ ...candidate, path: "/topics?page=2" }, null, global), null);
assert.equal(resolveSitemapCandidate(candidate, null, { ...global, defaultRobotsIndex: false }), null);
assert.ok(resolveSitemapCandidate(candidate, { robotsIndex: true }, { ...global, defaultRobotsIndex: false }));
const generated = await generateSitemapEntries();
assert.deepEqual(generated.entries.map(row => row.path).sort(), ["/", "/custom", "/projects/live", "/topics/article", "/media-center/news/news"].sort());
assert.deepEqual(generated.duplicateUrls, []);
assert.ok(!generated.entries.some(row => row.path === "/ahmed" || row.path === "/contact"), "deleted/unregistered CMS identities cannot be resurrected by route defaults");
global.defaultRobotsIndex = false;
const globallyHidden = await generateSitemapEntries();
assert.deepEqual(globallyHidden.entries.map(row => row.path).sort(), ["/custom", "/projects/live", "/topics/article"].sort());
pagesFail = true;
const failed = await generateSitemapEntries();
assert.ok(failed.sourceErrors.some(error => error.source === "cms_pages"));
assert.ok(!failed.entries.some(row => row.source === "static_pages"), "outages cannot fabricate core-page indexability");
console.log("PASS SEO foundation: real generator/resolver adoption, canonical OG/schema/sitemap, Next Googlebot serialization, preview text policy, tracking fallback, and published/deleted/noindex/query exclusions; no live writes.");
