import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const identity = read("src/lib/seo/resolve-global-organization-identity.ts");
const schema = read("src/lib/seo/build-jsonld.ts");
const layout = read("src/app/(site)/layout.tsx");

for (const field of ["displayName", "arabicName", "legalName", "description", "phone", "email", "addressLocality", "addressCountry", "areaServed", "knowsAbout", "logo", "socialLinks"]) {
  assert.ok(identity.includes(`${field}:`), `organization identity missing ${field}`);
}
assert.ok(schema.includes('`${baseUrl.replace(/\\/$/, "")}#organization`'));
assert.ok(schema.includes('"@type": "RealEstateAgent"'));
assert.ok(schema.includes('"@type": "PostalAddress"'));
assert.ok(schema.includes("publisher:") && schema.includes('"@id": organizationId'));
assert.ok(layout.includes("resolveGlobalOrganizationIdentity") && layout.includes("buildOrganizationSchema(globalSeo)") && layout.includes("buildWebsiteSchema(globalSeo)"));
assert.equal(layout.includes("buildAiOrganizationSchema"), false);
for (const path of ["src/config/seo/schema-data.ts", "src/config/seo/ai-visibility.ts", "src/lib/seo/build-ai-visibility.ts"]) {
  assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), false, `legacy organization owner remains: ${path}`);
}

console.log("PASS Global SEO organization: one effective identity feeds structured organization and publisher; legacy parallel owners are absent.");
