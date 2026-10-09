import assert from "node:assert/strict";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types.ts";
import type { EntitySeoData } from "../src/lib/seo/entity-seo-types.ts";

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
  if (request.endsWith("/AdminFormRuntime")) return { useOptionalAdminFormRuntime: () => null, AdminFormError: () => null };
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
const { presentSeoText } = load<typeof import("../src/lib/seo/seo-utils")>("src/lib/seo/seo-utils.ts");
const { NO_INDEX_ROBOTS } = load<typeof import("../src/config/seo/seo-rules")>("src/config/seo/seo-rules.ts");
const { generateSitemapEntries, resolveSitemapCandidate } = load<typeof import("../src/lib/seo/generate-sitemap-entries")>("src/lib/seo/generate-sitemap-entries.ts");
const { resolveRobots } = require("next/dist/lib/metadata/resolvers/resolve-basics") as typeof import("next/dist/lib/metadata/resolvers/resolve-basics");
const { default: SeoPanel } = load<typeof import("../src/components/admin/SeoPanel")>("src/components/admin/SeoPanel.tsx");
const { default: AdminEntitySeoPanel } = load<typeof import("../src/components/admin/seo/AdminEntitySeoPanel")>("src/components/admin/seo/AdminEntitySeoPanel.tsx");
const { default: manifest } = load<typeof import("../src/app/manifest")>("src/app/manifest.ts");
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
