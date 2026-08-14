import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const runner = read("src/lib/seo/run-global-seo-health.ts");
const dashboard = read("src/app/admin/seo/sitemap/SitemapMonitorClient.tsx");
const migration = read("sql/migrations/20260804120000_global_seo_capability_closure.sql");

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
assert.ok(dashboard.includes("Effective Source Contract") && dashboard.includes("Product Decision"));

console.log("PASS Global SEO diagnostics: five real dimensions, weighted checks, effective sources, specialized diagnostics, canonical decision-only boundary.");
