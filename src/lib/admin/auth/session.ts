/** Admin session cookie + token helpers (safe for proxy and server routes). */

import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "venesia_admin_session";
export const ADMIN_SESSION_TTL_SEC = 60 * 60 * 12;

export type AdminSessionPayload = {
  u: string;
  exp: number;
};

export function getAdminAuthConfig() {
  const username = process.env["ADMIN_USERNAME"]?.trim() ?? "";
  const password = process.env["ADMIN_PASSWORD"] ?? "";
  const secret = process.env["ADMIN_SESSION_SECRET"] ?? "";

  return {
    username,
    password,
    secret,
    configured: Boolean(username && password && secret.length >= 16),
  };
}

/** Secure cookies only on HTTPS production (Vercel). Local `next start` on http must stay false. */
export function shouldUseSecureAdminSessionCookie() {
  const forced = process.env["ADMIN_SESSION_COOKIE_SECURE"];
  if (forced === "true") return true;
  if (forced === "false") return false;
  return process.env["VERCEL"] === "1";
}

function signPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createAdminSessionToken(username: string, secret: string, ttlSec = ADMIN_SESSION_TTL_SEC) {
  const payload: AdminSessionPayload = {
    u: username,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(encodedPayload, secret);
  return `v1.${encodedPayload}.${signature}`;
}

export function verifyAdminSessionToken(token: string | undefined | null, secret: string) {
  if (!token || !secret) return null;

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;

  const [, encodedPayload, signature] = parts;
  const expected = signPayload(encodedPayload, secret);

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as AdminSessionPayload;
    if (!payload?.u || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function verifyAdminCredentials(username: string, password: string) {
  const config = getAdminAuthConfig();
  if (!config.configured) return false;

  const userBuf = Buffer.from(username, "utf8");
  const expectedUserBuf = Buffer.from(config.username, "utf8");
  const passBuf = Buffer.from(password, "utf8");
  const expectedPassBuf = Buffer.from(config.password, "utf8");

  if (userBuf.length !== expectedUserBuf.length || passBuf.length !== expectedPassBuf.length) {
    return false;
  }

  return timingSafeEqual(userBuf, expectedUserBuf) && timingSafeEqual(passBuf, expectedPassBuf);
}

export function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function isAdminApiPath(pathname: string) {
  return pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}

export function isAdminAuthPublicPath(pathname: string) {
  return pathname === "/admin/login" || pathname === "/api/admin/auth/login";
}

export function hasValidAdminSession(cookieValue: string | undefined, secret: string) {
  return Boolean(verifyAdminSessionToken(cookieValue, secret));
}
