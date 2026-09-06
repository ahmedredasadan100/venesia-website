import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CONTENT_EDITOR_ADOPTION_MANIFEST,
  CONTENT_EDITOR_ARCHITECTURE,
  CONTENT_EDITOR_BEHAVIOR_PROOF_LEDGER,
  CONTENT_EDITOR_EXECUTABLE_BINDINGS,
  CONTENT_EDITOR_EXECUTABLE_CONSUMERS,
  CONTENT_EDITOR_GLOBAL_CLOSURE,
  CONTENT_EDITOR_SOURCE_BLOCKERS,
  deriveContentEditorClosure,
} from "../src/lib/admin/content/content-editor-adoption-manifest.ts";
import {
  CONTENT_EDITOR_ADAPTERS,
  CONTENT_TYPES,
} from "../src/lib/admin/content/content-types.ts";
import {
  PRODUCT_SURFACE_IDENTITIES,
  type ProductSurfaceIdentity,
} from "../src/lib/admin/interaction-system/adoption-manifest.ts";
import { GLOBAL_SEO_PUBLIC_CONSUMERS } from "../src/lib/admin/seo/global-seo-adoption-manifest.ts";
import { PUBLIC_PAGE_ROUTE_REGISTRY } from "../src/lib/admin/links/static-routes.ts";
import {
  collectExecutableSourceGraph,
  graphUsesExecutableBinding,
  type SourceOverrides,
} from "./lib/typescript-executable-graph.mts";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PUBLIC_CONTENT_BINDING = [
  {
    sourceFile: "src/lib/content/public-content-read/owner.ts",
    exportNames: ["loadPublicContentDetail"],
  },
] as const;

type ContentEditorRouteIdentity = Pick<
  ProductSurfaceIdentity,
  "id" | "route" | "sourceFiles"
>;

type RegisteredContentEditor = {
  id: string;
  sourceFile: string;
};

function canonicalAdminRouteRoots(identity: ContentEditorRouteIdentity) {
  return identity.sourceFiles.filter(
    (sourceFile) =>
      sourceFile.startsWith("src/app/admin/") &&
      ["page.js", "page.jsx", "page.ts", "page.tsx"].some((fileName) =>
        sourceFile.endsWith(`/${fileName}`),
      ),
  );
}

function contentEditorRouteCoverage(input: {
  routeIdentities: readonly ContentEditorRouteIdentity[];
  registeredEditors: readonly RegisteredContentEditor[];
  sourceOverrides?: SourceOverrides;
}) {
  const registeredEditorRoutes = new Map<string, Set<string>>(
    input.registeredEditors.map((editor) => [editor.id, new Set()]),
  );
  const discoveredEditorSourceFiles = new Set<string>();
  const routesWithoutRegisteredEditor: string[] = [];
  const routeBindings = new Map<string, readonly string[]>();

  for (const identity of input.routeIdentities) {
    const routeRoots = canonicalAdminRouteRoots(identity);
    assert.ok(
      identity.route,
      `${identity.id} must retain its canonical Admin editor route.`,
    );
    assert.ok(
      routeRoots.length > 0,
      `${identity.id} must register at least one executable Admin page root.`,
    );
    for (const routeRoot of routeRoots) {
      assert.ok(
        input.sourceOverrides?.has(routeRoot) || existsSync(join(ROOT, routeRoot)),
        `${identity.id} registers missing route root ${routeRoot}.`,
      );
    }

    const graph = collectExecutableSourceGraph({
      root: ROOT,
      entrySourceFiles: routeRoots,
      sourceOverrides: input.sourceOverrides,
      symbolAware: true,
    });
    const reachableEditors = input.registeredEditors.filter((editor) =>
      graphUsesExecutableBinding({
        root: ROOT,
        graph,
        bindings: [{ sourceFile: editor.sourceFile, exportNames: ["default"] }],
        sourceOverrides: input.sourceOverrides,
      }),
    );
    for (const [sourceFile, parsed] of graph) {
      if (
        graphUsesExecutableBinding({
          root: ROOT,
          graph: new Map([[sourceFile, parsed]]),
          bindings: [
            {
              sourceFile: CONTENT_EDITOR_ARCHITECTURE.shellOwner,
              exportNames: ["default"],
            },
          ],
          sourceOverrides: input.sourceOverrides,
        })
      ) {
        discoveredEditorSourceFiles.add(sourceFile);
      }
    }
    routeBindings.set(
      identity.id,
      reachableEditors.map((editor) => editor.id),
    );
    if (reachableEditors.length === 0) {
      routesWithoutRegisteredEditor.push(identity.id);
    }
    for (const editor of reachableEditors) {
      registeredEditorRoutes.get(editor.id)?.add(identity.id);
    }
  }

  return {
    routeBindings,
    routesWithoutRegisteredEditor,
    unregisteredReachableEditorSourceFiles: [...discoveredEditorSourceFiles]
      .filter(
        (sourceFile) =>
          !input.registeredEditors.some(
            (editor) => editor.sourceFile === sourceFile,
          ),
      )
      .sort(),
    registeredEditorsWithoutRoute: input.registeredEditors
      .filter((editor) => registeredEditorRoutes.get(editor.id)?.size === 0)
      .map((editor) => editor.id),
  };
}

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
assert.deepEqual(CONTENT_EDITOR_ARCHITECTURE.proofBoundaries, {
  source: "source_and_executable_reachability",
  behavior: "behavior_verification_ledger",
});
assert.deepEqual(
  {
    globalClosed: CONTENT_EDITOR_ARCHITECTURE.globalClosed,
    globalClosureBlockers:
      CONTENT_EDITOR_ARCHITECTURE.globalClosureBlockers,
  },
  CONTENT_EDITOR_GLOBAL_CLOSURE,
  "Content Editor closure must be derived from the registered source gaps and behavior-proof ledger.",
);
assert.equal(
  CONTENT_EDITOR_ARCHITECTURE.globalClosed,
  CONTENT_EDITOR_ARCHITECTURE.globalClosureBlockers.length === 0,
  "Content Editor global closure must equal the absence of derived blockers.",
);
const globalClosureBlockerIds = new Set(
  CONTENT_EDITOR_ARCHITECTURE.globalClosureBlockers.map(
    (blocker) => blocker.id,
  ),
);
for (const sourceBlocker of CONTENT_EDITOR_SOURCE_BLOCKERS) {
  assert.ok(
    globalClosureBlockerIds.has(sourceBlocker.id),
    `Source-confirmed blocker ${sourceBlocker.id} must keep global closure open.`,
  );
}
assert.ok(
  globalClosureBlockerIds.has("gallery-admin-shared-media-adoption"),
  "Gallery Admin shared-media adoption must remain an explicit closure blocker until it is fixed and verified.",
);
assert.ok(
  globalClosureBlockerIds.has("gallery-public-projection"),
  "Gallery Public projection must remain an explicit closure blocker until it is fixed and verified.",
);
for (const proof of CONTENT_EDITOR_BEHAVIOR_PROOF_LEDGER) {
  const blockerId = `content-editor-behavior:${proof.id}`;
  assert.equal(
    globalClosureBlockerIds.has(blockerId),
    proof.requiredForGlobalClosure && proof.state !== "behavior_verified",
    `${proof.id} closure contribution must be derived from its behavioral proof state.`,
  );
}

const sourceProvenOnlyNegativeFixture = deriveContentEditorClosure({
  sourceBlockers: [],
  behaviorProofs: [
    {
      id: "negative-source-proof-is-not-behavior-proof",
      owner: "negative_fixture",
      state: "source_proven_only",
      requiredForGlobalClosure: true,
      rationale:
        "A passing source or executable graph cannot stand in for behavior verification.",
    },
  ],
});
assert.equal(
  sourceProvenOnlyNegativeFixture.globalClosed,
  false,
  "Negative fixture: source_proven_only must not close the Content Editor globally.",
);
assert.equal(
  sourceProvenOnlyNegativeFixture.globalClosureBlockers[0]?.evidence,
  "source_proven_only",
  "Negative fixture must preserve the evidence boundary on its derived blocker.",
);
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
const canonicalContentEditorRouteIdentities = PRODUCT_SURFACE_IDENTITIES.filter(
  (identity) =>
    identity.scope === "admin_route" &&
    identity.productSurfaceKind === "editor" &&
    identity.workflowOwner === "content_domain",
);
assert.ok(
  canonicalContentEditorRouteIdentities.length > 0,
  "Product Surface Identity must expose the canonical Content Admin editor routes.",
);
const executableRouteCoverage = contentEditorRouteCoverage({
  routeIdentities: canonicalContentEditorRouteIdentities,
  registeredEditors: CONTENT_EDITOR_EXECUTABLE_CONSUMERS,
});
assert.deepEqual(
  executableRouteCoverage.routesWithoutRegisteredEditor,
  [],
  "Every canonical Content Admin editor route must reach a registered executable editor.",
);
assert.deepEqual(
  executableRouteCoverage.registeredEditorsWithoutRoute,
  [],
  "Every registered executable editor must be reachable from a canonical Content Admin editor route.",
);
assert.deepEqual(
  executableRouteCoverage.unregisteredReachableEditorSourceFiles,
  [],
  "Every route-reachable Content Editor shell consumer must be registered.",
);

const unregisteredRouteSource =
  "src/app/admin/content/topics/__unregistered-editor-probe__/page.tsx";
const unregisteredEditorSource =
  "src/components/admin/content/editors/__UnregisteredEditorProbe.tsx";
const unregisteredEditorOverrides: SourceOverrides = new Map([
  [
    unregisteredRouteSource,
    `import ArticleEditor from "../../../../../components/admin/content/editors/ArticleEditor";
import UnregisteredEditor from "../../../../../components/admin/content/editors/__UnregisteredEditorProbe";
export default function UnregisteredEditorRouteProbe() {
  return <><ArticleEditor /><UnregisteredEditor /></>;
}`,
  ],
  [
    unregisteredEditorSource,
    'import ContentEditorShell from "./ContentEditorShell"; export default function UnregisteredEditorProbe() { return <ContentEditorShell>{null}</ContentEditorShell>; }',
  ],
]);
const unregisteredRouteFixture = contentEditorRouteCoverage({
  routeIdentities: [
    {
      id: "negative-unregistered-content-editor-route",
      route: "/admin/content/topics/__unregistered-editor-probe__",
      sourceFiles: [unregisteredRouteSource],
    },
  ],
  registeredEditors: CONTENT_EDITOR_EXECUTABLE_CONSUMERS,
  sourceOverrides: unregisteredEditorOverrides,
});
assert.deepEqual(
  unregisteredRouteFixture.routesWithoutRegisteredEditor,
  [],
  "Negative fixture setup must retain a registered editor beside the unregistered editor.",
);
assert.deepEqual(
  unregisteredRouteFixture.unregisteredReachableEditorSourceFiles,
  [unregisteredEditorSource],
  "Negative fixture: an unregistered editor beside a registered editor on an existing route must fail closed.",
);

const orphanEditorFixture = contentEditorRouteCoverage({
  routeIdentities: canonicalContentEditorRouteIdentities,
  registeredEditors: [
    ...CONTENT_EDITOR_EXECUTABLE_CONSUMERS,
    {
      id: "negative-registered-editor-without-route",
      sourceFile: unregisteredEditorSource,
    },
  ],
  sourceOverrides: unregisteredEditorOverrides,
});
assert.deepEqual(
  orphanEditorFixture.registeredEditorsWithoutRoute,
  ["negative-registered-editor-without-route"],
  "Negative fixture: a registered editor without a canonical route binding must fail closed.",
);

const executableSourceProofs = new Set<string>();
for (const consumer of CONTENT_EDITOR_EXECUTABLE_CONSUMERS) {
  assert.ok(
    existsSync(join(ROOT, consumer.sourceFile)),
    `${consumer.id} registers missing source ${consumer.sourceFile}.`,
  );
  const graph = collectExecutableSourceGraph({
    root: ROOT,
    entrySourceFiles: [consumer.sourceFile],
    symbolAware: true,
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
  executableSourceProofs.add(consumer.id);
}
assert.equal(
  executableSourceProofs.size,
  CONTENT_EDITOR_EXECUTABLE_CONSUMERS.length,
  "Every registered Admin editor must have independent source/executable proof.",
);

const registeredPublicRoutes = new Set(
  PUBLIC_PAGE_ROUTE_REGISTRY.map((route) => route.href),
);
const globalSeoSourcesByRoute = new Map(
  GLOBAL_SEO_PUBLIC_CONSUMERS.map((consumer) => [
    consumer.route,
    consumer.sourceFile,
  ]),
);
const publicSourceProofs = new Set<string>();
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
    symbolAware: true,
  });
  assert.ok(
    graphUsesExecutableBinding({
      root: ROOT,
      graph,
      bindings: PUBLIC_CONTENT_BINDING,
    }),
    `${adoption.contentType} Public consumer cannot reach the canonical Public Content owner.`,
  );
  publicSourceProofs.add(adoption.contentType);
}
assert.equal(
  publicSourceProofs.size,
  CONTENT_EDITOR_ADOPTION_MANIFEST.length,
  "Every registered Public content type must have independent source/executable proof.",
);

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
  `PASS Content Editor governance: ${executableSourceProofs.size} Admin and ${publicSourceProofs.size} Public consumers have source/executable proof; global closure remains ${CONTENT_EDITOR_ARCHITECTURE.globalClosed ? "closed" : "open"} with ${CONTENT_EDITOR_ARCHITECTURE.globalClosureBlockers.length} derived blocker(s).`,
);
