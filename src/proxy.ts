import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { validateAdminSessionPayload } from "./lib/admin/auth/admin-users";
import {
  ADMIN_SESSION_COOKIE,
  getAdminAuthConfig,
  isAdminApiPath,
  isAdminAuthPublicPath,
  isAdminPath,
  verifyAdminSessionToken,
} from "./lib/admin/auth/session";
import { isMaintenancePublicPath } from "./lib/maintenance/paths";
import { isMaintenanceModeEnabled } from "./lib/maintenance/read-maintenance-mode";

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/admin/login", request.url);
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  if (nextPath && nextPath !== "/admin/login") {
    loginUrl.searchParams.set("next", nextPath);
  }

  return NextResponse.redirect(loginUrl);
}

function redirectToMaintenance(request: NextRequest) {
  const maintenanceUrl = new URL("/maintenance", request.url);
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  if (nextPath && nextPath !== "/maintenance") {
    maintenanceUrl.searchParams.set("next", nextPath);
  }

  return NextResponse.redirect(maintenanceUrl);
}

function unauthorizedApi() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function maintenanceApi() {
  return NextResponse.json({ error: "Site is under maintenance." }, { status: 503 });
}

async function hasBypassSession(request: NextRequest) {
  const config = getAdminAuthConfig();
  if (!config.configured) return false;

  const sessionCookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const payload = verifyAdminSessionToken(sessionCookie, config.secret);
  if (!payload) return false;

  return validateAdminSessionPayload(payload);
}

async function handleAdminAuth(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAdminAuthPublicPath(pathname)) {
    return NextResponse.next();
  }

  const config = getAdminAuthConfig();
  if (!config.configured) {
    if (isAdminApiPath(pathname)) {
      return NextResponse.json({ error: "Admin auth is not configured." }, { status: 503 });
    }
    return redirectToLogin(request);
  }

  if (!(await hasBypassSession(request))) {
    return isAdminApiPath(pathname) ? unauthorizedApi() : redirectToLogin(request);
  }

  return NextResponse.next();
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAdminPath(pathname) || isAdminApiPath(pathname)) {
    return handleAdminAuth(request);
  }

  if (isMaintenancePublicPath(pathname)) {
    return NextResponse.next();
  }

  const maintenanceOn = await isMaintenanceModeEnabled();
  if (!maintenanceOn) {
    return NextResponse.next();
  }

  if (await hasBypassSession(request)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return maintenanceApi();
  }

  return redirectToMaintenance(request);
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*",
    "/maintenance",
    "/api/maintenance/:path*",
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
