import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const resolver = read("src/lib/seo/resolve-global-seo-effective.ts");
const loader = read("src/lib/seo/load-global-seo-settings.ts");
const editor = read("src/app/admin/seo/meta-manager/MetaManagerClient.tsx");
const health = read("src/lib/seo/run-global-seo-health.ts");

assert.ok(resolver.includes("persisted\n      ? persistedSettings[key]\n      : environment\n        ? environmentSettings[key]\n        : codeFallback[key]"), "resolver order must be Database -> Environment -> Code Fallback");
assert.ok(resolver.includes('const source = persisted ? "database" : environment ? "environment" : "code_fallback"'));
assert.ok(resolver.includes("validateGlobalSeoSettingsInput(candidate)") && resolver.includes("delete candidate[issue.field]"), "invalid candidates must fall through safely");
assert.ok(loader.includes("loadGlobalSeoEffectiveContract") && loader.includes("loadGlobalSeoEffectiveContract()).settings"));
assert.ok(loader.includes("loadGlobalSeoEffectiveContractForAdmin") && loader.includes("noStore()"), "Admin must bypass stale public cache snapshots");
assert.ok(editor.includes("defaultValue: typeof persisted") && editor.includes("placeholder: typeof effective"));
assert.ok(editor.includes("!source.persisted") && editor.includes("لا يحفظها ضمنيًا"), "Admin must distinguish effective fallback from persisted values");
assert.ok(health.includes("effectiveSources") && health.includes("source: field.source") && health.includes("persisted: field.persisted"));

console.log("PASS Global SEO fallback chain: resolver order, invalid-candidate fallthrough, truthful Admin fields and diagnostic source proof.");
