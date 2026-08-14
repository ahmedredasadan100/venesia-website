import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as ts from "typescript";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const APP_ROUTE_MANIFEST = ".next/app-path-routes-manifest.json";
const BASE_URL = (
  process.env.PLATFORM_BASE_URL ??
  process.env.E2E_BASE_URL ??
  "http://127.0.0.1:3000"
).replace(/\/$/u, "");

type StaticRoute = { key: string; href: string };
type NavigationItem = {
  href: string;
  enabled: boolean;
  children?: NavigationItem[];
};

function read(sourceFile: string) {
  return readFileSync(join(ROOT, sourceFile), "utf8");
}

function loadPureTypeScriptModule(sourceFile: string) {
  const output = ts.transpileModule(read(sourceFile), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourceFile,
  }).outputText;
  const moduleExports: Record<string, unknown> = {};
  Function("exports", output)(moduleExports);
  return moduleExports;
}

function unique<T>(values: readonly T[]) {
  return [...new Set(values)];
}

function flattenAdminNavigation(items: readonly NavigationItem[]): string[] {
  return items.flatMap((item) => [
    ...(item.enabled ? [item.href] : []),
    ...flattenAdminNavigation(item.children ?? []),
  ]);
}

function routeMatchesTemplate(pathname: string, template: string) {
  const pathSegments = pathname.split("/").filter(Boolean);
  const templateSegments = template.split("/").filter(Boolean);
  for (let index = 0; index < templateSegments.length; index += 1) {
    const templateSegment = templateSegments[index];
    if (templateSegment.startsWith("[[...")) return true;
    if (templateSegment.startsWith("[...")) {
      return pathSegments.length > index;
    }
    if (pathSegments[index] === undefined) return false;
    if (
      !templateSegment.startsWith("[") &&
      templateSegment !== pathSegments[index]
    ) {
      return false;
    }
  }
  return pathSegments.length === templateSegments.length;
}

function isFailedStatus(status: number) {
  return status === 404 || status >= 500;
}

function hasRenderCrash(source: string) {
  return (
    source.includes("id=\"__next_error__\"") ||
    source.includes("Application error: a server-side exception")
  );
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
    body: await response.text(),
  };
}

function extractInternalHrefs(source: string) {
  return unique(
    [...source.matchAll(/href=["']([^"']+)["']/gu)]
      .map((match) => match[1].replaceAll("&amp;", "&"))
      .filter((href) => href.startsWith("/"))
      .map((href) => href.split(/[?#]/u)[0])
      .filter(
        (href) =>
          !href.startsWith("/_next/") &&
          !href.startsWith("/api/") &&
          !/\/[^/]+\.[^/]+$/u.test(href),
      ),
  );
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
      path?: string;
      expires?: number;
    }>;
  };
  const host = new URL(BASE_URL).hostname;
  const nowSeconds = Date.now() / 1000;
  return (state.cookies ?? [])
    .filter((cookie) => {
      const domain = cookie.domain.replace(/^\./u, "");
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

const routeManifest = JSON.parse(read(APP_ROUTE_MANIFEST)) as Record<
  string,
  string
>;
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
const publicPageRoutes = builtPageRoutes.filter(
  (route) => !route.startsWith("/admin"),
);

const staticRouteModule = loadPureTypeScriptModule(
  "src/lib/admin/links/static-routes.ts",
);
const navigationModule = loadPureTypeScriptModule(
  "src/config/admin/navigation.ts",
);
const publicRegistryRoutes = unique(
  (staticRouteModule.ADMIN_STATIC_ROUTES as readonly StaticRoute[]).map(
    (route) => route.href,
  ),
);
const adminRegistryRoutes = unique(
  flattenAdminNavigation(
    navigationModule.ADMIN_NAVIGATION_REGISTRY as readonly NavigationItem[],
  ),
);

const missingPublicRoutes = publicRegistryRoutes.filter(
  (route) => !builtPageRoutes.includes(route),
);
const missingAdminRoutes = adminRegistryRoutes.filter(
  (route) =>
    !builtPageRoutes.some((template) => routeMatchesTemplate(route, template)),
);
assert.deepEqual(missingPublicRoutes, [], "registered public routes missing from build");
assert.deepEqual(missingAdminRoutes, [], "registered Admin routes missing from build");

const publicResults = await Promise.all(
  publicRegistryRoutes.map((route) => requestRoute(route)),
);
const publicFailures = publicResults.filter(
  (result) => isFailedStatus(result.status) || hasRenderCrash(result.body),
);
assert.deepEqual(publicFailures, [], "public route health failures");

const adminBoundaryResults = await Promise.all(
  adminRegistryRoutes.map((route) => requestRoute(route)),
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

const dynamicPublicFamilies = publicPageRoutes.filter((route) =>
  route.includes("["),
);
const publicBodies = new Map(
  publicResults.map((result) => [result.pathname, result.body]),
);
const exactBuiltPublicRoutes = new Set(
  publicPageRoutes.filter((route) => !route.includes("[")),
);
const dynamicResults: Array<{
  family: string;
  representative: string | null;
  status: "PASS" | "SKIPPED";
}> = [];

for (const family of dynamicPublicFamilies) {
  const dynamicIndex = family.indexOf("/[");
  const parentRoute = dynamicIndex <= 0 ? "/" : family.slice(0, dynamicIndex);
  const candidateSources = unique([
    ...(publicBodies.get(parentRoute) ? [publicBodies.get(parentRoute)!] : []),
    ...publicBodies.values(),
  ]);
  const representative = candidateSources
    .flatMap(extractInternalHrefs)
    .find(
      (href) =>
        routeMatchesTemplate(href, family) &&
        !exactBuiltPublicRoutes.has(href) &&
        (family !== "/[...slug]" ||
          !dynamicPublicFamilies.some(
            (candidate) =>
              candidate !== family && routeMatchesTemplate(href, candidate),
          )),
    );
  if (!representative) {
    dynamicResults.push({ family, representative: null, status: "SKIPPED" });
    continue;
  }
  const result = await requestRoute(representative);
  assert.ok(
    !isFailedStatus(result.status) && !hasRenderCrash(result.body),
    `${family} representative ${representative} failed with ${result.status}`,
  );
  dynamicResults.push({ family, representative, status: "PASS" });
}

const authenticatedCookie = readAuthenticatedCookie();
let authenticatedAdminStatus = "SKIPPED / UNPROVEN";
let authenticatedAdminChecked = 0;
if (authenticatedCookie) {
  const authenticatedResults = await Promise.all(
    adminRegistryRoutes.map((route) => requestRoute(route, authenticatedCookie)),
  );
  const authenticatedFailures = authenticatedResults.filter((result) => {
    const destination = new URL(result.finalUrl);
    return (
      isFailedStatus(result.status) ||
      destination.pathname === "/admin/login" ||
      hasRenderCrash(result.body)
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

const dynamicPassed = dynamicResults.filter(
  (result) => result.status === "PASS",
).length;
const dynamicSkipped = dynamicResults.length - dynamicPassed;

console.log("Platform Route and Page Health\n");
console.log(`Build page routes ............... ${builtPageRoutes.length}`);
console.log(`Registered public routes ........ ${publicRegistryRoutes.length} PASS`);
console.log(`Registered Admin routes ......... ${adminRegistryRoutes.length} PASS`);
console.log(`Public HTTP/render checks ....... ${publicResults.length} PASS`);
console.log(`Admin auth-boundary checks ...... ${adminBoundaryResults.length} PASS`);
console.log(
  `Dynamic public families ........ ${dynamicPassed} PASS / ${dynamicSkipped} SKIPPED`,
);
for (const result of dynamicResults) {
  console.log(
    `  ${result.family} -> ${result.representative ?? "no safe representative discovered"} ${result.status}`,
  );
}
console.log(
  `AUTHENTICATED ADMIN ROUTE PROOF = ${authenticatedAdminStatus}${authenticatedAdminChecked ? ` (${authenticatedAdminChecked} routes)` : ""}`,
);
console.log(`Base URL ........................ ${BASE_URL}`);
console.log("\nPlatform verification PASS");
