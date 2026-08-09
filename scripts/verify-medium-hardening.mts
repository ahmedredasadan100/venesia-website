import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { demoteArticleHeadingHierarchy } from "../src/lib/rich-text/article-heading-semantics.ts";
import { sanitizeLogContext } from "../src/lib/logging/sanitize-context.ts";
import { resolveSitemapRouteOutput } from "../src/lib/seo/sitemap-output-contract.ts";
import type { SitemapGenerationResult } from "../src/lib/seo/sitemap-monitor-types.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const partialSitemap: SitemapGenerationResult = {
  entries: [
    {
      url: "https://www.venesia-developments.net/",
      path: "/",
      source: "static_pages",
      priority: 1,
    },
  ],
  generationMode: "runtime",
  generatedAt: "2026-08-09T00:00:00.000Z",
  error: "projects: unavailable",
  sourceErrors: [{ source: "projects", message: "unavailable" }],
  duplicateUrls: [],
};
assert.deepEqual(resolveSitemapRouteOutput(partialSitemap), [
  {
    url: "https://www.venesia-developments.net/",
    lastModified: undefined,
    changeFrequency: "monthly",
    priority: 1,
  },
]);

const demoted = demoteArticleHeadingHierarchy(
  "<h1>Title</h1><h2>Section</h2><h3>Detail</h3>",
);
assert.equal(
  demoted,
  '<h2 data-article-heading-level="1">Title</h2><h3 data-article-heading-level="2">Section</h3><h4 data-article-heading-level="3">Detail</h4>',
);
assert.doesNotMatch(demoted, /<h1>/u);

const circular: Record<string, unknown> = { route: "/topics", token: "secret" };
circular.self = circular;
assert.deepEqual(sanitizeLogContext({
  route: "/topics",
  password: "secret",
  databaseFailure: "connect postgresql://user:pass@database.example/app failed",
  authorizationFailure: "Bearer secret-token",
  nested: { email: "person@example.test", ok: true },
  circular,
}), {
  route: "/topics",
  password: "[REDACTED]",
  databaseFailure: "connect [REDACTED] failed",
  authorizationFailure: "[REDACTED]",
  nested: { email: "[REDACTED]", ok: true },
  circular: { route: "/topics", token: "[REDACTED]", self: "[CIRCULAR]" },
});

const packageSource = readFileSync(resolve(ROOT, "package.json"), "utf8");
const workflowSource = readFileSync(resolve(ROOT, ".github/workflows/quality-gate.yml"), "utf8");
const sitemapRouteSource = readFileSync(resolve(ROOT, "src/app/sitemap.ts"), "utf8");
const instrumentationSource = readFileSync(resolve(ROOT, "src/instrumentation.ts"), "utf8");
const adminErrorBoundarySource = readFileSync(resolve(ROOT, "src/app/admin/error.tsx"), "utf8");
assert.match(packageSource, /"test:e2e:public"/u);
assert.match(packageSource, /npm run test:e2e:public/u);
assert.match(workflowSource, /playwright install --with-deps chromium/u);
assert.match(sitemapRouteSource, /resolveSitemapRouteOutput\(result\)/u);
assert.doesNotMatch(sitemapRouteSource, /throw new Error/u);
assert.match(instrumentationSource, /Instrumentation\.onRequestError/u);
assert.match(instrumentationSource, /logError\("Unhandled server request failed"/u);
assert.doesNotMatch(adminErrorBoundarySource, /description=\{error\.message/u);

console.log("verify-medium-hardening: behavioral contracts and infrastructure passed");
