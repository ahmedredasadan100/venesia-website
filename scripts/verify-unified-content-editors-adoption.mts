import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CONTENT_EDITOR_ADOPTION_MANIFEST,
  CONTENT_EDITOR_ARCHITECTURE,
  CONTENT_EDITOR_EXECUTABLE_BINDINGS,
  CONTENT_EDITOR_EXECUTABLE_CONSUMERS,
} from "../src/lib/admin/content/content-editor-adoption-manifest.ts";
import {
  CONTENT_EDITOR_ADAPTERS,
  CONTENT_TYPES,
} from "../src/lib/admin/content/content-types.ts";
import { GLOBAL_SEO_PUBLIC_CONSUMERS } from "../src/lib/admin/seo/global-seo-adoption-manifest.ts";
import { PUBLIC_PAGE_ROUTE_REGISTRY } from "../src/lib/admin/links/static-routes.ts";
import {
  collectExecutableSourceGraph,
  graphUsesExecutableBinding,
} from "./lib/typescript-executable-graph.mts";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PUBLIC_CONTENT_BINDING = [
  {
    sourceFile: "src/lib/content/public-content-read/owner.ts",
    exportNames: ["loadPublicContentDetail"],
  },
] as const;

assert.deepEqual(
  CONTENT_EDITOR_ADOPTION_MANIFEST.map((entry) => entry.contentType),
  CONTENT_TYPES,
  "Content editor manifest must cover the executable content-type registry exactly once.",
);
assert.equal(
  new Set(CONTENT_EDITOR_ADOPTION_MANIFEST.map((entry) => entry.contentType))
    .size,
  CONTENT_EDITOR_ADOPTION_MANIFEST.length,
  "Content editor registrations must be unique.",
);
assert.equal(CONTENT_EDITOR_ARCHITECTURE.globalClosed, true);
assert.deepEqual(CONTENT_EDITOR_ARCHITECTURE.globalClosureBlockers, []);
assert.ok(
  CONTENT_EDITOR_ADOPTION_MANIFEST.every(
    (entry) => entry.currentContract === "topics_aggregate",
  ),
  "Every content type must retain the canonical Topics aggregate.",
);
assert.equal(CONTENT_EDITOR_ADAPTERS.article.supportsFaq, true);
assert.equal(CONTENT_EDITOR_ADAPTERS.video.body, "video");
assert.equal(CONTENT_EDITOR_ADAPTERS.gallery.body, "gallery");

assert.equal(
  new Set(CONTENT_EDITOR_EXECUTABLE_CONSUMERS.map((consumer) => consumer.id))
    .size,
  CONTENT_EDITOR_EXECUTABLE_CONSUMERS.length,
  "Executable editor consumer IDs must be unique.",
);
for (const consumer of CONTENT_EDITOR_EXECUTABLE_CONSUMERS) {
  assert.ok(
    existsSync(join(ROOT, consumer.sourceFile)),
    `${consumer.id} registers missing source ${consumer.sourceFile}.`,
  );
  const graph = collectExecutableSourceGraph({
    root: ROOT,
    entrySourceFiles: [consumer.sourceFile],
  });
  for (const binding of CONTENT_EDITOR_EXECUTABLE_BINDINGS) {
    assert.ok(
      graphUsesExecutableBinding({
        root: ROOT,
        graph,
        bindings: [binding],
      }),
      `${consumer.id} cannot reach ${binding.sourceFile}:${binding.exportNames.join(",")}.`,
    );
  }
}

const registeredPublicRoutes = new Set(
  PUBLIC_PAGE_ROUTE_REGISTRY.map((route) => route.href),
);
const globalSeoSourcesByRoute = new Map(
  GLOBAL_SEO_PUBLIC_CONSUMERS.map((consumer) => [
    consumer.route,
    consumer.sourceFile,
  ]),
);
for (const adoption of CONTENT_EDITOR_ADOPTION_MANIFEST) {
  assert.ok(
    registeredPublicRoutes.has(adoption.publicConsumer),
    `${adoption.contentType} registers an unreachable Public route.`,
  );
  const sourceFile = globalSeoSourcesByRoute.get(adoption.publicConsumer);
  assert.ok(
    sourceFile,
    `${adoption.contentType} Public route has no deterministic source registration.`,
  );
  const graph = collectExecutableSourceGraph({
    root: ROOT,
    entrySourceFiles: [sourceFile],
  });
  assert.ok(
    graphUsesExecutableBinding({
      root: ROOT,
      graph,
      bindings: PUBLIC_CONTENT_BINDING,
    }),
    `${adoption.contentType} Public consumer cannot reach the canonical Public Content owner.`,
  );
}

for (const sourceFile of [
  CONTENT_EDITOR_ARCHITECTURE.shellOwner,
  CONTENT_EDITOR_ARCHITECTURE.tabsOwner,
  CONTENT_EDITOR_ARCHITECTURE.formRuntimeOwner,
  CONTENT_EDITOR_ARCHITECTURE.saveOwner,
  CONTENT_EDITOR_ARCHITECTURE.basicDataOwner,
  CONTENT_EDITOR_ARCHITECTURE.reviewOwner,
  CONTENT_EDITOR_ARCHITECTURE.publishingOwner,
  CONTENT_EDITOR_ARCHITECTURE.displaySettingsOwner,
  CONTENT_EDITOR_ARCHITECTURE.seoOwner,
  ...CONTENT_EDITOR_ARCHITECTURE.persistenceAdapters,
  ...CONTENT_EDITOR_EXECUTABLE_BINDINGS.map((binding) => binding.sourceFile),
]) {
  assert.ok(existsSync(join(ROOT, sourceFile)), `Missing Content owner ${sourceFile}.`);
}

console.log(
  `PASS executable Content Editor adoption: ${CONTENT_EDITOR_EXECUTABLE_CONSUMERS.length} Admin editor consumers and ${CONTENT_EDITOR_ADOPTION_MANIFEST.length} Public content types.`,
);
