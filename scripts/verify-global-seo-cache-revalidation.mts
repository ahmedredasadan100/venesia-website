import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const cache = read("src/lib/cache/revalidate-public-cache-tags.ts");
const settingsAction = read("src/app/admin/seo/meta-manager/actions.ts");
const topicRevalidation = read("src/app/admin/content/topics/editor-actions/revalidate.ts");
const redirects = read("src/lib/redirects/load-active-redirects.ts");

for (const tag of ["seo-global", "site-settings", "page-seo", "projects", "topics", "media-center"]) {
  assert.ok(cache.includes(`"${tag}"`), `missing SEO invalidation tag ${tag}`);
}
for (const path of ["/", "/robots.txt", "/sitemap.xml", "/admin/seo/meta-manager", "/admin/seo/sitemap"]) {
  assert.ok(cache.includes(`"${path}"`), `missing SEO revalidation path ${path}`);
}
assert.ok(settingsAction.includes("revalidateGlobalSeoCaches()"));
assert.ok(topicRevalidation.includes("revalidateTopicsCache()"));
assert.equal(redirects.includes("let cache"), false, "redirect runtime must not own process-global cache state");
assert.ok(redirects.includes('cache: "no-store"'));

console.log("PASS Global SEO cache/revalidation: shared tags and route invalidation cover metadata, robots, sitemap and public content without process-global redirect state.");
