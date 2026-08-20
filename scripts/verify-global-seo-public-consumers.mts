import assert from "node:assert/strict";

import {
  GLOBAL_SEO_CONSUMER_ADOPTION,
  GLOBAL_SEO_PUBLIC_CONSUMERS,
} from "../src/lib/admin/seo/global-seo-adoption-manifest.ts";
import { PUBLIC_PAGE_ROUTE_REGISTRY } from "../src/lib/admin/links/static-routes.ts";

assert.equal(GLOBAL_SEO_CONSUMER_ADOPTION.globalClosed, true);
assert.deepEqual(
  GLOBAL_SEO_PUBLIC_CONSUMERS.map((consumer) => consumer.route).sort(),
  PUBLIC_PAGE_ROUTE_REGISTRY.filter((route) => route.href !== "/maintenance")
    .map((route) => route.href)
    .sort(),
  "Global SEO consumers must equal the executable Public route inventory.",
);
assert.equal(
  new Set(
    GLOBAL_SEO_PUBLIC_CONSUMERS.map((consumer) => consumer.sourceFile),
  ).size,
  GLOBAL_SEO_PUBLIC_CONSUMERS.length,
  "Every Global SEO route must bind one explicit source.",
);

console.log(
  `PASS Global SEO public consumers: ${GLOBAL_SEO_PUBLIC_CONSUMERS.length} deterministic route/source registrations.`,
);
