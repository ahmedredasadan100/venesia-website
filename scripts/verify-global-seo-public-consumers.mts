import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { GLOBAL_SEO_PUBLIC_CONSUMERS } from "../src/lib/admin/seo/global-seo-adoption-manifest.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
for (const path of GLOBAL_SEO_PUBLIC_CONSUMERS) {
  const source = read(path);
  assert.equal(source.includes("buildMetadata("), false, `${path} uses removed legacy metadata builder`);
  assert.ok(source.includes("generateMetadata"), `${path} must expose public metadata`);
}
assert.ok(read("src/app/(site)/track-your-project/[slug]/page.tsx").includes("generatePublicMetadata"));
assert.ok(read("src/components/home/HomeContactSection.tsx").includes("usePublicBrand"));
assert.equal(read("src/components/FooterSocialBar.tsx").includes("usePublicBrand"), false);
assert.equal(read("src/lib/footer/resolve-footer-composition.ts").includes("PublicBrand"), false);
assert.ok(read("src/app/(site)/layout.tsx").includes("resolveFooterComposition(footerSettings"));
assert.ok(read("src/lib/seo/resolve-seo-metadata.ts").includes("[global.organizationName]"));
assert.equal(read("src/lib/seo/resolve-seo-metadata.ts").includes('authors: ["Venesia Developments"]'), false);

console.log(`PASS Global SEO public consumers: ${GLOBAL_SEO_PUBLIC_CONSUMERS.length} metadata routes, bounded Home Contact identity consumption, and an independent canonical Footer contract.`);
