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

export function getAdminEnvDiagnostics() {
  const secret = process.env["ADMIN_SESSION_SECRET"] ?? "";

  return {
    hasAdminUsername: Boolean(process.env["ADMIN_USERNAME"]),
    hasAdminPassword: Boolean(process.env["ADMIN_PASSWORD"]),
    hasAdminSecret: Boolean(secret),
    secretLengthOk: secret.length >= 16,
    authConfigured: getAdminAuthConfig().configured,
  };
}

export function resolveRequestIsHttps(request?: Pick<Request, "headers" | "url">) {
  if (!request) return false;

  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (forwarded === "https") return true;
  if (forwarded === "http") return false;

  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

/** Secure cookies on HTTPS production (Vercel/VPS). Local http stays false unless forced. */
export function shouldUseSecureAdminSessionCookie(request?: Pick<Request, "headers" | "url">) {
  const forced = process.env["ADMIN_SESSION_COOKIE_SECURE"];
  if (forced === "true") return true;
  if (forced === "false") return false;

  if (resolveRequestIsHttps(request)) return true;
  if (process.env["VERCEL"] === "1") return true;

  return false;
}

/** Share session across www/apex on production HTTPS. Omit on localhost/IP. */
export function getAdminSessionCookieDomain(request?: Pick<Request, "headers" | "url">) {
  const override = process.env["ADMIN_SESSION_COOKIE_DOMAIN"];
  if (override === "none" || override === "false") return undefined;
  if (override) return override;

  if (!shouldUseSecureAdminSessionCookie(request)) return undefined;

  const siteUrl = process.env["NEXT_PUBLIC_SITE_URL"];
  if (!siteUrl) return undefined;

  try {
    const { hostname } = new URL(siteUrl);
    if (hostname === "localhost" || hostname.endsWith(".localhost")) return undefined;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return undefined;

    const base = hostname.replace(/^www\./, "");
    return base.includes(".") ? `.${base}` : undefined;
  } catch {
    return undefined;
  }
}

export function describeAdminSessionCookieOptions(request?: Pick<Request, "headers" | "url">) {
  const secure = shouldUseSecureAdminSessionCookie(request);
  const domain = getAdminSessionCookieDomain(request);

  return {
    cookieName: ADMIN_SESSION_COOKIE,
    path: "/",
    sameSite: "lax" as const,
    secure,
    hasDomain: Boolean(domain),
  };
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
  return (
    pathname === "/admin/login" ||
    pathname === "/api/admin/auth/login" ||
    pathname === "/api/admin/auth/logout"
  );
}

export function hasValidAdminSession(cookieValue: string | undefined, secret: string) {
  return Boolean(verifyAdminSessionToken(cookieValue, secret));
}
