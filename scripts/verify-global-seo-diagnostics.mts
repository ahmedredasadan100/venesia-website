import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import {
  evaluatePublicMediaClosureProof,
  type PublicMediaInfrastructureEvidence,
} from "../src/lib/seo/public-media-closure-proof.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const runner = read("src/lib/seo/run-global-seo-health.ts");
const dashboard = read("src/app/admin/seo/sitemap/SitemapMonitorClient.tsx");
const migration = read("sql/migrations/20260804120000_global_seo_capability_closure.sql");

if (!process.argv.includes("--footer-home-only")) {
for (const dimension of ["identity", "metadata", "crawl", "adoption", "infrastructure"]) {
  assert.ok(runner.includes(`"${dimension}"`), `missing health dimension ${dimension}`);
  assert.ok(dashboard.includes(`${dimension}:`) || dashboard.includes(` ${dimension}:`), `dashboard missing ${dimension}`);
}
assert.ok(runner.includes("check.weight * 0.5") && runner.includes("earned / total"), "health score must derive from weighted check outcomes");
assert.ok(runner.includes("loadCanonicalDrift") && runner.includes("productDecision: drift.length > 0"));
assert.ok(
  runner.includes("const contractPromise = loadGlobalSeoEffectiveContractForAdmin()") &&
    runner.includes("const canonicalDriftPromise = contractPromise.then") &&
    runner.includes("Promise.allSettled([canonicalDriftPromise])") &&
    !runner.includes("const drift = await loadCanonicalDrift(settings"),
  "canonical drift must wait only for its settings dependency, not the other SEO diagnostics",
);
assert.ok(!migration.includes("projects.canonical_url =") && !migration.match(/update\s+public\.projects/i), "migration must not mutate live project canonical values");
assert.ok(runner.includes("global_seo_infrastructure_health") && runner.includes("validateRedirectInput") && runner.includes("runSitemapDiagnostics"));
assert.ok(
  runner.includes("function parseInfrastructureProof(value: Json): InfrastructureProof") &&
    runner.includes("const proof = parseInfrastructureProof(data)") &&
    runner.includes("site_settings_service_only: readInfrastructureBoolean(value.site_settings_service_only)") &&
    runner.includes("footer_public_composition_audit_count: readInfrastructureNumber(value.footer_public_composition_audit_count)") &&
    !runner.includes("as InfrastructureProof"),
  "infrastructure RPC Json must be narrowed field-by-field into the existing proof contract",
);
assert.ok(dashboard.includes("Effective Source Contract") && dashboard.includes("Product Decision"));

assert.ok(runner.includes('supabase.rpc("public_media_closure_provenance")')
  && runner.includes("evaluatePublicMediaClosureProof({")
  && runner.includes('from "./public-media-closure-proof"'),
"Global SEO must evaluate the DB-owned completion receipt through its single proof contract");

const emptyCounts = { categories: 0, items: 0, seo: 0 };
const historicalCounts = { categories: 13, items: 28, seo: 14 };
const infrastructure = (empty: boolean): PublicMediaInfrastructureEvidence => ({
  singleSource: true, moduleContract: true, linkContract: true,
  counts: { ...(empty ? emptyCounts : historicalCounts) },
});
const receipt = (empty: boolean) => ({
  contract_version: 1,
  migration_version: "20260804180000",
  migration_revision: "validated-legacy-input-v1",
  input_state: empty ? "validated-empty-legacy" : "populated-legacy",
  source_counts: { ...(empty ? emptyCounts : historicalCounts) },
  expected_audits: { ...(empty ? emptyCounts : historicalCounts) },
  migration_registered: true,
  structural_complete: true,
  audit_counts: { ...(empty ? emptyCounts : historicalCounts) },
  historical_audit_total: empty ? 0 : 55,
});
const absent = {
  code: "PGRST202",
  message: "Could not find the function public.public_media_closure_provenance without parameters in the schema cache",
};
let closureChecks = 0;
function closureCheck(label: string, condition: unknown) {
  assert.ok(condition, label);
  closureChecks += 1;
}
for (const empty of [true, false]) {
  const result = evaluatePublicMediaClosureProof(infrastructure(empty), { data: receipt(empty), error: null });
  closureCheck("Both explicit completed paths pass without inventing historical records",
    result.ok && result.revisionAttested
    && result.path === (empty ? "validated-empty-legacy" : "populated-legacy"));
  if (result.ok) assert.deepEqual(result.expectedAudits, empty ? emptyCounts : historicalCounts);
}
const historicalCompatibility = evaluatePublicMediaClosureProof(infrastructure(false), { data: null, error: absent });
closureCheck("Older database evidence remains compatible without claiming an attested revision",
  historicalCompatibility.ok && historicalCompatibility.path === "historical-evidence-compatible"
  && !historicalCompatibility.revisionAttested);
closureCheck("Zero counts cannot imply completed empty bootstrap when the helper is absent",
  !evaluatePublicMediaClosureProof(infrastructure(true), { data: null, error: absent }).ok);

for (const error of [
  { ...absent, message: absent.message.replace("public_media_closure_provenance", "other_function") },
  { ...absent, message: absent.message.replace("without parameters", "with parameters argument") },
  { code: "42883", message: "function internal_dependency() does not exist" },
  { code: "42501", message: "permission denied" },
  { code: "PGRST203", message: "ambiguous function" },
  { code: "57014", message: "query canceled" },
  { message: "network unavailable" },
]) closureCheck("Arbitrary RPC failure must never fall back to historical counts",
  !evaluatePublicMediaClosureProof(infrastructure(false), { data: null, error }).ok);
closureCheck("A missing-endpoint error cannot accompany usable attestation data",
  !evaluatePublicMediaClosureProof(infrastructure(false), { data: receipt(false), error: absent }).ok);

for (const data of [
  null, [], {},
  { ...receipt(true), contract_version: 2 },
  { ...receipt(true), migration_version: "20260805090000" },
  { ...receipt(true), migration_revision: "unknown" },
  { ...receipt(true), input_state: "guessed-empty" },
  { ...receipt(true), unexpected: true },
  { ...receipt(true), migration_registered: false },
  { ...receipt(true), structural_complete: false },
  { ...receipt(true), migration_registered: "true" },
  { ...receipt(true), source_counts: historicalCounts },
  { ...receipt(true), expected_audits: historicalCounts },
  { ...receipt(true), audit_counts: historicalCounts },
  { ...receipt(true), historical_audit_total: 1 },
  { ...receipt(true), source_counts: { categories: 0, items: 0, seo: "0" } },
  { ...receipt(true), source_counts: { categories: 0, items: 0, seo: 0.5 } },
  { ...receipt(true), source_counts: { categories: 0, items: 0, seo: -1 } },
  { ...receipt(true), source_counts: { categories: 0, items: 0, seo: 0, extra: 0 } },
]) closureCheck("Malformed, unregistered or contradictory completion evidence fails closed",
  !evaluatePublicMediaClosureProof(infrastructure(true), { data, error: null }).ok);

for (const [property, value] of [
  ["singleSource", false], ["moduleContract", false], ["linkContract", false],
  ["singleSource", undefined], ["counts", historicalCounts],
] as const) closureCheck("Current Global SEO infrastructure must agree with the empty attestation",
  !evaluatePublicMediaClosureProof({ ...infrastructure(true), [property]: value }, { data: receipt(true), error: null }).ok);
closureCheck("Historical attestation rejects erased audit evidence",
  !evaluatePublicMediaClosureProof(infrastructure(false), {
    data: { ...receipt(false), audit_counts: emptyCounts }, error: null,
  }).ok);
closureCheck("Historical attestation rejects extra tagged audit evidence",
  !evaluatePublicMediaClosureProof(infrastructure(false), {
    data: { ...receipt(false), historical_audit_total: 56 }, error: null,
  }).ok);
closureCheck("Original historical compatibility retains its original infrastructure conditions",
  !evaluatePublicMediaClosureProof({ ...infrastructure(false), linkContract: false }, { data: null, error: absent }).ok);

console.log("PASS Global SEO diagnostics: five real dimensions, weighted checks, effective sources, specialized diagnostics, canonical decision-only boundary.");
console.log(`PASS Global SEO Public Media closure evidence: ${closureChecks} behavioral controls; no database or environment access.`);
}

// Execute the real pure Footer and Health owners with the repository's existing
// transpileModule/vm test pattern. Unknown external dependencies fail closed.
const pureModules = new Map<string, { exports: unknown }>();
function loadPure<T>(file: string): T {
  const filename = path.resolve(import.meta.dirname, "..", file);
  if (pureModules.has(filename)) return pureModules.get(filename)!.exports as T;
  const target = { exports: {} as unknown };
  pureModules.set(filename, target);
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const localRequire = (specifier: string): unknown => {
    assert.ok(specifier.startsWith("."), `Unexpected non-pure dependency: ${specifier}`);
    const base = path.resolve(path.dirname(filename), specifier);
    const candidate = [base, `${base}.ts`].find((item) => existsSync(item) && item.endsWith(".ts"));
    assert.ok(candidate, `Unresolved pure dependency: ${specifier}`);
    return loadPure(candidate);
  };
  new vm.Script(`(function(require,module,exports){${code}\n})`, { filename })
    .runInThisContext()(localRequire, target, target.exports);
  return target.exports as T;
}
const { evaluateFooterCompositionProof } = loadPure<typeof import("../src/lib/seo/footer-public-composition-proof.ts")>(
  "src/lib/seo/footer-public-composition-proof.ts",
);
const { createFreshFooterSettings, DEFAULT_FOOTER_SLOTS } = loadPure<typeof import("../src/lib/footer/defaults.ts")>(
  "src/lib/footer/defaults.ts",
);
assert.ok(runner.includes('supabase.rpc("footer_public_composition_provenance")')
  && runner.includes("evaluateFooterCompositionProof({")
  && runner.includes("footerComposition.homeStatus") && runner.includes("footerComposition.footerStatus"),
"Global SEO must consume the canonical proof outcomes, including publication warnings");
assert.ok(runner.includes('["media_hub_composition_assignment_count", "Media Hub composition", 5]')
  && runner.includes('["media_sidebar_composition_assignment_count", "Media Sidebar composition", 18]')
  && runner.includes('["media_hero_composition_assignment_count", "Media Center hero composition", 6]'),
"The Footer/Home correction must preserve unrelated Media inventory assertions");

const readyFooter = () => ({
  slots: structuredClone(DEFAULT_FOOTER_SLOTS),
  contactItems: [{ label: "Test contact", value: "123" }],
  socialLinks: [{ platform: "facebook", label: "Test", href: "https://example.test" }],
  legal: { copyright: "Synthetic test", tagline: "Synthetic test" },
});
const rawFooter = (ready: boolean) => {
  const value = ready ? readyFooter() : createFreshFooterSettings();
  return { "footer.slots": value.slots, "footer.contact_items": value.contactItems,
    "footer.social_links": value.socialLinks, "footer.legal": value.legal };
};
const footerInfrastructure = (fresh: boolean, published = !fresh) => ({
  singleSource: true, orphanSettings: 0, unresolvedReferences: 0,
  historicalAudits: fresh ? 0 : 2, publishedHomeAssignments: published ? 4 : 0,
  mediaHubAssignments: 5, mediaSidebarAssignments: 18, mediaHeroAssignments: 6,
});
const footerReceipt = (fresh: boolean, published = !fresh, ready = !fresh) => ({
  contract_version: 1, migration_version: "20260805090000", migration_revision: "system-manageable-fresh-v1",
  input_state: fresh ? "proven_fresh" : "historical_configured", migration_registered: true,
  structural_complete: true, historical_audit_total: fresh ? 0 : 2, expected_historical_audits: fresh ? 0 : 2,
  historical_audit_counts: { footer_brand_removed: fresh ? 0 : 1, composition_fallback_retired: fresh ? 0 : 1 },
  home: { identity_count: 1, id: 1, slug: "home", path: "/", status: published ? "published" : "draft", assignment_count: published ? 4 : 0,
    published_assignment_count: published ? 4 : 0 }, footer_settings: rawFooter(ready),
});
const footerAbsent = { code: "PGRST202",
  message: "Could not find the function public.footer_public_composition_provenance without parameters in the schema cache" };
let footerChecks = 0;
function footerCheck(label: string, condition: unknown) {
  assert.ok(condition, label); footerChecks += 1;
}
const evaluateFooter = (data: unknown, infrastructure = footerInfrastructure(true), error: unknown = null) =>
  evaluateFooterCompositionProof(infrastructure, { data, error });
const freshFooterResult = evaluateFooter(footerReceipt(true));
footerCheck("A trusted fresh manageable system is valid, but neither Home nor Footer receives publication PASS",
  freshFooterResult.ok && freshFooterResult.path === "proven_fresh" && freshFooterResult.homeStatus === "warning"
  && freshFooterResult.footerStatus === "warning" && freshFooterResult.expectedHistoricalAudits === 0);
const configuredFresh = evaluateFooter(footerReceipt(true, true, true), footerInfrastructure(true, true));
footerCheck("Fresh provenance does not permanently warn after real publication inputs are completed",
  configuredFresh.ok && configuredFresh.homeStatus === "pass" && configuredFresh.footerStatus === "pass");
const footerOnly = evaluateFooter(footerReceipt(true, false, true));
footerCheck("Footer readiness does not imply Home publication readiness",
  footerOnly.ok && footerOnly.footerStatus === "pass" && footerOnly.homeStatus === "warning");
const homeOnly = evaluateFooter(footerReceipt(true, true, false), footerInfrastructure(true, true));
footerCheck("Home publication does not imply Footer publication readiness",
  homeOnly.ok && homeOnly.homeStatus === "pass" && homeOnly.footerStatus === "warning");
const historicalFooter = evaluateFooter(footerReceipt(false), footerInfrastructure(false));
footerCheck("The strict historical configured path remains publication-ready with its actual audits",
  historicalFooter.ok && historicalFooter.homeStatus === "pass" && historicalFooter.footerStatus === "pass"
  && historicalFooter.expectedHistoricalAudits === 2 && historicalFooter.revisionAttested);
const oldFooter = evaluateFooter(null, footerInfrastructure(false), footerAbsent);
footerCheck("Original databases retain exact historical proof without a fabricated revision or new Footer readiness claim",
  oldFooter.ok && !oldFooter.revisionAttested && oldFooter.homeStatus === "pass" && oldFooter.footerStatus === null);
footerCheck("Missing RPC never validates fresh zero counts", !evaluateFooter(null, footerInfrastructure(true), footerAbsent).ok);

for (const error of [
  { ...footerAbsent, message: footerAbsent.message.replace("footer_public_composition_provenance", "other") },
  { ...footerAbsent, message: footerAbsent.message.replace("without parameters", "with parameters argument") },
  { code: "42883", message: "nested function missing" }, { code: "42501", message: "permission denied" },
  { code: "PGRST203", message: "ambiguous" }, { code: "57014", message: "cancelled" }, { message: "network" },
]) footerCheck("Only the exact absent historical endpoint permits compatibility",
  !evaluateFooter(null, footerInfrastructure(false), error).ok);
footerCheck("A failing endpoint cannot also provide a trusted receipt",
  !evaluateFooter(footerReceipt(false), footerInfrastructure(false), footerAbsent).ok);

for (const data of [
  null, [], {}, { ...footerReceipt(true), extra: true },
  { ...footerReceipt(true), contract_version: 2 }, { ...footerReceipt(true), migration_version: "20260804180000" },
  { ...footerReceipt(true), migration_revision: "unknown" }, { ...footerReceipt(true), input_state: "inferred_empty" },
  { ...footerReceipt(true), migration_registered: false }, { ...footerReceipt(true), structural_complete: false },
  { ...footerReceipt(true), migration_registered: "true" },
  { ...footerReceipt(true), expected_historical_audits: 2 }, { ...footerReceipt(true), historical_audit_total: 2 },
  { ...footerReceipt(true), historical_audit_counts: null },
  { ...footerReceipt(true), historical_audit_counts: { footer_brand_removed: 0 } },
  { ...footerReceipt(true), historical_audit_counts: { footer_brand_removed: 0, composition_fallback_retired: 0, extra: 0 } },
  { ...footerReceipt(true), historical_audit_counts: { footer_brand_removed: 0, composition_fallback_retired: "0" } },
  { ...footerReceipt(true), historical_audit_counts: { footer_brand_removed: 1, composition_fallback_retired: 0 } },
  { ...footerReceipt(true), historical_audit_total: "0" }, { ...footerReceipt(true), home: null },
  { ...footerReceipt(true), home: { ...footerReceipt(true).home, identity_count: 0 } },
  { ...footerReceipt(true), home: { ...footerReceipt(true).home, identity_count: 2 } },
  { ...footerReceipt(true), home: { ...footerReceipt(true).home, id: 0 } },
  { ...footerReceipt(true), home: { ...footerReceipt(true).home, id: 0.5 } },
  { ...footerReceipt(true), home: { ...footerReceipt(true).home, id: "1" } },
  { ...footerReceipt(true), home: { ...footerReceipt(true).home, slug: "other" } },
  { ...footerReceipt(true), home: { ...footerReceipt(true).home, path: "/other" } },
  { ...footerReceipt(true), home: { ...footerReceipt(true).home, status: "invented" } },
  { ...footerReceipt(true), home: { ...footerReceipt(true).home, assignment_count: -1 } },
  { ...footerReceipt(true), home: { ...footerReceipt(true).home, assignment_count: 0.5 } },
  { ...footerReceipt(true), home: { ...footerReceipt(true).home, published_assignment_count: "0" } },
  { ...footerReceipt(true), home: { ...footerReceipt(true).home, published_assignment_count: 1 } },
  { ...footerReceipt(true), home: { ...footerReceipt(true).home, extra: true } },
  { ...footerReceipt(true), footer_settings: {} },
  { ...footerReceipt(true), footer_settings: { ...rawFooter(false), "footer.brand": {} } },
  { ...footerReceipt(true), footer_settings: { ...rawFooter(false), "footer.slots": null } },
  { ...footerReceipt(true), footer_settings: { ...rawFooter(false), "footer.contact_items": {} } },
  { ...footerReceipt(true), footer_settings: { ...rawFooter(false), "footer.legal": { copyright: 1, tagline: "" } } },
]) footerCheck("Malformed or contradictory proof cannot downgrade corruption into an editorial warning", !evaluateFooter(data).ok);

for (const property of ["singleSource", "orphanSettings", "unresolvedReferences", "historicalAudits", "publishedHomeAssignments"] as const) {
  footerCheck("Current database evidence must agree with the fresh receipt",
    !evaluateFooterCompositionProof({ ...footerInfrastructure(true), [property]: undefined },
      { data: footerReceipt(true), error: null }).ok);
}
for (const property of ["historicalAudits", "publishedHomeAssignments", "mediaHubAssignments", "mediaSidebarAssignments", "mediaHeroAssignments"] as const) {
  footerCheck("Historical missing-RPC compatibility keeps every original inventory assertion",
    !evaluateFooterCompositionProof({ ...footerInfrastructure(false), [property]: 0 }, { data: null, error: footerAbsent }).ok);
}
for (const count of [0, 3, 5]) {
  const proof = footerReceipt(true, true, true);
  proof.home.assignment_count = count; proof.home.published_assignment_count = count;
  const result = evaluateFooter(proof, { ...footerInfrastructure(true, true), publishedHomeAssignments: count });
  footerCheck("Published Home never receives a warning or PASS when its existing four-assignment contract fails",
    result.ok && result.homeStatus === "fail");
}
const historicalUnpublished = evaluateFooter(footerReceipt(false, false), footerInfrastructure(false, false));
footerCheck("Historical configured Home retains strict published inventory requirements",
  historicalUnpublished.ok && historicalUnpublished.homeStatus === "fail");
for (const counts of [
  { footer_brand_removed: 2, composition_fallback_retired: 0 },
  { footer_brand_removed: 0, composition_fallback_retired: 2 },
]) footerCheck("A historical total of two cannot conceal a missing action and duplicate of the other",
  !evaluateFooter({ ...footerReceipt(false), historical_audit_counts: counts }, footerInfrastructure(false)).ok);
console.log(`PASS Global SEO Footer/Home readiness: ${footerChecks} behavioral controls; canonical Footer parser, strict historical evidence, no database or environment access.`);
