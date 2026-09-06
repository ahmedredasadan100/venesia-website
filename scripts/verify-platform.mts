import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ADMIN_NAVIGATION_REGISTRY } from "../src/config/admin/navigation.ts";
import { PUBLIC_PAGE_ROUTE_REGISTRY } from "../src/lib/admin/links/static-routes.ts";
import { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST } from "../src/lib/admin/form-system/adoption-manifest.ts";
import {
  ADMIN_COLLECTION_SURFACE_ADOPTION,
  PRODUCT_SURFACE_IDENTITIES,
} from "../src/lib/admin/interaction-system/adoption-manifest.ts";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const APP_ROUTE_MANIFEST = ".next/app-path-routes-manifest.json";
const CONFIGURED_BASE_URL =
  process.env.PLATFORM_BASE_URL ??
  process.env.E2E_BASE_URL ??
  "http://127.0.0.1:3000";
const BASE_URL = CONFIGURED_BASE_URL.endsWith("/")
  ? CONFIGURED_BASE_URL.slice(0, -1)
  : CONFIGURED_BASE_URL;

type NavigationItem = {
  href: string;
  enabled: boolean;
  children?: readonly NavigationItem[];
};

type RouteContractFailures = {
  unregisteredBuiltRoutes: string[];
  registeredRoutesMissingFromBuild: string[];
};

function unique<T>(values: readonly T[]) {
  return [...new Set(values)];
}

function flattenAdminNavigation(items: readonly NavigationItem[]): string[] {
  return items.flatMap((item) => [
    ...(item.enabled ? [item.href] : []),
    ...flattenAdminNavigation(item.children ?? []),
  ]);
}

function routeSegments(pathname: string) {
  return pathname.split("/").filter(Boolean);
}

function routeMatchesCompiledTemplate(pathname: string, template: string) {
  const pathSegments = routeSegments(pathname);
  const templateSegments = routeSegments(template);
  for (let index = 0; index < templateSegments.length; index += 1) {
    const templateSegment = templateSegments[index];
    if (templateSegment.startsWith("[[...")) return true;
    if (templateSegment.startsWith("[...")) return pathSegments.length > index;
    if (pathSegments[index] === undefined) return false;
    if (
      !(templateSegment.startsWith("[") && templateSegment.endsWith("]")) &&
      templateSegment !== pathSegments[index]
    ) {
      return false;
    }
  }
  return pathSegments.length === templateSegments.length;
}

function auditRouteContracts(input: {
  builtRoutes: readonly string[];
  registeredRoutes: readonly string[];
  allowConcreteRegistrations?: boolean;
}): RouteContractFailures {
  const built = unique(input.builtRoutes).sort();
  const registered = unique(input.registeredRoutes).sort();
  return {
    unregisteredBuiltRoutes: built.filter(
      (route) => !registered.includes(route),
    ),
    registeredRoutesMissingFromBuild: registered.filter(
      (route) =>
        !built.includes(route) &&
        !(
          input.allowConcreteRegistrations &&
          built.some((template) =>
            routeMatchesCompiledTemplate(route, template),
          )
        ),
    ),
  };
}

function isFailedStatus(status: number) {
  return status === 404 || status >= 500;
}

async function requestRoute(pathname: string, cookie = "") {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    redirect: "follow",
    headers: cookie ? { cookie } : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  return {
    pathname,
    status: response.status,
    finalUrl: response.url,
  };
}

function readAuthenticatedCookie() {
  const configured = process.env.E2E_ADMIN_STORAGE_STATE?.trim();
  if (!configured) return null;
  const stateSource = configured.startsWith("{")
    ? configured
    : readFileSync(
        isAbsolute(configured) ? configured : resolve(ROOT, configured),
        "utf8",
      );
  const state = JSON.parse(stateSource) as {
    cookies?: Array<{
      name: string;
      value: string;
      domain: string;
      expires?: number;
    }>;
  };
  const host = new URL(BASE_URL).hostname;
  const nowSeconds = Date.now() / 1000;
  return (state.cookies ?? [])
    .filter((cookie) => {
      const domain = cookie.domain.startsWith(".")
        ? cookie.domain.slice(1)
        : cookie.domain;
      return (
        (host === domain || host.endsWith(`.${domain}`)) &&
        (!cookie.expires || cookie.expires < 0 || cookie.expires > nowSeconds)
      );
    })
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

assert.ok(
  existsSync(join(ROOT, APP_ROUTE_MANIFEST)),
  `${APP_ROUTE_MANIFEST} is missing; run npm run build first.`,
);

const routeManifest = JSON.parse(
  readFileSync(join(ROOT, APP_ROUTE_MANIFEST), "utf8"),
) as Record<string, string>;
const builtPageRoutes = unique(
  Object.entries(routeManifest)
    .filter(
      ([appPath, route]) =>
        appPath.endsWith("/page") &&
        !route.startsWith("/_") &&
        !route.startsWith("/api/"),
    )
    .map(([, route]) => route),
).sort();
const builtPublicRoutes = builtPageRoutes.filter(
  (route) => !route.startsWith("/admin"),
);
const builtAdminRoutes = builtPageRoutes.filter((route) =>
  route.startsWith("/admin"),
);
const registeredPublicRoutes = unique(
  PUBLIC_PAGE_ROUTE_REGISTRY.map((route) => route.href),
).sort();
const collectionAdminRouteRegistrations =
  ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces.flatMap(
    (surface) => surface.routes,
  );
const formAdminRouteRegistrations = ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.flatMap(
  (entry) => {
    if (!("registryModuleKind" in entry)) return [];
    const routeIdentities = PRODUCT_SURFACE_IDENTITIES.filter(
      (identity) =>
        identity.scope === "admin_route" &&
        identity.route !== undefined &&
        entry.sourceFiles.some((sourceFile) =>
          identity.sourceFiles.includes(sourceFile),
        ),
    );
    assert.equal(
      routeIdentities.length,
      1,
      `${entry.id} must map to exactly one canonical Product Surface route.`,
    );
    return [
      {
        consumerId: entry.id,
        route: routeIdentities[0]!.route!,
      },
    ];
  },
);
const adminRouteRegistrations = [
  ...ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces.flatMap((surface) =>
    surface.routes.map((route) => ({
      consumerId: `collection:${surface.id}`,
      route,
    })),
  ),
  ...formAdminRouteRegistrations.map((registration) => ({
    consumerId: `form:${registration.consumerId}`,
    route: registration.route,
  })),
];
const duplicateAdminConsumerRouteRegistrations = adminRouteRegistrations.filter(
  (registration, index, registrations) =>
    registrations.findIndex(
      (candidate) =>
        candidate.consumerId === registration.consumerId &&
        candidate.route === registration.route,
    ) !== index,
);
assert.deepEqual(
  duplicateAdminConsumerRouteRegistrations,
  [],
  "Each Admin consumer may register a route only once; independently inventoried nested consumers may share their aggregate route.",
);
const registeredAdminRoutes = unique([
  ...collectionAdminRouteRegistrations,
  ...formAdminRouteRegistrations.map((registration) => registration.route),
]).sort();

assert.equal(
  registeredPublicRoutes.length,
  PUBLIC_PAGE_ROUTE_REGISTRY.length,
  "Public Page Route Registry contains duplicate route registrations.",
);
for (const surface of ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces) {
  assert.equal(
    unique(surface.routes).length,
    surface.routes.length,
    `${surface.id} contains duplicate route registrations.`,
  );
  for (const sourceFile of [
    ...surface.pageSourceFiles,
    ...surface.presentationSourceFiles,
  ]) {
    assert.ok(
      existsSync(join(ROOT, sourceFile)),
      `${surface.id} registers missing source ${sourceFile}.`,
    );
  }
}
for (const entry of ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST) {
  if (!("registryModuleKind" in entry)) continue;
  for (const sourceFile of entry.sourceFiles) {
    assert.ok(
      existsSync(join(ROOT, sourceFile)),
      `${entry.id} registers missing source ${sourceFile}.`,
    );
  }
}

const publicContractFailures = auditRouteContracts({
  builtRoutes: builtPublicRoutes,
  registeredRoutes: registeredPublicRoutes,
});
const adminContractFailures = auditRouteContracts({
  builtRoutes: builtAdminRoutes,
  registeredRoutes: registeredAdminRoutes,
  allowConcreteRegistrations: true,
});
assert.deepEqual(
  publicContractFailures,
  { unregisteredBuiltRoutes: [], registeredRoutesMissingFromBuild: [] },
  "Public route registration must match the compiled Next route manifest bidirectionally.",
);
assert.deepEqual(
  adminContractFailures,
  { unregisteredBuiltRoutes: [], registeredRoutesMissingFromBuild: [] },
  "Admin consumer route registration must match the compiled Next route manifest bidirectionally.",
);

const negativeUnregisteredFixture = auditRouteContracts({
  builtRoutes: [...builtPublicRoutes, "/fixture-unregistered"],
  registeredRoutes: registeredPublicRoutes,
});
assert.deepEqual(negativeUnregisteredFixture.unregisteredBuiltRoutes, [
  "/fixture-unregistered",
]);
const negativeMissingBuildFixture = auditRouteContracts({
  builtRoutes: builtPublicRoutes,
  registeredRoutes: [...registeredPublicRoutes, "/fixture-missing-build"],
});
assert.deepEqual(negativeMissingBuildFixture.registeredRoutesMissingFromBuild, [
  "/fixture-missing-build",
]);

console.log("Executable Route Registration Contracts\n");
console.log(
  `Compiled public routes ........... ${builtPublicRoutes.length} registered`,
);
console.log(
  `Compiled Admin routes ............ ${builtAdminRoutes.length} registered`,
);
console.log(
  `Admin consumer registrations ... ${adminRouteRegistrations.length} Collection/Form route owners`,
);
console.log("Bidirectional fail-closed proof .. PASS");

if (process.argv.includes("--contracts-only")) {
  console.log("\nPlatform route contracts PASS");
  process.exit(0);
}

const publicHttpRoutes = PUBLIC_PAGE_ROUTE_REGISTRY.filter(
  (route) => route.verification === "http_exact",
).map((route) => route.href);
const publicResults = await Promise.all(
  publicHttpRoutes.map((route) => requestRoute(route)),
);
const publicFailures = publicResults.filter((result) =>
  isFailedStatus(result.status),
);
assert.deepEqual(publicFailures, [], "public route health failures");

const adminBoundaryRoutes = unique(
  flattenAdminNavigation(
    ADMIN_NAVIGATION_REGISTRY as readonly NavigationItem[],
  ),
);
const adminBoundaryResults = await Promise.all(
  adminBoundaryRoutes.map((route) => requestRoute(route)),
);
const adminBoundaryFailures = adminBoundaryResults.filter((result) => {
  const destination = new URL(result.finalUrl);
  const respectedBoundary =
    destination.pathname === "/admin/login" ||
    [401, 403, 503].includes(result.status);
  return isFailedStatus(result.status) || !respectedBoundary;
});
assert.deepEqual(
  adminBoundaryFailures,
  [],
  "unauthenticated Admin routes did not respect the auth boundary",
);

const authenticatedCookie = readAuthenticatedCookie();
let authenticatedAdminStatus = "SKIPPED / UNPROVEN";
let authenticatedAdminChecked = 0;
if (authenticatedCookie) {
  const authenticatedResults = await Promise.all(
    adminBoundaryRoutes.map((route) =>
      requestRoute(route, authenticatedCookie),
    ),
  );
  const authenticatedFailures = authenticatedResults.filter((result) => {
    const destination = new URL(result.finalUrl);
    return (
      isFailedStatus(result.status) || destination.pathname === "/admin/login"
    );
  });
  assert.deepEqual(
    authenticatedFailures,
    [],
    "authenticated Admin read-only route failures",
  );
  authenticatedAdminChecked = authenticatedResults.length;
  authenticatedAdminStatus = "PASS";
}

console.log(`Public HTTP checks ............... ${publicResults.length} PASS`);
console.log(
  `Admin auth-boundary checks ...... ${adminBoundaryResults.length} PASS`,
);
console.log(
  `AUTHENTICATED ADMIN ROUTE PROOF = ${authenticatedAdminStatus}${authenticatedAdminChecked ? ` (${authenticatedAdminChecked} routes)` : ""}`,
);
console.log(`Base URL ........................ ${BASE_URL}`);
console.log("\nPlatform verification PASS");
