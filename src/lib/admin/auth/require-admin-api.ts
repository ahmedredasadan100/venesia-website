import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SEC,
  createAdminSessionToken,
  getAdminAuthConfig,
  shouldUseSecureAdminSessionCookie,
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

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export function createAdminSessionCookie(username: string) {
  const config = getAdminAuthConfig();
  if (!config.configured) {
    throw new Error("Admin auth is not configured.");
  }

  const value = createAdminSessionToken(username, config.secret);
  return {
    name: ADMIN_SESSION_COOKIE,
    value,
    httpOnly: true,
    secure: shouldUseSecureAdminSessionCookie(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SEC,
  };
}

export function clearAdminSessionCookie() {
  return {
    name: ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: shouldUseSecureAdminSessionCookie(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}
