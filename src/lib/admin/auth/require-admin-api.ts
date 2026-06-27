import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { validateAdminSessionPayload } from "./admin-users";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  getAdminAuthConfig,
  getAdminSessionCookieDomain,
  resolveAdminSessionTtlSec,
  shouldUseSecureAdminSessionCookie,
  type AdminSessionSubject,
  verifyAdminSessionToken,
} from "./session";

export async function requireAdminApi() {
  const config = getAdminAuthConfig();
  if (!config.configured) {
    return NextResponse.json({ error: "Admin auth is not configured." }, { status: 503 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const session = verifyAdminSessionToken(token, config.secret);

  if (!session || !(await validateAdminSessionPayload(session))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export function createAdminSessionCookie(
  subject: AdminSessionSubject,
  request?: Request,
  options?: { rememberMe?: boolean },
) {
  const config = getAdminAuthConfig();
  if (!config.configured) {
    throw new Error("Admin auth is not configured.");
  }

  const maxAge = resolveAdminSessionTtlSec(options?.rememberMe === true);
  const value = createAdminSessionToken(subject, config.secret, maxAge);
  const domain = getAdminSessionCookieDomain(request);

  return {
    name: ADMIN_SESSION_COOKIE,
    value,
    httpOnly: true,
    secure: shouldUseSecureAdminSessionCookie(request),
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    ...(domain ? { domain } : {}),
  };
}

export function clearAdminSessionCookie(request?: Request) {
  const domain = getAdminSessionCookieDomain(request);

  return {
    name: ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: shouldUseSecureAdminSessionCookie(request),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
    ...(domain ? { domain } : {}),
  };
}
