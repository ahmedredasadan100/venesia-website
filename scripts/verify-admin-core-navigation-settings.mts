import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createJiti } from "jiti";
import { buildCoreNavigationSettingsPlan } from "./fixtures/admin-core-navigation-settings-journeys.mjs";
const root = resolve(import.meta.dirname, "..");
const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false, alias: { "server-only": resolve(root, "node_modules/next/dist/compiled/server-only/empty.js") } });
const owner = await jiti.import<typeof import("./verify-admin-core-navigation-settings-isolated.mts")>(resolve(root, "scripts/verify-admin-core-navigation-settings-isolated.mts"));
const { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST: manifest } = await jiti.import<typeof import("../src/lib/admin/form-system/adoption-manifest.ts")>(resolve(root, "src/lib/admin/form-system/adoption-manifest.ts"));
const { ADMIN_COLLECTION_SURFACE_ADOPTION: collections } = await jiti.import<typeof import("../src/lib/admin/interaction-system/adoption-manifest.ts")>(resolve(root, "src/lib/admin/interaction-system/adoption-manifest.ts"));
const requiredCases = manifest.filter(row => ["pages-quick-create", "menu-quick-create"].includes(row.id)).flatMap(row => row.surfaces.flatMap(surface => ["save_reload", "failure_preserves_input", "retry"].map(scenario => ({ key: ["form", row.id, surface, scenario].join(":"), boundary: "form", consumer: row.id, surface, scenario }))));
const args = { manifest, collections: collections.surfaces, requiredCases, fixtures: { recipe: owner.CORE_NAVIGATION_RECIPE, duplicatePagePath: "/about", duplicateMenuSlug: "existing-menu", originalFooterHash: "a".repeat(64) } };
const cases: string[] = [];
const test = async (name: string, callback: () => unknown | Promise<unknown>) => { await callback(); cases.push(name); };
await test("Canonical five Form and four Collection boundaries derive only six generic lifecycle cells", () => { const plan = buildCoreNavigationSettingsPlan(args); assert.equal(plan.consumers.length, 5); assert.equal(plan.pageCoverage.length + plan.menuCoverage.length, 6); assert.deepEqual(plan.specializedAutomaticCoverage, []); assert.equal(plan.globalClosed, false); assert.deepEqual(plan.consumers[4].surfaces, ["seo"]); });
for (const id of ["pages-quick-create", "menu-quick-create", "menu-builder", "footer-builder", "page-composition-and-seo"]) await test("Missing canonical boundary rejects: " + id, () => assert.throws(() => buildCoreNavigationSettingsPlan({ ...args, manifest: manifest.filter(row => row.id !== id) })));
await test("Duplicate boundary cannot double-count observations", () => assert.throws(() => buildCoreNavigationSettingsPlan({ ...args, manifest: [...manifest, manifest.find(row => row.id === "menu-builder")] })));
await test("Specialized closure cannot be promoted through generic classification", () => assert.throws(() => buildCoreNavigationSettingsPlan({ ...args, manifest: manifest.map(row => row.id === "footer-builder" ? { ...row, classification: "shared_adopter" } : row) })));
await test("Missing Footer manual-link collection rejects", () => assert.throws(() => buildCoreNavigationSettingsPlan({ ...args, collections: collections.surfaces.filter(row => row.id !== "footer-manual-links") })));
await test("Missing generic lifecycle cell rejects", () => assert.throws(() => buildCoreNavigationSettingsPlan({ ...args, requiredCases: requiredCases.slice(1) })));
await test("Repeated generic lifecycle cell rejects", () => assert.throws(() => buildCoreNavigationSettingsPlan({ ...args, requiredCases: [...requiredCases, requiredCases[0]] })));
const request = { id: randomUUID(), kind: "navigation-settings-state", entity: "menu", phase: "baseline" };
await test("Fixed checkpoint accepts no Browser expectation or SQL", () => assert.deepEqual(owner.validateCoreNavigationSettingsRequest(request), request));
for (const changed of [{ sql: "select secret" }, { expected: [] }, { menuId: 1 }, { actorId: 1 }, { phase: "commit-anything" }, { kind: "run-sql" }, { entity: "__proto__" }, { entity: "constructor" }, { id: "invalid-uuid" }, { phase: "seo-saved" }]) await test("Reject unknown checkpoint contract: " + Object.keys(changed)[0] + "/" + String(Object.values(changed)[0]), () => assert.throws(() => owner.validateCoreNavigationSettingsRequest({ ...request, ...changed })));
await test("Every declared finite phase is independently addressable", () => { for (const [entity, phases] of Object.entries(owner.NAVIGATION_SETTINGS_PHASES)) for (const phase of phases) owner.validateCoreNavigationSettingsRequest({ ...request, entity, phase }); assert.equal(Object.values(owner.NAVIGATION_SETTINGS_PHASES).reduce((sum, phases) => sum + phases.length, 0), 31); });
const r = owner.CORE_NAVIGATION_RECIPE.menu, ids = { a: 101, b: 102, c: 103 };
const base = { menu_id: 41, parent_id: null, href: "#", linked_type: null, linked_id: null, anchor: null, target: "_self", css_class: null, style_preset: "default", is_visible: true, item_type: "parent" };
const graph = [{ ...base, id: 101, label: r.a, sort_order: 20 }, { ...base, id: 102, label: r.b, sort_order: 10 }, { ...base, id: 103, parent_id: 102, label: r.editedC, sort_order: 10, href: r.editedHref, item_type: "external", target: "_blank", css_class: r.css, style_preset: "gold-card", is_visible: false }];
await test("Complete hidden/reparented/reordered graph accepted with exact authored identity", () => owner.assertCoreNavigationGraph(graph, 41, "hidden", ids));
for (const [name, mutate] of [
  ["orphan", (rows: typeof graph) => { rows[2].parent_id = 999; }],
  ["cycle", (rows: typeof graph) => { rows[1].parent_id = 103; }],
  ["foreign menu", (rows: typeof graph) => { rows[2].menu_id = 99; }],
  ["duplicate ID", (rows: typeof graph) => { rows[2].id = 101; }],
  ["wrong order", (rows: typeof graph) => { rows[0].sort_order = 10; }],
  ["wrong destination", (rows: typeof graph) => { rows[2].href = "https://example.invalid/other"; }],
  ["wrong visibility", (rows: typeof graph) => { rows[2].is_visible = true; }],
  ["missing child", (rows: typeof graph) => { rows.pop(); }],
] as const) await test("Graph corruption rejects: " + name, () => { const changed = structuredClone(graph); mutate(changed); assert.throws(() => owner.assertCoreNavigationGraph(changed, 41, "hidden", ids)); });
await test("Subtree delete preserves only the original first root and renormalizes order", () => owner.assertCoreNavigationGraph([{ ...graph[0], sort_order: 10 }], 41, "subtree-deleted", ids));
const footer = await owner.buildExpectedCoreNavigationFooter([{ key: "footer.contact_items", value: [{ label: " preserved ", value: " original ", visible: true }] }], 41);
const { validateFooterSlots } = await jiti.import<typeof import("../src/lib/footer/validate-footer-slots.ts")>(resolve(root, "src/lib/footer/validate-footer-slots.ts"));
const slots = footer.find(row => row.key === "footer.slots")!.value as import("../src/lib/footer/footer-slot-types.ts").FooterSlotsConfig;
await test("Authored Footer uses canonical four-slot schema and real Menu identity", () => { assert.equal(validateFooterSlots(slots).ok, true); assert.deepEqual(slots.slots.map(slot => [slot.index, slot.type]), [[1, "custom_links"], [2, "text"], [3, "menu"], [4, "contact"]]); assert.equal((slots.slots[2].config as { menuId: number }).menuId, 41); });
await test("Footer manual draft owner preserves only edited/reordered and surviving links", () => { const links = (slots.slots[0].config as { links: { label: string; sortOrder: number; link: { href: string } }[] }).links; assert.deepEqual(links.map(row => [row.label, row.sortOrder]), [[owner.CORE_NAVIGATION_RECIPE.footer.editedLink, 0], [owner.CORE_NAVIGATION_RECIPE.footer.links[0], 1]]); assert.equal(links[0].link.href, owner.CORE_NAVIGATION_RECIPE.footer.editedHref); });
await test("Nonempty original global contacts normalize through the current owner", () => assert.deepEqual(footer.find(row => row.key === "footer.contact_items")!.value, [{ label: "preserved", value: "original" }]));
await test("Disabled slot is still schema validated", () => { const changed = structuredClone(slots); changed.slots[0].enabled = false; (changed.slots[0].config as Record<string, unknown>).links = "invalid"; assert.equal(validateFooterSlots(changed).ok, false); });
await test("Footer unsafe href rejects using the actual owner", () => { const changed = structuredClone(slots); (changed.slots[0].config as { links: { href: string }[] }).links[0].href = "javascript:alert(1)"; assert.equal(validateFooterSlots(changed).ok, false); });
const seo = await jiti.import<typeof import("../src/lib/seo/entity-seo-types.ts")>(resolve(root, "src/lib/seo/entity-seo-types.ts"));
const seoValues = { seoTitle: owner.CORE_NAVIGATION_RECIPE.page.seoTitle, seoDescription: owner.CORE_NAVIGATION_RECIPE.page.seoDescription, focusKeyword: owner.CORE_NAVIGATION_RECIPE.page.focusKeyword, seoKeywords: [...owner.CORE_NAVIGATION_RECIPE.page.seoKeywords], canonicalUrl: owner.CORE_NAVIGATION_RECIPE.page.canonicalUrl, robotsIndex: false, robotsFollow: false, ogImage: "", ogImageAlt: "" };
await test("Authored valid SEO passes real limits; negative control rejects only canonical URL", () => { assert.deepEqual(seo.validateEntitySeoValues(seoValues), []); const issues = seo.validateEntitySeoValues({ ...seoValues, canonicalUrl: "ftp://example.invalid/rejected" }); assert.equal(issues.length, 1); assert.equal(issues[0].field, "canonical_url"); });
const nativeSource = readFileSync(resolve(root, "scripts/verify-admin-core-navigation-settings-isolated.mts"), "utf8"), browserSource = readFileSync(resolve(root, "scripts/fixtures/admin-core-navigation-settings-journeys.mjs"), "utf8");
await test("Browser has no SQL/credential transport and requires owned cleanup", () => { assert.ok(!browserSource.includes("service_role") && !browserSource.includes("handle.query") && !browserSource.includes("page.request")); assert.match(browserSource, /requiresOwnedCleanupBeforePromotion: true/u); assert.match(nativeSource, /state\.cleanup, true/u); });
await test("Cleanup uses captured exact key set and assertion before commit", () => { const cleanup = nativeSource.slice(nativeSource.indexOf("export async function cleanupCoreNavigationSettingsFixtures")); const proof = cleanup.indexOf("assert.deepEqual(await footerRows(handle), state.originalFooter)"); const commit = cleanup.indexOf('await handle.query("commit")'); assert.ok(proof >= 0 && commit > proof); assert.match(cleanup, /FOOTER_SETTING_KEYS.*filter/u); assert.match(cleanup, /rollback/u); });
console.log(JSON.stringify({ status: "pass", controls: cases.length, cases, runtimeExecuted: false, globalClosed: false }));
