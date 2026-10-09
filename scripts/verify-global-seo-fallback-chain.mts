import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\r\n?/gu, "\n");
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

// Missing authored images must remain absent across the shared metadata owners.
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
const { buildOpenGraph } = await jiti.import<typeof import("../src/lib/seo/build-open-graph")>("../src/lib/seo/build-open-graph.ts");
const { absoluteAssetUrl } = await jiti.import<typeof import("../src/lib/seo/seo-utils")>("../src/lib/seo/seo-utils.ts");
const { buildArticleSchema } = await jiti.import<typeof import("../src/lib/seo/build-jsonld")>("../src/lib/seo/build-jsonld.ts");
const { buildMetadataFromResolved } = await jiti.import<typeof import("../src/lib/seo/build-metadata-from-resolved")>("../src/lib/seo/build-metadata-from-resolved.ts");
const identity = { path: "/example", title: "Example", description: "Description", metadataBase: "https://example.test" };
assert.equal(absoluteAssetUrl("", identity.metadataBase), "");
assert.deepEqual(buildOpenGraph(identity).images, []);
const managedImage = "https://example.supabase.co/storage/v1/object/public/cms-images/example.png";
assert.equal(buildOpenGraph({ ...identity, image: managedImage }).images[0].url, managedImage);
const article = buildArticleSchema({ ...identity, image: "" });
assert.equal(Object.hasOwn(article, "image"), false);
const metadata = buildMetadataFromResolved({ ...identity, canonical: "https://example.test/example", siteName: "Example", image: "", twitterImage: "", imageAlt: "Example", type: "website", robots: { index: true, follow: true } } as Parameters<typeof buildMetadataFromResolved>[0]);
assert.deepEqual(metadata.openGraph?.images, []);
assert.deepEqual(metadata.twitter?.images, []);
console.log("PASS absent image metadata remains absent; explicitly authored managed images remain intact.");

// Every configurable field has the same real DB -> Environment -> safety contract.
const { resolveGlobalSeoEffectiveContract } = await jiti.import<typeof import("../src/lib/seo/resolve-global-seo-effective")>("../src/lib/seo/resolve-global-seo-effective.ts");
const { GLOBAL_SEO_FIELD_KEYS } = await jiti.import<typeof import("../src/lib/seo/global-seo-types")>("../src/lib/seo/global-seo-types.ts");
const { GLOBAL_SEO_ENVIRONMENT_KEYS } = await jiti.import<typeof import("../src/lib/seo/global-seo-environment")>("../src/lib/seo/global-seo-environment.ts");
const { SEO_ROUTES } = await jiti.import<typeof import("../src/config/seo/seo-routes")>("../src/config/seo/seo-routes.ts");
const { getGlobalSeoDefaults } = await jiti.import<typeof import("../src/lib/seo/global-seo-defaults")>("../src/lib/seo/global-seo-defaults.ts");
const envKeys = [...new Set(Object.values(GLOBAL_SEO_ENVIRONMENT_KEYS).flatMap(value => value.split(" | ")))];
const savedEnvironment = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
try {
  for (const key of envKeys) delete process.env[key];
  for (const key of GLOBAL_SEO_FIELD_KEYS) {
    const sample = key === "defaultRobotsIndex" || key === "defaultRobotsFollow" ? false
      : key === "organizationSocialLinks" ? [{ label: "Managed", href: "https://managed.test/social" }]
      : key === "organizationKnowsAbout" ? ["Managed subject"]
      : key === "robotsTxtAllow" || key === "robotsTxtDisallow" ? ["/managed/"]
      : key === "siteUrl" || key === "canonicalBaseUrl" ? "https://managed.test"
      : key === "organizationEmail" ? "managed@example.test"
      : ["defaultOgImage", "defaultTwitterImage", "organizationLogo"].includes(key) ? "https://managed.test/image.png"
      : "Managed value";
    const envKey = GLOBAL_SEO_ENVIRONMENT_KEYS[key].split(" | ")[0];
    process.env[envKey] = Array.isArray(sample) ? key === "organizationSocialLinks" ? JSON.stringify(sample) : sample.join("\n") : String(sample);
    const environmental = resolveGlobalSeoEffectiveContract({ databaseStatus: "missing" });
    assert.equal(environmental.fields[key].source, "environment", key);
    assert.deepEqual(environmental.settings[key], sample, key);
    const database = resolveGlobalSeoEffectiveContract({ databaseStatus: "loaded", databaseValue: { [key]: sample } });
    assert.equal(database.fields[key].source, "database", key);
    assert.deepEqual(database.settings[key], sample, key);
    delete process.env[envKey];
    assert.equal(resolveGlobalSeoEffectiveContract({ databaseStatus: "missing" }).fields[key].source, "code_fallback", key);
  }
  process.env.NEXT_PUBLIC_SITE_URL = "not a URL";
  const invalidOrigin = resolveGlobalSeoEffectiveContract({ databaseStatus: "missing" });
  assert.equal(invalidOrigin.fields.siteUrl.source, "code_fallback");
  assert.equal(invalidOrigin.settings.siteUrl, "http://localhost:3000");
  delete process.env.NEXT_PUBLIC_SITE_URL;
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "production-origin.test";
  const deploymentOrigin = resolveGlobalSeoEffectiveContract({ databaseStatus: "missing" });
  assert.equal(deploymentOrigin.settings.canonicalBaseUrl, "https://production-origin.test");
  assert.equal(deploymentOrigin.fields.canonicalBaseUrl.source, "environment");
} finally {
  for (const [key, value] of Object.entries(savedEnvironment)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
const safety = getGlobalSeoDefaults();
assert.equal(safety.defaultTitle, "الموقع");
for (const key of ["defaultDescription", "organizationAlternateName", "organizationLegalName", "organizationTagline", "organizationDescription", "organizationPhone", "organizationEmail", "organizationAddress", "organizationAddressLocality", "organizationAddressRegion", "organizationAddressCountry", "organizationAreaServed", "twitterHandle"] as const) assert.equal(safety[key], "", key + " cannot invent manageable business copy");
assert.deepEqual(safety.organizationKnowsAbout, []);
for (const route of SEO_ROUTES) assert.ok(Object.keys(route).every(key => ["path", "kind", "priority", "changeFrequency"].includes(key)), "Registry cannot own managed SEO fields");
assert.equal(read("src/config/pwa.ts").includes('shortName: "Venesia"'), false);
assert.ok(read("src/app/manifest.ts").includes("resolveGlobalOrganizationIdentity(await loadResolvedGlobalSeo())"));
console.log("PASS all managed SEO fields resolve DB -> Environment -> technical safety; route registry owns no business values and installation metadata adopts Global SEO.");
