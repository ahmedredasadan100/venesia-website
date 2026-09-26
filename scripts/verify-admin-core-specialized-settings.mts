import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createJiti } from "jiti";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false, alias: { "server-only": resolve(root, "node_modules/next/dist/compiled/server-only/empty.js") } });
const { buildCoreSpecializedSettingsPlan, fillCorePrivateField } = await import("./fixtures/admin-core-specialized-settings-journeys.mjs");
const { validateCoreSpecializedSettingsRequest } = await jiti.import<typeof import("./verify-admin-core-specialized-settings-isolated.mts")>(resolve(root, "scripts/verify-admin-core-specialized-settings-isolated.mts"));
const { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST } = await jiti.import<typeof import("../src/lib/admin/form-system/adoption-manifest.ts")>(resolve(root, "src/lib/admin/form-system/adoption-manifest.ts"));
const { INTEGRATION_APP_CONFIGURATION_DEFINITIONS, INTEGRATION_APP_CONFIGURATION_SURFACES } = await jiti.import<typeof import("../src/lib/admin/integrations/server-configuration-contract.ts")>(resolve(root, "src/lib/admin/integrations/server-configuration-contract.ts"));
const args = { manifest: ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST, definitions: INTEGRATION_APP_CONFIGURATION_DEFINITIONS, surfaces: INTEGRATION_APP_CONFIGURATION_SURFACES,
  fixtures: { securityActor: { id: 27, username: "qa_core_security_settings" }, providers: INTEGRATION_APP_CONFIGURATION_DEFINITIONS.map(row => row.key) } };
const cases: string[] = [];
const test = async (name: string, execute: () => unknown | Promise<unknown>) => { await execute(); cases.push(name); };
await test("Plan derives the three canonical specialized exceptions and all provider owners", () => {
  const plan = buildCoreSpecializedSettingsPlan(args);
  assert.equal(plan.consumers.length, 3); assert.equal(plan.providers.length, INTEGRATION_APP_CONFIGURATION_DEFINITIONS.length);
  assert.equal(plan.globalClosed, false); assert.deepEqual(plan.automaticCoverage, []);
  assert.equal(plan.remaining.length, 1); assert.match(plan.remaining[0].reason, /unexecuted/u);
});
await test("Unknown manifest family cannot silently pass", () => assert.throws(() => buildCoreSpecializedSettingsPlan({ ...args, manifest: args.manifest.filter(row => row.id !== "security-settings") })));
await test("Duplicate consumer identity rejects", () => assert.throws(() => buildCoreSpecializedSettingsPlan({ ...args, manifest: [...args.manifest, args.manifest.find(row => row.id === "security-settings")] })));
await test("Generic classification is not promoted through specialized proof", () => assert.throws(() => buildCoreSpecializedSettingsPlan({ ...args, manifest: args.manifest.map(row => row.id === "security-settings" ? { ...row, classification: "shared" } : row) })));
await test("New unreviewed security surface rejects", () => assert.throws(() => buildCoreSpecializedSettingsPlan({ ...args, manifest: args.manifest.map(row => row.id === "security-settings" ? { ...row, surfaces: [...row.surfaces, "policy-editor"] } : row) })));
await test("Fixture provider omissions reject", () => assert.throws(() => buildCoreSpecializedSettingsPlan({ ...args, fixtures: { ...args.fixtures, providers: [] } })));
await test("Provider with an integration that needs no absent secret rejects before Test", () => assert.throws(() => buildCoreSpecializedSettingsPlan({ ...args, definitions: args.definitions.map((row, index) => index === 0 ? { ...row, integrations: [...row.integrations, "unfenced-provider"] } : row) })));
await test("New independent configuration surface rejects instead of duplicating Meta", () => assert.throws(() => buildCoreSpecializedSettingsPlan({ ...args, surfaces: [...args.surfaces, "unreviewed"] })));
await test("Wrong disposable account identity rejects", () => assert.throws(() => buildCoreSpecializedSettingsPlan({ ...args, fixtures: { ...args.fixtures, securityActor: { id: 27, username: "primary-admin" } } })));
await test("Private fill passes the value only to its memory-local receiver", async () => {
  let observed = false; await fillCorePrivateField({ fill: async (value: string) => { observed = value === "synthetic-private-control"; } }, "synthetic-private-control"); assert.equal(observed, true);
});
await test("Private fill rejects without exposing Playwright's value-bearing diagnostic", async () => {
  await assert.rejects(fillCorePrivateField({ fill: async () => { throw new Error("fill synthetic-private-control timed out"); } }, "synthetic-private-control"), (error: unknown) => error instanceof Error && !error.message.includes("synthetic-private-control") && !error.stack?.includes("synthetic-private-control") && !error.cause);
});
const security = { id: randomUUID(), kind: "specialized-settings-state", entity: "security", phase: "baseline" };
await test("Fixed security checkpoint accepts no browser expectation or selector", () => assert.deepEqual(validateCoreSpecializedSettingsRequest(security), security));
await test("Maintenance checkpoint exact contract accepted", () => validateCoreSpecializedSettingsRequest({ ...security, entity: "maintenance", phase: "restored" }));
await test("Canonical provider checkpoint exact contract accepted", () => validateCoreSpecializedSettingsRequest({ ...security, entity: "integration", phase: "stale-rejected", provider: args.definitions[0].key }));
for (const [name, changed] of [
  ["Unknown checkpoint kind", { kind: "run-sql" }], ["Unknown entity", { entity: "production" }], ["Malformed UUID", { id: "------------------------------------" }],
  ["Arbitrary SQL", { sql: "select private_value" }], ["Arbitrary IDs", { actorId: 1 }], ["Browser expected secret", { expected: "private" }],
  ["Provider on security", { provider: "google" }], ["Unknown phase", { phase: "force-success" }],
] as const) await test(name + " rejects", () => assert.throws(() => validateCoreSpecializedSettingsRequest({ ...security, ...changed })));
await test("Unknown integration provider rejects", () => assert.throws(() => validateCoreSpecializedSettingsRequest({ ...security, entity: "integration", provider: "unreviewed" })));
await test("Missing integration provider rejects", () => assert.throws(() => validateCoreSpecializedSettingsRequest({ ...security, entity: "integration" })));
await test("Security cancellation requires a distinct fixed readback", () => validateCoreSpecializedSettingsRequest({ ...security, phase: "sessions-cancelled" }));
const browser = readFileSync(resolve(root, "scripts/fixtures/admin-core-specialized-settings-journeys.mjs"), "utf8");
const native = readFileSync(resolve(root, "scripts/verify-admin-core-specialized-settings-isolated.mts"), "utf8");
await test("No generic coverage, environment import, manual fetch, retained-cookie artifact or provider wizard", () => {
  assert.equal(browser.includes("process.env"), false); assert.equal(/\.request\.|fetch\(|writeFile|import_environment|Connection Wizard/u.test(browser), false);
  assert.equal(browser.includes("automaticCoverage: []"), true); assert.equal(browser.includes('context.route("**/*", ownedNetworkOnly)'), true);
});
await test("Test control follows native incomplete proof and precedes secret save", () => {
  const proof = browser.indexOf('checkpoint("integration", "incomplete", provider)');
  const testCall = browser.indexOf('mutate(page, "test"'); const secretSave = browser.indexOf('integration:${provider}:${field.key}:a');
  assert.ok(proof >= 0 && testCall > proof && secretSave > testCall);
  const resolver = readFileSync(resolve(root, "src/lib/admin/integrations/server-configuration-resolver.ts"), "utf8");
  const service = readFileSync(resolve(root, "src/lib/admin/integrations/server-configuration-service.ts"), "utf8");
  assert.ok(resolver.indexOf("if (group)") < resolver.indexOf("const values: Partial", resolver.indexOf("if (group)")));
  assert.match(service, /if \(before\.missing\.length\)[\s\S]*?continue;[\s\S]*?claimApplicationConfigurationTest/u);
});
await test("Native verifier exports fixed booleans, compares secrets in SQL and protects primary hash diagnostics", () => {
  assert.match(native, /decrypted_secret=\$2\) matches/u); assert.match(native, /isDeepStrictEqual\(main, state\.mainBefore\)/u);
  assert.equal(/return[^\n]*(?:password_hash|vault_secret_id|state\.password|decrypted_secret)/u.test(native), false);
  assert.match(native, /Never replace an existing security actor/u); assert.match(native, /integration_connections/u);
});
await test("Maintenance proof respects the existing explicit five-second proxy policy", () => {
  const owner = readFileSync(resolve(root, "src/lib/maintenance/read-maintenance-mode.ts"), "utf8");
  assert.match(owner, /const CACHE_TTL_MS = 5_000;/u); assert.match(browser, /specialized-maintenance-policy-ttl/u);
  assert.match(native, /parseMaintenanceModeValue\(row\?\.value\)/u);
});
await test("Disposable login uses the actual existing form submit label", () => {
  const login = readFileSync(resolve(root, "src/app/admin/(auth)/login/AdminLoginForm.tsx"), "utf8");
  assert.ok(login.includes("دخول لوحة التحكم")); assert.ok(browser.includes('name: "دخول لوحة التحكم", exact: true'));
});
console.log(JSON.stringify({ status: "pass", boundary: "Offline plan/negative/privacy controls only; native and Browser behavior remain pending.", cases: cases.length, evidence: cases }, null, 2));
