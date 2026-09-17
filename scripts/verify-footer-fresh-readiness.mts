import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import type { FooterSettings } from "../src/lib/footer/types.ts";

// Execute the actual Footer owner. Only external read/cache ports are isolated.
const root = path.resolve(import.meta.dirname, "..");
const modules = new Map<string, { exports: unknown }>();
const stubs = new Map<string, unknown>([
  ["server-only", {}],
  ["react", { cache: (fn: unknown) => fn }],
  ["next/cache", { unstable_cache: (fn: unknown) => fn, unstable_noStore: () => undefined }],
]);
function load<T>(file: string): T {
  const filename = path.resolve(root, file);
  if (stubs.has(filename)) return stubs.get(filename) as T;
  if (modules.has(filename)) return modules.get(filename)!.exports as T;
  const target = { exports: {} as unknown };
  modules.set(filename, target);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const localRequire = (specifier: string): unknown => {
    if (stubs.has(specifier)) return stubs.get(specifier);
    if (specifier.startsWith(".")) {
      const base = path.resolve(path.dirname(filename), specifier);
      for (const candidate of [base, `${base}.ts`, path.join(base, "index.ts")]) {
        if (stubs.has(candidate) || existsSync(candidate) && candidate.endsWith(".ts")) return load(candidate);
      }
    }
    return createRequire(filename)(specifier);
  };
  new vm.Script(`(function(require,module,exports){${source}\n})`, { filename })
    .runInThisContext()(localRequire, target, target.exports);
  return target.exports as T;
}
let rows: Array<{ key: string; value: unknown }> = [];
let readError = false;
let reads = 0;
let resolvedLinks = 0;
stubs.set(path.resolve(root, "src/lib/supabase-admin.ts"), {
  getSupabaseAdmin: () => ({ from: (table: string) => {
    assert.equal(table, "site_settings");
    return { select: () => ({ in: async () => {
      reads += 1;
      return { data: rows, error: readError ? { message: "Isolated read failure" } : null };
    } }) };
  } }),
});
stubs.set(path.resolve(root, "src/lib/logging.ts"), { logError: () => undefined });
stubs.set(path.resolve(root, "src/lib/admin/links/block-config-links.ts"), {
  resolveFooterSettingsLinks: async (settings: unknown) => { resolvedLinks += 1; return settings; },
});

const defaults = load<typeof import("../src/lib/footer/defaults.ts")>("src/lib/footer/defaults.ts");
const owner = load<typeof import("../src/lib/footer/footer-settings-readiness.ts")>("src/lib/footer/footer-settings-readiness.ts");
const loader = load<typeof import("../src/lib/footer/load-footer-settings.ts")>("src/lib/footer/load-footer-settings.ts");
let controls = 0;
function check(label: string, value: unknown) { assert.ok(value, label); controls += 1; }
const oldReset = {
  version: 1,
  slots: [
    { index: 1, enabled: true, type: "text", heading: "Venesia Developments", config: {
      title: "", body: "Building trust before concrete.", showBrandIcon: true,
      cta: { enabled: false, label: "", href: "", target: "_self" },
    } },
    { index: 2, enabled: true, type: "menu", heading: "القائمة الرئيسية", config: {
      source: "location", menuId: null, location: "footer", fallbackLocation: "footer", maxItems: null, showOnlyTopLevel: true,
    } },
    { index: 3, enabled: true, type: "media", heading: "المركز الإعلامي", config: {
      source: "main_submenu", parentHref: "/media-center", parentLink: null, menuId: null, manualLinks: [], maxItems: null,
    } },
    { index: 4, enabled: true, type: "contact", heading: "تواصل معنا", config: { source: "global", items: [] } },
  ],
};
assert.deepEqual(defaults.DEFAULT_FOOTER_SLOTS, oldReset);
assert.deepEqual(defaults.createFooterSlotsPreset("reset"), oldReset);
check("Existing Reset payload remains exactly unchanged", true);

const fresh = defaults.createFreshFooterSettings();
assert.deepEqual(fresh.slots.slots.map(({ index, type, enabled, heading }) => ({ index, type, enabled, heading })), [
  { index: 1, type: "text", enabled: false, heading: null },
  { index: 2, type: "menu", enabled: false, heading: null },
  { index: 3, type: "media", enabled: false, heading: null },
  { index: 4, type: "contact", enabled: false, heading: null },
]);
check("Fresh slots preserve the canonical structure without activation", true);
assert.deepEqual(fresh.contactItems, []);
assert.deepEqual(fresh.socialLinks, []);
assert.deepEqual(fresh.legal, { copyright: "", tagline: "" });
assert.deepEqual(fresh.slots.slots[0].config, {
  title: "", body: "", showBrandIcon: false, cta: { enabled: false, label: "", href: "", target: "_self" },
});
check("Fresh structure contains no invented business content", true);
for (const index of [1, 2, 3]) assert.deepEqual(fresh.slots.slots[index].config, oldReset.slots[index].config);
check("Fresh menu/media/contact sources derive from the same preset", true);
const freshProof = owner.evaluateFooterReadiness(fresh);
check("Fresh is System Valid and not Publication Ready", freshProof.systemValid && !freshProof.publicationReady);
const changedCopy = defaults.createFreshFooterSettings();
changedCopy.slots.slots[0].heading = "Separate draft";
check("Preset calls do not share mutable draft objects", defaults.createFreshFooterSettings().slots.slots[0].heading === null);

const complete = {
  slots: structuredClone(defaults.DEFAULT_FOOTER_SLOTS),
  contactItems: [{ label: "QA contact", value: "123" }],
  socialLinks: [{ platform: "facebook" as const, label: "QA social", href: "https://example.invalid/qa" }],
  legal: { copyright: "QA legal", tagline: "QA tagline" },
};
check("Configured Footer retains publication readiness", owner.evaluateFooterReadiness(complete).publicationReady);
check("Missing business field preserves validity but blocks publication", (() => {
  const proof = owner.evaluateFooterReadiness({ ...complete, legal: { copyright: "", tagline: "QA" } });
  return proof.systemValid && !proof.publicationReady;
})());
for (const bad of [
  null, [], {},
  { ...fresh, contactItems: null },
  { ...fresh, contactItems: [{}] },
  { ...fresh, socialLinks: [{ platform: "unknown", label: "QA", href: "/qa" }] },
  { ...fresh, legal: { copyright: 1, tagline: "" } },
  { ...fresh, slots: { ...fresh.slots, version: 2 } },
  { ...fresh, slots: { ...fresh.slots, slots: [] } },
  { ...fresh, slots: { ...fresh.slots, slots: fresh.slots.slots.map((slot) => ({ ...slot, index: 1 })) } },
  { ...fresh, slots: { ...fresh.slots, slots: fresh.slots.slots.map((slot, i) => i === 0 ? { ...slot, config: null } : slot) } },
  { ...fresh, slots: { ...fresh.slots, slots: fresh.slots.slots.map((slot, i) => i === 0
    ? { ...slot, enabled: true, config: { title: "", body: "", showBrandIcon: false, cta: { enabled: true, label: "", href: "", target: "_self" } } } : slot) } },
  { ...fresh, slots: { ...fresh.slots, slots: fresh.slots.slots.map((slot, i) => i === 1
    ? { ...slot, enabled: true, config: { ...oldReset.slots[1].config, source: "menu_id", menuId: null } } : slot) } },
]) {
  const proof = owner.evaluateFooterReadiness(bad);
  check("Malformed structure and invalid active config fail closed", !proof.systemValid && !proof.publicationReady);
}

function setRows(content: typeof fresh) {
  rows = [
    { key: "footer.slots", value: content.slots },
    { key: "footer.contact_items", value: content.contactItems },
    { key: "footer.social_links", value: content.socialLinks },
    { key: "footer.legal", value: content.legal },
  ];
}
setRows(fresh);
const adminFresh = await loader.loadFooterSettingsForAdmin();
assert.deepEqual(adminFresh.slots, fresh.slots);
check("Actual Admin reader preserves fresh slots for editing", adminFresh.sourceStatus === "database"
  && adminFresh.readiness?.systemValid && !adminFresh.readiness.publicationReady);
const publicFresh = await loader.loadFooterSettings();
assert.deepEqual(publicFresh.slots.slots, []);
assert.deepEqual(publicFresh.contactItems, []);
assert.deepEqual(publicFresh.socialLinks, []);
assert.deepEqual(publicFresh.legal, fresh.legal);
check("Actual public reader publishes no incomplete Footer content", publicFresh.readiness?.systemValid
  && !publicFresh.readiness.publicationReady && resolvedLinks === 0);
setRows(complete);
const publicComplete = await loader.loadFooterSettings();
assert.deepEqual(publicComplete.slots, complete.slots);
assert.deepEqual(publicComplete.contactItems, [{ label: "QA contact", value: "123", icon: undefined, href: undefined, visible: undefined }]);
check("Configured public read retains content and canonical link resolution", publicComplete.readiness?.publicationReady && resolvedLinks === 1);
rows = [];
const missing = await loader.loadFooterSettingsForAdmin();
check("Missing database rows never generate or persist a preset", missing.sourceStatus === "missing" && missing.slots.slots.length === 0);
setRows(fresh);
rows[0].value = { version: 1, slots: [] };
const invalid = await loader.loadFooterSettingsForAdmin();
check("Invalid database data remains invalid, not fresh", invalid.sourceStatus === "invalid" && !invalid.readiness?.systemValid);
readError = true;
const unavailable = await loader.loadFooterSettings();
check("Read failure is preserved without a default fallback", unavailable.sourceStatus === "error" && unavailable.slots.slots.length === 0);

const forged = owner.projectFooterSettingsForPublic({ ...fresh, sourceStatus: "database", sourceIssues: [],
  readiness: { systemValid: true, publicationReady: true, issues: [] } } satisfies FooterSettings);
check("Publication readiness is recomputed rather than trusted as stored truth", !forged.readiness?.publicationReady && forged.slots.slots.length === 0);
const saveSource = readFileSync(path.join(root, "src/app/admin/pages-blocks/footer/footer-actions/save.ts"), "utf8");
const restoreSource = readFileSync(path.join(root, "src/app/admin/pages-blocks/footer/footer-actions/restore-default.ts"), "utf8");
check("Save still enforces existing business requirements", saveSource.includes("usesGlobalContactPool(validatedSlots)")
  && saveSource.includes("!socialLinks.length") && saveSource.includes("saveFooterSettingsWithAudit"));
check("Explicit Reset still uses only the existing reset payload and persistence owner", restoreSource.includes("structuredClone(DEFAULT_FOOTER_SLOTS)")
  && restoreSource.includes("saveFooterSettingsWithAudit") && !restoreSource.includes("createFreshFooterSettings"));
console.log(`PASS Footer fresh readiness: ${controls} controls; ${reads} mocked reads; zero database/environment access.`);
