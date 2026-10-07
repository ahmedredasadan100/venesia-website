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
