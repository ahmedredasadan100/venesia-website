import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as ts from "typescript";

import {
  GLOBAL_SEO_CONSUMER_ADOPTION,
  GLOBAL_SEO_EXISTING_OWNERS,
  GLOBAL_SEO_PUBLIC_CONSUMERS,
  GLOBAL_SEO_SPECIALIZED_OWNERS,
} from "../src/lib/admin/seo/global-seo-adoption-manifest.ts";
import { PUBLIC_PAGE_ROUTE_REGISTRY } from "../src/lib/admin/links/static-routes.ts";
import {
  collectExecutableSourceGraph,
  graphHasCall,
  graphUsesExecutableBinding,
} from "./lib/typescript-executable-graph.mts";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const METADATA_BINDING = [
  {
    sourceFile: "src/lib/seo/resolve-seo-metadata.ts",
    exportNames: ["resolveSeoMetadata"],
  },
] as const;

function exportsGenerateMetadata(
  graph: ReturnType<typeof collectExecutableSourceGraph>,
  sourceFile: string,
) {
  const parsed = graph.get(sourceFile);
  assert.ok(parsed, `${sourceFile} is missing from its executable graph.`);
  return parsed.statements.some((statement) => {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === "generateMetadata"
    ) {
      return statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      );
    }
    if (
      ts.isVariableStatement(statement) &&
      statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      )
    ) {
      return statement.declarationList.declarations.some(
        (declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === "generateMetadata",
      );
    }
    return false;
  });
}

assert.equal(
  GLOBAL_SEO_CONSUMER_ADOPTION.globalClosed,
  true,
  "Global SEO adoption must fail closed.",
);
assert.equal(
  new Set(GLOBAL_SEO_PUBLIC_CONSUMERS.map((consumer) => consumer.route)).size,
  GLOBAL_SEO_PUBLIC_CONSUMERS.length,
  "Global SEO route registrations must be unique.",
);
assert.equal(
  new Set(
    GLOBAL_SEO_PUBLIC_CONSUMERS.map((consumer) => consumer.sourceFile),
  ).size,
  GLOBAL_SEO_PUBLIC_CONSUMERS.length,
  "Global SEO source registrations must be unique.",
);

const registeredMetadataRoutes = GLOBAL_SEO_PUBLIC_CONSUMERS.map(
  (consumer) => consumer.route,
).sort();
const executablePublicRoutes = PUBLIC_PAGE_ROUTE_REGISTRY.filter(
  (route) => route.href !== "/maintenance",
)
  .map((route) => route.href)
  .sort();
assert.deepEqual(
  registeredMetadataRoutes,
  executablePublicRoutes,
  "Every executable Public route except Maintenance must register Global SEO metadata adoption.",
);

for (const consumer of GLOBAL_SEO_PUBLIC_CONSUMERS) {
  assert.ok(
    existsSync(join(ROOT, consumer.sourceFile)),
    `${consumer.route} registers missing source ${consumer.sourceFile}.`,
  );
  const graph = collectExecutableSourceGraph({
    root: ROOT,
    entrySourceFiles: [consumer.sourceFile],
    symbolAware: true,
  });
  assert.ok(
    exportsGenerateMetadata(graph, consumer.sourceFile),
    `${consumer.route} does not export executable generateMetadata.`,
  );
  assert.ok(
    graphUsesExecutableBinding({
      root: ROOT,
      graph,
      bindings: METADATA_BINDING,
    }),
    `${consumer.route} cannot reach the canonical metadata owner.`,
  );
  assert.equal(
    graphHasCall(graph, ["buildMetadata"]),
    false,
    `${consumer.route} reaches the retired metadata builder.`,
  );
}

assert.deepEqual(
  GLOBAL_SEO_SPECIALIZED_OWNERS.map((owner) => owner.id),
  ["sitemap", "robots", "redirects"],
);
for (const sourceFile of Object.values(GLOBAL_SEO_EXISTING_OWNERS)) {
  assert.ok(
    existsSync(join(ROOT, sourceFile)),
    `Missing Global SEO owner ${sourceFile}.`,
  );
}
assert.equal(GLOBAL_SEO_CONSUMER_ADOPTION.entitySeoDependency.mode, "reuse_only");
assert.equal(GLOBAL_SEO_CONSUMER_ADOPTION.entityReviewDependency, "none");
assert.equal(GLOBAL_SEO_CONSUMER_ADOPTION.parallelRuntime, false);
assert.equal(GLOBAL_SEO_CONSUMER_ADOPTION.parallelCapability, false);
assert.equal(GLOBAL_SEO_CONSUMER_ADOPTION.parallelSourceOfTruth, false);

console.log(
  `PASS executable Global SEO adoption: ${GLOBAL_SEO_PUBLIC_CONSUMERS.length} registered Public consumers and three specialized owners.`,
);
