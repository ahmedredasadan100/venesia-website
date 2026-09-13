import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Executes the actual CMS route, site layout, composition and module renderers.
// Named read ports supply resolved fixtures; this is neither DB nor hydration proof.
const root = process.cwd();
const out = path.join(root, ".tmp-qa/evidence-adoption-gaps/composition");
mkdirSync(out, { recursive: true });
const require = createRequire(import.meta.url);
const modules = new Map();
const fingerprints = {};
const calls = [];
const results = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("Composition fixture forbids all network"); };
const page = { id: 901, title: "Composite identity", slug: "proof-page", path: "/proof-page", status: "published", page_type: "custom" };
let lookup = { page, sourceStatus: "database" };
let composition;
let footerFailure = false;
let navigationFailure = false;
let footerSettings;
const nav = [{ id: 1, label: "Fixture navigation", href: "/proof-page", target: "_self", children: [] }];
const ports = {
  "server-only": {},
  "next/cache": { unstable_cache: (fn) => fn },
  "next/navigation": {
    notFound() { throw new Error("NEXT_NOT_FOUND"); },
    usePathname: () => page.path,
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push() { throw new Error("SSR fixture cannot navigate"); } }),
  },
  "src/lib/pages/get-published-page-by-path": { getPublishedPageStateByPath: async (value) => { calls.push(["page", value]); return lookup; } },
  "src/lib/page-blocks/load-page-composition": { loadPageCompositionBySlug: async (value) => { calls.push(["composition", value]); return composition; } },
  "src/lib/navigation/get-public-navigation": {
    getPublicNavigationItems: async (location) => { calls.push(["navigation", location]); if (navigationFailure) throw new Error("fixture navigation outage"); return nav; },
    getPublicNavigationItemsByMenuId: async () => { throw new Error("Unexpected menu-id fixture read"); },
  },
  "src/lib/footer/load-footer-settings": { loadFooterSettings: async () => { if (footerFailure) throw new Error("fixture footer outage"); return footerSettings; } },
  "src/lib/seo/generate-public-metadata": {
    loadResolvedGlobalSeo: async () => load("src/lib/seo/global-seo-defaults.ts").getGlobalSeoDefaults(),
    generatePublicMetadata: async (value) => value,
  },
  "src/lib/supabase-admin": { getSupabaseAdmin() { throw new Error("Unexpected database access in resolved-render fixture"); } },
  "src/lib/logging": { logError: (...args) => calls.push(["logged-read-failure", String(args[0])]) },
};
function load(relative) {
  const filename = path.isAbsolute(relative) ? relative : path.resolve(root, relative);
  const key = path.relative(root, filename).replaceAll("\\", "/").replace(/\.(tsx?|jsx?)$/, "");
  if (ports[key]) return ports[key];
  if (modules.has(filename)) return modules.get(filename).exports;
  if (filename.endsWith(".json")) return JSON.parse(readFileSync(filename, "utf8"));
  const source = readFileSync(filename, "utf8");
  fingerprints[path.relative(root, filename).replaceAll("\\", "/")] = createHash("sha256").update(source).digest("hex");
  const loadedModule = { exports: {} };
  modules.set(filename, loadedModule);
  const code = ts.transpileModule(source, { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  function resolve(specifier) {
    if (Object.hasOwn(ports, specifier)) return ports[specifier];
    if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return require(specifier);
    const base = specifier.startsWith("@/") ? path.resolve(root, "src", specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
    const target = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, path.join(base, "index.ts"), path.join(base, "index.tsx")].find((item) => existsSync(item) && statSync(item).isFile());
    assert.ok(target, `Unresolved fixture module ${base}`);
    return load(target);
  }
  new Function("require", "module", "exports", code)(resolve, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
function block(id, slot, type, config, sortOrder = id) {
  const resolved = { assignmentId: id, blockType: type, templateId: id, slot, sortOrder, isVisible: true, template: { id, name: `Fixture ${id}`, slug: `proof-${id}`, description: null, variant: "default", style_preset: "premium-dark", status: "published", sort_order: 0, config } };
  return { kind: "block", assignmentId: id, sortOrder, block: resolved };
}
function reset() {
  lookup = { page, sourceStatus: "database" };
  footerFailure = false;
  navigationFailure = false;
  const hero = { id: 1, page_id: page.id, section_key: "hero", section_type: "hero", slot: "hero", variant: "internal-page", style_preset: "premium-dark", source_type: "manual", source_id: null, source_slug: null, limit_count: 1, is_visible: true, sort_order: 0, config: { title: "Composite hero", subtitle: "Fixture subtitle", showTitle: true, showSubtitle: true, showImage: false, showCta: false }, page };
  composition = { pageIdentity: page, slots: {
    hero: [{ kind: "hero", assignmentId: 1, sortOrder: 0, hero }, block(2, "hero", "breadcrumb", { showHome: true, homeLabel: "Fixture home", currentLabel: "Ignored configured label" })],
    main: [block(4, "main", "content", { title: "Main second", body: "Second content" }, 20), block(3, "main", "content", { title: "Main first", body: "First content" }, 10)],
    sidebar: [block(5, "sidebar", "content", { title: "Sidebar content", body: "Sidebar body" })],
    bottom: [block(6, "bottom", "cta", { title: "Bottom action", buttonLabel: "Fixture destination", buttonHref: "/proof-next" })],
    footer: [block(7, "footer", "content", { title: "Before footer", body: "Composition footer region" })],
  }, blockStates: [], heroVisibility: "visible", mediaHubModules: null, mediaSidebarModules: null, featuredModules: [], homepageProjects: null, hasAnyAssignmentRows: true, hasRenderableModules: true, hasCompositionError: false, hasAssignments: true };
  footerSettings = { contactItems: [], socialLinks: [], legal: { copyright: "Fixture legal", tagline: "Fixture tagline" }, sourceStatus: "database", sourceIssues: [], slots: { version: 1, slots: [
    { index: 1, enabled: true, type: "text", heading: "Saved footer heading", config: { title: "", body: "Saved footer text", showBrandIcon: false, cta: { enabled: false, label: "", href: "", target: "_self" } } },
    { index: 2, enabled: true, type: "menu", heading: "Footer navigation", config: { source: "location", menuId: null, location: "footer", fallbackLocation: "footer", maxItems: null, showOnlyTopLevel: true } },
  ] } };
}
async function check(name, run) {
  reset();
  try { await run(); results.push({ name, ok: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, ok: false, error: String(error) }); throw error; }
}
try {
  const route = load("src/app/(site)/[...slug]/page.tsx");
  const layout = load("src/app/(site)/layout.tsx").default;
  async function render() {
    const child = await route.default({ params: Promise.resolve({ slug: [page.slug] }), searchParams: Promise.resolve({}) });
    return renderToStaticMarkup(React.createElement("html", { lang: "ar", dir: "rtl" }, React.createElement("body", null, await layout({ children: child }))));
  }
  await check("actual-route-layout-composes-navigation-hero-breadcrumb-all-regions-and-footer", async () => {
    const html = await render();
    for (const text of ["Fixture navigation", "Composite hero", "Composite identity", "Main first", "Main second", "Sidebar content", "Bottom action", "Before footer", "Saved footer heading", "Saved footer text", "Fixture legal"]) assert.ok(html.includes(text), `Missing actual rendered content: ${text}`);
    assert.equal((html.match(/<main\b/g) ?? []).length, 1);
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
    assert.equal((html.match(/<footer\b/g) ?? []).length, 1);
    for (const slot of ["hero", "main", "sidebar", "bottom", "footer"]) assert.ok(html.includes(`data-layout-slot="${slot}"`), `Missing ${slot} region`);
    const ordered = ["Composite hero", "Main first", "Main second", "Bottom action", "Before footer", "Saved footer heading"].map((text) => html.indexOf(text));
    assert.deepEqual(ordered, [...ordered].sort((a, b) => a - b));
    assert.ok(!html.includes("Ignored configured label"), "Page identity owns current breadcrumb label");
    assert.ok(calls.some(([kind, value]) => kind === "composition" && value === page.slug));
    writeFileSync(path.join(out, "composed-page.html"), html);
  });
  await check("empty-resolved-composition-does-not-invent-content", async () => {
    for (const slot of Object.keys(composition.slots)) composition.slots[slot] = [];
    composition.heroVisibility = "none";
    composition.hasRenderableModules = false;
    composition.hasAssignments = false;
    const html = await render();
    assert.ok(!html.includes("Composite hero") && !html.includes("Main first"));
    assert.ok(html.includes("Saved footer heading"));
  });
  await check("footer-and-navigation-outages-preserve-page-without-default-footer-content", async () => {
    footerFailure = navigationFailure = true;
    const html = await render();
    assert.ok(html.includes("Composite hero") && html.includes("Main first"));
    assert.ok(!html.includes("Saved footer heading") && !html.includes("Saved footer text") && !html.includes("Fixture navigation"));
    assert.ok(!html.includes("Building trust before concrete."));
  });
  await check("page-read-error-is-not-missing-page-and-never-loads-composition", async () => {
    const error = new Error("fixture page read outage");
    lookup = { page: null, sourceStatus: "error", sourceError: error };
    const before = calls.filter(([kind]) => kind === "composition").length;
    await assert.rejects(render, (caught) => caught === error);
    assert.equal(calls.filter(([kind]) => kind === "composition").length, before);
  });
  await check("missing-and-reserved-pages-fail-before-composition", async () => {
    lookup = { page: null, sourceStatus: "missing" };
    await assert.rejects(render, /NEXT_NOT_FOUND/);
    const before = calls.length;
    await assert.rejects(() => route.default({ params: Promise.resolve({ slug: ["admin"] }) }), /NEXT_NOT_FOUND/);
    assert.equal(calls.length, before);
  });
} finally {
  globalThis.fetch = originalFetch;
  writeFileSync(path.join(out, "results.json"), JSON.stringify({ scope: "Actual route + site layout + composition + module renderers with resolved read fixtures; no database, authenticated save, hydration, responsive or Production claim", ports: Object.keys(ports), results, fingerprints, globalClosed: false }, null, 2));
}
