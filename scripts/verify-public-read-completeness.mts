import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types.ts";
import type { PublicProjectRootRow, PublicProjectLocationRow } from "../src/lib/projects/map-public-project.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
const modules = nativeRequire("node:module") as { _load(request: string, parent: NodeModule | null, main: boolean): unknown };
const originalLoad = modules._load;
const originalExtensions = new Map([".ts", ".tsx"].map(extension => [extension, nativeRequire.extensions[extension]]));
let currentClient: SupabaseClient<Database>;
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

// Execute complete application modules. Only shared cache and environment providers are
// replaced: this test proves reads/mapping/SSR, not the persistent cache adapter.
modules._load = (request, parent, main) => {
  if (request === "server-only") return {};
  if (request === "next/cache") return { unstable_cache: (callback: unknown) => callback };
  if (request.endsWith("/cache/public-cache-generation")) return { cachePublicRead: (callback: unknown) => callback };
  if (request.endsWith("/supabase-admin")) return { getSupabaseAdmin: () => currentClient };
  if (request.endsWith("/load-global-seo-settings")) return { loadGlobalSeoSettings: async () => ({ canonicalBaseUrl: "https://verification.invalid" }) };
  if (request.endsWith("/PublicMediaImage")) return { __esModule: true, default: () => null };
  if (request === "next/link") return { __esModule: true, default: "a" };
  return originalLoad(request, parent, main);
};
for (const extension of [".ts", ".tsx"]) {
  nativeRequire.extensions[extension] = (module, filename) => {
    const output = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      fileName: filename,
    }).outputText;
    (module as NodeModule & { _compile(source: string, filename: string): void })._compile(output, filename);
  };
}
const content = nativeRequire(resolve(ROOT, "src/lib/content/public-content-read/owner.ts")) as typeof import("../src/lib/content/public-content-read/owner.ts");
const projects = nativeRequire(resolve(ROOT, "src/lib/projects/load-published-projects.ts")) as typeof import("../src/lib/projects/load-published-projects.ts");
const sitemap = nativeRequire(resolve(ROOT, "src/lib/seo/generate-sitemap-entries.ts")) as typeof import("../src/lib/seo/generate-sitemap-entries.ts");
const mapper = nativeRequire(resolve(ROOT, "src/lib/projects/map-public-project.ts")) as typeof import("../src/lib/projects/map-public-project.ts");
const { createElement } = nativeRequire("react") as typeof import("react");
const { renderToStaticMarkup } = nativeRequire("react-dom/server") as typeof import("react-dom/server");
const ProjectsMapSection = (nativeRequire(resolve(ROOT, "src/components/projects/ProjectsMapSection.tsx")) as typeof import("../src/components/projects/ProjectsMapSection.tsx")).default;
modules._load = originalLoad;
for (const [extension, original] of originalExtensions) {
  if (original) nativeRequire.extensions[extension] = original;
  else delete nativeRequire.extensions[extension];
}

export async function verifyPublicReadCompleteness(client: SupabaseClient<Database>, expected: { topicIds: number[]; projectSlugs: string[]; pageIds: number[]; sitemapTopicIds?: number[]; sitemapProjectSlugs?: string[] }) {
  currentClient = client;
  const topicRows = await content.loadPublicContentSitemapRows();
  const projectRows = await projects.loadPublishedProjectSitemapRows();
  assert.deepEqual(topicRows.map(row => row.id), expected.topicIds);
  assert.equal(new Set(topicRows.map(row => row.id)).size, topicRows.length);
  assert.deepEqual(projectRows.map(row => row.slug), expected.projectSlugs);
  assert.equal(new Set(projectRows.map(row => row.slug)).size, projectRows.length);
  assert.deepEqual(await content.loadPublicContentSitemapRows(), topicRows, "content ordering must be repeatable");
  assert.deepEqual(await projects.loadPublishedProjectSitemapRows(), projectRows, "project ordering must be repeatable");
  const generated = await sitemap.generateSitemapEntries();
  assert.deepEqual(generated.sourceErrors, []);
  assert.deepEqual(generated.duplicateUrls, []);
  assert.equal(new Set(generated.entries.map(row => row.url)).size, generated.entries.length);
  assert.deepEqual(generated.entries.filter(row => row.source === "cms_pages").map(row => row.entityId), expected.pageIds);
  assert.deepEqual(generated.entries.filter(row => row.source === "projects").map(row => row.slug), expected.sitemapProjectSlugs ?? expected.projectSlugs);
  assert.deepEqual(generated.entries.filter(row => row.source === "articles" || row.source === "media").map(row => row.entityId).sort((a, b) => Number(a) - Number(b)), expected.sitemapTopicIds ?? expected.topicIds);
  assert.deepEqual((await sitemap.generateSitemapEntries()).entries, generated.entries, "full sitemap ordering must be repeatable");
  return { topics: topicRows.length, projects: projectRows.length, cmsPages: expected.pageIds.length, sitemapEntries: generated.entries.length };
}

function publicProjectFixture() {
  return {
    id: 1, type: "residential", slug: "fixture", arabic_name: "مشروع", english_name: "Project", code: "fixture",
    homepage_order: 0, general_description: "Description", short_description: "Short", image: "/image.webp", image_alt: "Image",
    hero_image: "/hero.webp", hero_image_alt: "Hero", small_box_image: "/box.webp", small_box_image_alt: "Box",
    governorate_id: 1, city_id: 2, main_area_id: 3, sub_area_id: 4, location_label: "Fallback", google_maps_url: "https://maps.example/fixture",
    latitude: 30, longitude: 31, map_zoom: 14, overview_body: "Overview", delivery_body: "Delivery", created_at: "2026-01-01", updated_at: "2026-01-02",
  } as PublicProjectRootRow;
}

export async function verifyPublicProjectCollectionCompleteness(client: SupabaseClient<Database>, expected: Array<{ id: number; locationIds: Array<number | null> }>) {
  currentClient = client;
  const rows = await projects.loadPublishedProjects();
  assert.equal(rows.length, expected.length, "Complete published Projects collection must not stop at the transport cap");
  assert.deepEqual(rows.map(row => Number(row.id)), expected.map(row => row.id));
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
  for (let index = 0; index < rows.length; index += 1) {
    const location = rows[index].location;
    assert.deepEqual([location.governorate, location.city, location.mainArea, location.subArea].map(level => level ? Number(level.id) : null), expected[index].locationIds, `Complete location hierarchy for Project ${rows[index].id}`);
  }
  assert.deepEqual(await projects.loadPublishedProjects(), rows, "complete mapped collection must keep stable order");
  return { projects: rows.length, locationHierarchyCells: rows.length * 4, completeUniqueOrder: true };
}

export function verifyProjectMappingAndGrouping() {
  const root = publicProjectFixture();
  const locations: PublicProjectLocationRow[] = [
    { id: 1, level: "governorate", parent_id: null, name_ar: "محافظة", name_en: null },
    { id: 2, level: "city", parent_id: 1, name_ar: "مدينة", name_en: " City " },
    { id: 3, level: "main_area", parent_id: 2, name_ar: "منطقة", name_en: "" },
    { id: 4, level: "sub_area", parent_id: 3, name_ar: "حي", name_en: null },
    { id: 4, level: "sub_area", parent_id: 3, name_ar: "Duplicate must not replace first", name_en: null },
  ];
  const one = mapper.mapProjectRowToPublicProject(root, locations);
  assert.deepEqual(mapper.mapProjectRowsToPublicProjects([root], locations), [one]);
  assert.deepEqual([one.location.governorate, one.location.city, one.location.mainArea, one.location.subArea], [
    { id: "1", nameAr: "محافظة", nameEn: null }, { id: "2", nameAr: "مدينة", nameEn: "City" },
    { id: "3", nameAr: "منطقة", nameEn: null }, { id: "4", nameAr: "حي", nameEn: null },
  ]);
  const optional = mapper.mapProjectRowsToPublicProjects([{ ...root, city_id: null, main_area_id: 999, sub_area_id: null } as unknown as PublicProjectRootRow], locations)[0];
  assert.equal(optional.location.city, null);
  assert.equal(optional.location.mainArea, null);
  assert.equal(optional.location.subArea, null);
  assert.equal(optional.location.description, "");
  assert.equal(optional.seo.canonicalUrl, null);
  assert.equal(optional.overview.mainImage, null);
  assert.deepEqual(optional.location.points, []);
  assert.equal(mapper.mapProjectRowToPublicProject(root).location.governorate, null);
  const names = ["__proto__", "constructor", "toString", "حي عربي", "__proto__", "حي عربي"];
  const rendered = renderToStaticMarkup(createElement(ProjectsMapSection, {
    projects: names.map((name, index) => ({ ...one, id: String(index), location: { ...one.location, subArea: { id: String(index), nameAr: name, nameEn: null } } })), mapPins: [],
  }));
  const groups = [...rendered.matchAll(/<span class="text-white\/70">([^<]*)<\/span><span class="text-\[#D8B87A\]">(\d+) مشروع<\/span>/gu)].map(match => [match[1], Number(match[2])]);
  assert.deepEqual(groups, [["__proto__", 2], ["constructor", 1], ["toString", 1], ["حي عربي", 2]]);
  const work: Array<{ n: number; locationIdReads: number }> = [];
  for (const n of [100, 500, 1000, 2000]) {
    let locationIdReads = 0;
    const rows = Array.from({ length: n }, (_, index) => new Proxy({ ...locations[3], id: index + 10 }, {
      get(target, property, receiver) { if (property === "id") locationIdReads += 1; return Reflect.get(target, property, receiver); },
    }));
    const result = mapper.mapProjectRowsToPublicProjects(Array.from({ length: n }, (_, index) => ({ ...root, id: index + 1, governorate_id: index + 10, city_id: index + 10, main_area_id: index + 10, sub_area_id: index + 10 })), rows);
    assert.equal(result.length, n);
    assert.equal(locationIdReads, n, "each Location ID must be indexed exactly once per mapping set");
    for (let index = 0; index < n; index += 1) assert.equal(result[index].location.subArea?.id, String(index + 10));
    work.push({ n, locationIdReads });
  }
  assert.match(read("src/lib/projects/load-published-projects.ts"), /return mapProjectRowsToPublicProjects\(projects, locations\)/u);
  return { renderedGroups: groups, work };
}

async function runTransportContract() {
  const size = 2507;
  const timestamps = ["2026-09-26T00:00:00+00:00", "2026-09-26T00:00:00.000001+00:00", "2026-09-26T00:00:00.001+00:00", "2026-09-26T00:00:00.1+00:00"];
  const baseRows = Array.from({ length: size }, (_, index) => ({ id: index * 2 + 1, slug: `audit-row-${index + 1}`, updated_at: timestamps[index % timestamps.length], canonical_url: null, robots_index: true }));
  const sources: Record<string, Array<Record<string, unknown>>> = {
    topics: baseRows.map((row, index) => ({ ...row, content_type: index % 2 ? "article" : "site_update", status: "published", deleted_at: null, published_at: row.updated_at, is_featured: false })),
    projects: baseRows.map(row => ({ ...row, publication_status: "published" })),
    pages: baseRows.map(row => ({ ...row, path: `/audit-page-${row.id}`, status: "published" })),
  };
  const expected = { topicIds: baseRows.map(row => row.id), projectSlugs: [...baseRows].sort((left, right) => timestamps.indexOf(right.updated_at) - timestamps.indexOf(left.updated_at) || right.id - left.id).map(row => row.slug), pageIds: baseRows.map(row => row.id) };
  const requests: Record<string, number> = {};
  let failTable: string | undefined;
  const client = createClient<Database>("http://127.0.0.1:1", "isolated-fixture", { auth: { persistSession: false }, global: { fetch: async input => {
    const url = new URL(String(input));
    const table = url.pathname.split("/").at(-1)!;
    const rows = sources[table];
    assert.ok(rows, `unexpected source ${table}`);
    requests[table] = (requests[table] ?? 0) + 1;
    assert.equal(url.searchParams.get("order"), "id.asc");
    assert.equal(Number(url.searchParams.get("limit")), 500);
    const cursor = Number(url.searchParams.get("id")?.replace("gt.", "") ?? -1);
    if (failTable === table && cursor > 0) return new Response(JSON.stringify({ message: "injected later page failure" }), { status: 503, headers: { "Content-Type": "application/json" } });
    // A server cap below our requested limit must not silently truncate enumeration.
    const result = rows.filter(row => Number(row.id) > cursor).slice(0, 137);
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  } } });
  const result = await verifyPublicReadCompleteness(client, expected);
  for (const count of Object.values(requests)) assert.ok(count > 3);
  failTable = "topics";
  await assert.rejects(content.loadPublicContentSitemapRows(), { code: "query_failed" });
  const failed = await sitemap.generateSitemapEntries();
  assert.ok(failed.sourceErrors.some(item => item.source === "articles"));
  assert.equal(failed.entries.filter(item => item.source === "articles" || item.source === "media").length, 0, "later page failure must not publish a partial source as complete");
  assert.equal(failed.entries.filter(item => item.source === "projects").length, size);
  failTable = "projects";
  await assert.rejects(projects.loadPublishedProjectSitemapRows(), { code: "query_failed" });
  failTable = "pages";
  const failedPages = await sitemap.generateSitemapEntries();
  assert.ok(failedPages.sourceErrors.some(item => item.source === "cms_pages"));
  assert.equal(failedPages.entries.filter(item => item.source === "cms_pages").length, 0);
  return { ...result, serverCap: 137, requestSize: 500, requests };
}

async function runProjectCollectionTransportContract() {
  const size = 2507;
  const timestamps = ["2026-09-26T00:00:00+00:00", "2026-09-26T00:00:00.000001+00:00", "2026-09-26T00:00:00.001+00:00", "2026-09-26T00:00:00.1+00:00"];
  const rootRows = Array.from({ length: size }, (_, index) => ({ ...publicProjectFixture(), id: index + 1, slug: `project-${index + 1}`, updated_at: timestamps[index % timestamps.length], sub_area_id: index + 10 }));
  const locationRows = [
    { id: 1, level: "governorate", parent_id: null, name_ar: "محافظة", name_en: null },
    { id: 2, level: "city", parent_id: 1, name_ar: "مدينة", name_en: null },
    { id: 3, level: "main_area", parent_id: 2, name_ar: "منطقة", name_en: null },
    ...rootRows.map(row => ({ id: row.sub_area_id, level: "sub_area", parent_id: 3, name_ar: `حي ${row.id}`, name_en: null })),
  ];
  const expected = [...rootRows].sort((left, right) => timestamps.indexOf(right.updated_at) - timestamps.indexOf(left.updated_at) || right.id - left.id).map(row => ({ id: row.id, locationIds: [1, 2, 3, row.sub_area_id] }));
  const requests: Record<string, number> = {};
  let failTable: string | undefined;
  let collectionCap = 137;
  let maximumLocationIds = 0;
  const client = createClient<Database>("http://127.0.0.1:1", "isolated-fixture", { auth: { persistSession: false }, global: { fetch: async input => {
    const url = new URL(String(input));
    const table = url.pathname.split("/").at(-1)!;
    assert.ok(table === "projects" || table === "project_locations");
    requests[table] = (requests[table] ?? 0) + 1;
    const filters = url.searchParams.getAll("id");
    const cursor = Number(filters.find(value => value.startsWith("gt."))?.slice(3) ?? -1);
    const wanted = filters.find(value => value.startsWith("in.("))?.slice(4, -1).split(",").map(Number);
    if (table === "project_locations") maximumLocationIds = Math.max(maximumLocationIds, wanted?.length ?? 0);
    if (failTable === table && cursor > 0) return new Response(JSON.stringify({ message: "injected later collection page failure" }), { status: 503, headers: { "Content-Type": "application/json" } });
    let rows = (table === "projects" ? rootRows : locationRows).filter(row => row.id > cursor && (!wanted || wanted.includes(row.id)));
    if (url.searchParams.get("order") === "updated_at.desc,id.desc") rows = [...rows].sort((left, right) => ("updated_at" in left && "updated_at" in right ? timestamps.indexOf(right.updated_at) - timestamps.indexOf(left.updated_at) : 0) || right.id - left.id);
    const result = rows.slice(0, collectionCap);
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  } } });
  const result = await verifyPublicProjectCollectionCompleteness(client, expected);
  assert.ok(maximumLocationIds <= 100, "Location membership requests must stay bounded independently of project count");
  assert.ok(requests.projects > 3 && requests.project_locations > 3);
  collectionCap = 53;
  await verifyPublicProjectCollectionCompleteness(client, expected);
  for (const table of ["projects", "project_locations"]) {
    failTable = table;
    await assert.rejects(projects.loadPublishedProjects(), { code: "query_failed" });
  }
  return { ...result, serverCaps: [137, 53], maximumLocationIds, requests };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify({ mapping: verifyProjectMappingAndGrouping(), enumeration: await runTransportContract(), projectCollection: await runProjectCollectionTransportContract() }, null, 2));
  console.log("PASS public sitemap completeness, prototype-safe map grouping, and linear indexed mapping");
}
