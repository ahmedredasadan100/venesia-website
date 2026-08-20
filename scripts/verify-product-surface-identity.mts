import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import {
  ADMIN_INTERACTION_MODULES,
  PRODUCT_SURFACE_IDENTITIES,
  PRODUCT_SURFACE_TYPE_DEFINITIONS,
  type ProductSurfaceIdentity,
} from "../src/lib/admin/interaction-system/adoption-manifest.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP_ROOT = resolve(ROOT, "src/app");
const TSCONFIG = resolve(ROOT, "tsconfig.json");
const BUILD_ROUTE_MANIFEST = resolve(
  ROOT,
  ".next/app-path-routes-manifest.json",
);
const VERIFY_BUILD = process.argv.includes("--build");
const tsconfig = ts.readConfigFile(TSCONFIG, ts.sys.readFile);
assert.equal(tsconfig.error, undefined, "tsconfig.json must be readable");
const compilerOptions = ts.parseJsonConfigFileContent(
  tsconfig.config,
  ts.sys,
  ROOT,
).options;

type DiscoveredRoute = {
  route: string;
  sourceFile: string;
};

function unique<T>(values: readonly T[]) {
  return [...new Set(values)];
}

function sorted(values: readonly string[]) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function collectPageSources(directory: string, result: string[] = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) collectPageSources(absolutePath, result);
    else if (entry.name === "page.tsx") result.push(absolutePath);
  }
  return result;
}

function routeFromPageSource(sourceFile: string) {
  const relativeToApp = relative(
    APP_ROOT,
    resolve(ROOT, sourceFile),
  ).replaceAll("\\", "/");
  const segments = relativeToApp
    .split("/")
    .slice(0, -1)
    .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")));
  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

function discoverRoutes(): DiscoveredRoute[] {
  return collectPageSources(APP_ROOT)
    .map((absolutePath) => {
      const sourceFile = relative(ROOT, absolutePath).replaceAll("\\", "/");
      return { route: routeFromPageSource(sourceFile), sourceFile };
    })
    .sort((left, right) => left.route.localeCompare(right.route));
}

function normalizedAbsolutePath(sourceFile: string) {
  return resolve(ROOT, sourceFile).replaceAll("\\", "/").toLowerCase();
}

const dependencyCache = new Map<string, readonly string[]>();

function localSourceDependencies(sourceFile: string) {
  const absolutePath = resolve(ROOT, sourceFile);
  const cached = dependencyCache.get(absolutePath);
  if (cached) return cached;

  const dependencies: string[] = [];
  dependencyCache.set(absolutePath, dependencies);
  if (!existsSync(absolutePath) || absolutePath.includes("node_modules")) {
    return dependencies;
  }

  const source = readFileSync(absolutePath, "utf8");
  for (const importedFile of ts.preProcessFile(source, true, true)
    .importedFiles) {
    const resolvedModule = ts.resolveModuleName(
      importedFile.fileName,
      absolutePath,
      compilerOptions,
      ts.sys,
    ).resolvedModule?.resolvedFileName;
    if (
      resolvedModule &&
      !resolvedModule.includes("node_modules") &&
      !resolvedModule.endsWith(".d.ts")
    ) {
      dependencies.push(resolvedModule);
    }
  }
  return dependencies;
}

function reachableSources(sourceFiles: readonly string[]) {
  const reachable = new Set<string>();
  const pending = sourceFiles.map((sourceFile) => resolve(ROOT, sourceFile));
  while (pending.length > 0) {
    const sourceFile = pending.pop()!;
    const normalized = normalizedAbsolutePath(sourceFile);
    if (reachable.has(normalized)) continue;
    reachable.add(normalized);
    pending.push(...localSourceDependencies(sourceFile));
  }
  return reachable;
}

function routeCoverageFailures(
  discoveredRoutes: readonly DiscoveredRoute[],
  identities: readonly ProductSurfaceIdentity[],
) {
  const routeIdentities = identities.filter(
    (surface) => surface.scope !== "nested_surface",
  );
  const registeredRoutes = routeIdentities.map((surface) => surface.route!);
  const discoveredRouteNames = discoveredRoutes.map((surface) => surface.route);
  return {
    missingIdentity: sorted(
      discoveredRouteNames.filter((route) => !registeredRoutes.includes(route)),
    ),
    missingRoute: sorted(
      registeredRoutes.filter((route) => !discoveredRouteNames.includes(route)),
    ),
    duplicateIdentity: sorted(
      unique(
        registeredRoutes.filter(
          (route, index) => registeredRoutes.indexOf(route) !== index,
        ),
      ),
    ),
  };
}

function assertNoIdentityCycles(
  identitiesById: ReadonlyMap<string, ProductSurfaceIdentity>,
) {
  for (const surface of identitiesById.values()) {
    const visited = new Set<string>();
    let current: ProductSurfaceIdentity | undefined = surface;
    while (current?.nestedParent) {
      assert.ok(
        !visited.has(current.id),
        `Product Surface parent cycle detected from ${surface.id}`,
      );
      visited.add(current.id);
      current = identitiesById.get(current.nestedParent);
    }
  }
}

const identities =
  PRODUCT_SURFACE_IDENTITIES as readonly ProductSurfaceIdentity[];
const identityIds = identities.map((surface) => surface.id);
const identitiesById = new Map(
  identities.map((surface) => [surface.id, surface]),
);
const reachableSourcesByIdentity = new Map<string, ReadonlySet<string>>();
const discoveredRoutes = discoverRoutes();
const adminRoutes = discoveredRoutes.filter(
  (surface) =>
    surface.route === "/admin" || surface.route.startsWith("/admin/"),
);
const publicRoutes = discoveredRoutes.filter(
  (surface) =>
    surface.route !== "/admin" && !surface.route.startsWith("/admin/"),
);

assert.equal(
  identityIds.length,
  new Set(identityIds).size,
  "Product Surface ids must be globally unique",
);

const routeCoverage = routeCoverageFailures(discoveredRoutes, identities);
assert.deepEqual(
  routeCoverage,
  { missingIdentity: [], missingRoute: [], duplicateIdentity: [] },
  "Every executable page route must own exactly one Product Surface Identity",
);

const failClosedProbe = routeCoverageFailures(
  [
    ...discoveredRoutes,
    {
      route: "/__product-surface-identity-unregistered-probe__",
      sourceFile:
        "src/app/__product-surface-identity-unregistered-probe__/page.tsx",
    },
  ],
  identities,
);
assert.deepEqual(
  failClosedProbe.missingIdentity,
  ["/__product-surface-identity-unregistered-probe__"],
  "The route guard must fail closed for an unregistered surface",
);

for (const surface of identities) {
  const definition =
    PRODUCT_SURFACE_TYPE_DEFINITIONS[surface.productSurfaceKind];
  assert.ok(definition, `${surface.id} has an unknown Product Surface Kind`);
  assert.equal(
    surface.productIntent,
    definition.productIntent,
    `${surface.id} Product Intent must resolve from its explicit Product Surface Kind`,
  );
  assert.deepEqual(
    surface.userLifecycle,
    definition.userLifecycle,
    `${surface.id} User Lifecycle must resolve from its explicit Product Surface Kind`,
  );
  assert.ok(
    surface.workflowOwner,
    `${surface.id} must declare Workflow Ownership`,
  );
  assert.ok(
    surface.runtimeOwners.length > 0,
    `${surface.id} must declare Runtime Ownership or not_applicable`,
  );
  assert.equal(
    surface.runtimeOwners.length,
    new Set(surface.runtimeOwners).size,
    `${surface.id} declares duplicate Runtime Owners`,
  );
  if (surface.runtimeOwners.includes("not_applicable")) {
    assert.deepEqual(
      surface.runtimeOwners,
      ["not_applicable"],
      `${surface.id} cannot combine not_applicable with a Runtime Owner`,
    );
  }
  assert.equal(
    surface.nestedChildren.length,
    new Set(surface.nestedChildren).size,
    `${surface.id} declares duplicate Nested Children`,
  );
  assert.ok(
    surface.sourceFiles.every((sourceFile) =>
      existsSync(resolve(ROOT, sourceFile)),
    ),
    `${surface.id} references a missing executable source`,
  );

  const independentIdentity = surface as ProductSurfaceIdentity &
    Record<string, unknown>;
  for (const forbiddenAxis of [
    "runtimeClassification",
    "workflowClassification",
    "capability",
    "collectionAdoption",
    "capabilityAudit",
    "formClassification",
    "adoptionBindings",
  ]) {
    assert.ok(
      !(forbiddenAxis in independentIdentity),
      `${surface.id} derives Product Identity from ${forbiddenAxis}`,
    );
  }

  if (surface.scope === "nested_surface") {
    assert.equal(
      surface.route,
      null,
      `${surface.id} nested surface cannot own a route`,
    );
    assert.ok(
      surface.nestedParent,
      `${surface.id} nested surface requires a parent`,
    );
  } else {
    assert.ok(surface.route, `${surface.id} route surface requires a route`);
    const discovered = discoveredRoutes.find(
      (candidate) => candidate.route === surface.route,
    );
    assert.ok(discovered, `${surface.id} route is not executable`);
    assert.ok(
      surface.sourceFiles.includes(discovered.sourceFile),
      `${surface.id} must bind its executable page source directly`,
    );
    assert.equal(
      surface.scope,
      surface.route === "/admin" || surface.route.startsWith("/admin/")
        ? "admin_route"
        : "public_route",
      `${surface.id} has an incorrect route scope`,
    );
  }

  if (surface.nestedParent) {
    const parent = identitiesById.get(surface.nestedParent);
    assert.ok(parent, `${surface.id} references a missing parent`);
    assert.ok(
      parent.nestedChildren.includes(surface.id),
      `${surface.id} parent does not declare the reciprocal child`,
    );
    if (surface.scope === "nested_surface") {
      let reachable = reachableSourcesByIdentity.get(parent.id);
      if (!reachable) {
        reachable = reachableSources(parent.sourceFiles);
        reachableSourcesByIdentity.set(parent.id, reachable);
      }
      for (const sourceFile of surface.sourceFiles) {
        assert.ok(
          reachable.has(normalizedAbsolutePath(sourceFile)),
          `${surface.id} source ${sourceFile} is not executable from parent ${parent.id}`,
        );
      }
    }
  }
  for (const childId of surface.nestedChildren) {
    const child = identitiesById.get(childId);
    assert.ok(child, `${surface.id} references missing child ${childId}`);
    assert.equal(
      child.nestedParent,
      surface.id,
      `${surface.id} child ${childId} does not declare the reciprocal parent`,
    );
  }
}

assertNoIdentityCycles(identitiesById);

const independentRuntimeOwners = new Set(
  ADMIN_INTERACTION_MODULES.filter(
    (module) => module.classification === "independent_runtime",
  ).map((module) => module.id),
);
for (const runtimeOwner of unique(
  identities.flatMap((surface) => surface.runtimeOwners),
)) {
  assert.ok(
    runtimeOwner === "not_applicable" ||
      independentRuntimeOwners.has(runtimeOwner),
    `Unknown or non-Runtime Product Surface owner: ${runtimeOwner}`,
  );
}

if (VERIFY_BUILD) {
  assert.ok(
    existsSync(BUILD_ROUTE_MANIFEST),
    ".next/app-path-routes-manifest.json is missing; run npm run build first",
  );
  const buildManifest = JSON.parse(
    readFileSync(BUILD_ROUTE_MANIFEST, "utf8"),
  ) as Record<string, string>;
  const builtRoutes = sorted(
    unique(
      Object.entries(buildManifest)
        .filter(
          ([appPath, route]) =>
            appPath.endsWith("/page") &&
            !route.startsWith("/_") &&
            !route.startsWith("/api/"),
        )
        .map(([, route]) => route),
    ),
  );
  assert.deepEqual(
    builtRoutes,
    sorted(discoveredRoutes.map((surface) => surface.route)),
    "Built App Router reachability must equal source and Product Identity inventories",
  );
}

const countsByKind = Object.fromEntries(
  Object.keys(PRODUCT_SURFACE_TYPE_DEFINITIONS)
    .sort((left, right) => left.localeCompare(right))
    .map((kind) => [
      kind,
      identities.filter((surface) => surface.productSurfaceKind === kind)
        .length,
    ]),
);
assert.ok(
  Object.values(countsByKind).every((count) => count > 0),
  "Every declared Product Surface Type must own at least one executable identity",
);

const productIntents = Object.values(PRODUCT_SURFACE_TYPE_DEFINITIONS).map(
  (definition) => definition.productIntent,
);
const lifecycleSignatures = Object.values(PRODUCT_SURFACE_TYPE_DEFINITIONS).map(
  (definition) => JSON.stringify(definition.userLifecycle),
);
assert.equal(
  productIntents.length,
  new Set(productIntents).size,
  "Product Surface Types cannot duplicate Product Intent",
);
assert.equal(
  lifecycleSignatures.length,
  new Set(lifecycleSignatures).size,
  "Product Surface Types cannot duplicate User Lifecycle",
);

console.log("Product Surface Identity\n");
console.log(
  `Product Surface Types .... ${Object.keys(PRODUCT_SURFACE_TYPE_DEFINITIONS).length}`,
);
console.log(`Admin route identities ... ${adminRoutes.length} PASS`);
console.log(`Public route identities .. ${publicRoutes.length} PASS`);
console.log(
  `Nested identities ....... ${identities.filter((surface) => surface.scope === "nested_surface").length} PASS`,
);
console.log(`Total identities ......... ${identities.length} PASS`);
console.log(`Parent/child graph ........ PASS`);
console.log(`Nested source reachability . PASS`);
console.log(`Type usage/minimality ..... PASS`);
console.log(`Runtime ownership ......... PASS`);
console.log(`Workflow ownership ........ PASS`);
console.log(`Capability separation ..... PASS`);
console.log(`Adoption independence ..... PASS`);
console.log(`Fail-closed route probe ... PASS`);
console.log(
  `Build reachability ........ ${VERIFY_BUILD ? "PASS" : "SKIPPED (use --build)"}`,
);
console.log(`Counts by kind ............ ${JSON.stringify(countsByKind)}`);
console.log("\nProduct Surface Identity verification PASS");
