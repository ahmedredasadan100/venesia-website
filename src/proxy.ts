import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  ADMIN_SESSION_COOKIE,
  getAdminAuthConfig,
  hasValidAdminSession,
  isAdminApiPath,
  isAdminAuthPublicPath,
  isAdminPath,
} from "./lib/admin/auth/session";

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/admin/login", request.url);
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  if (nextPath && nextPath !== "/admin/login") {
    loginUrl.searchParams.set("next", nextPath);
  }

  return NextResponse.redirect(loginUrl);
}

function unauthorizedApi() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isAdminPath(pathname) && !isAdminApiPath(pathname)) {
    return NextResponse.next();
  }

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

  const sessionCookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const authenticated = hasValidAdminSession(sessionCookie, config.secret);

  if (!authenticated) {
    return isAdminApiPath(pathname) ? unauthorizedApi() : redirectToLogin(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
