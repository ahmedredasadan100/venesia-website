import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  GLOBAL_SEO_CONSUMER_ADOPTION,
  GLOBAL_SEO_PUBLIC_CONSUMERS,
  GLOBAL_SEO_SPECIALIZED_OWNERS,
} from "../src/lib/admin/seo/global-seo-adoption-manifest.ts";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

assert.equal(GLOBAL_SEO_PUBLIC_CONSUMERS.length, 21, "public metadata inventory must stay complete");
assert.equal(GLOBAL_SEO_CONSUMER_ADOPTION.expectedPublicConsumerCount, 21);
assert.equal(GLOBAL_SEO_CONSUMER_ADOPTION.entitySeoDependency.mode, "reuse_only");
assert.equal(GLOBAL_SEO_CONSUMER_ADOPTION.entityReviewDependency, "none");
assert.equal(GLOBAL_SEO_CONSUMER_ADOPTION.parallelRuntime, false);
assert.equal(GLOBAL_SEO_CONSUMER_ADOPTION.parallelCapability, false);
assert.equal(GLOBAL_SEO_CONSUMER_ADOPTION.parallelSourceOfTruth, false);
assert.deepEqual(GLOBAL_SEO_SPECIALIZED_OWNERS.map((owner) => owner.id), ["sitemap", "robots", "redirects"]);

for (const path of GLOBAL_SEO_PUBLIC_CONSUMERS) {
  assert.ok(existsSync(new URL(path, root)), `missing registered public consumer: ${path}`);
  assert.ok(!read(path).includes("buildMetadata("), `legacy metadata owner used by ${path}`);
}

console.log(`PASS Global SEO adoption: ${GLOBAL_SEO_PUBLIC_CONSUMERS.length} public consumers, bounded Entity dependency, three specialized owners.`);
