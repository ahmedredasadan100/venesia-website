import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";

export const TOPIC_VIEW_COOKIE = "__Host-venesia_view_visitor";

// Product values live only in public.topic_view_policy. The database returns
// the cookie lifetime along with its atomic decision; the browser owns none.
export const topicViewResultSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.enum(["counted", "duplicate", "not_viewable", "invalid", "identity_required"]), cookie_ttl_seconds: z.number().int().positive() }).strict(),
  z.object({ outcome: z.literal("rate_limited"), cookie_ttl_seconds: z.number().int().positive(), retry_after_seconds: z.number().int().positive() }).strict(),
]);

export function isProductionTopicViewRuntime(environment: NodeJS.ProcessEnv = process.env) {
  return environment.VERCEL === "1" && environment.VERCEL_ENV === "production" &&
    environment.CI !== "1" && environment.CI !== "true";
}

export function isProductionTopicViewRequest(request: Request, environment: NodeJS.ProcessEnv = process.env) {
  if (!isProductionTopicViewRuntime(environment)) return false;
  try {
    const canonical = new URL(environment.NEXT_PUBLIC_SITE_URL ?? "");
    const actual = new URL(request.url);
    return canonical.protocol === "https:" && actual.protocol === "https:" &&
      actual.hostname === canonical.hostname &&
      actual.hostname !== "localhost" && !actual.hostname.endsWith(".localhost") &&
      !isIP(actual.hostname.replace(/^\[|\]$/g, ""));
  } catch { return false; }
}

export function getTopicViewSigningSecret() {
  const secret = process.env.TOPIC_VIEW_SIGNING_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("Topic view signing is not configured.");
  return secret;
}

function digest(secret: string, purpose: string, value: string) {
  return createHmac("sha256", secret).update(`venesia-topic-view:${purpose}:${value}`).digest("hex");
}

export function readTopicViewVisitor(request: Request, secret: string, now = Date.now()) {
  const values = (request.headers.get("cookie") ?? "").split(";")
    .map(value => value.trim()).filter(value => value.startsWith(`${TOPIC_VIEW_COOKIE}=`));
  if (values.length !== 1) return null;
  const token = values[0].slice(TOPIC_VIEW_COOKIE.length + 1);
  const match = /^v1\.([a-f0-9]{32})\.(\d{10})\.([a-f0-9]{64})$/.exec(token);
  if (!match || Number(match[2]) * 1000 <= now) return null;
  const expected = Buffer.from(digest(secret, "cookie", `v1.${match[1]}.${match[2]}`), "hex");
  const actual = Buffer.from(match[3], "hex");
  if (!timingSafeEqual(actual, expected)) return null;
  return digest(secret, "visitor", match[1]);
}

export function issueTopicViewVisitor(secret: string, ttlSeconds: number, now = Date.now()) {
  const payload = `v1.${randomBytes(16).toString("hex")}.${Math.floor(now / 1000) + ttlSeconds}`;
  return `${payload}.${digest(secret, "cookie", payload)}`;
}

export function trustedTopicViewIpKey(request: Request, secret: string) {
  // This provider-written header is trusted only on the Vercel production
  // boundary above. Never accept a client body, arbitrary forwarding chain,
  // x-real-ip fallback, or IP-as-visitor identity.
  const address = request.headers.get("x-vercel-forwarded-for")?.trim();
  if (!address || !isIP(address)) throw new Error("Trusted topic view IP is unavailable.");
  const canonical = isIP(address) === 6
    ? new URL(`http://[${address}]/`).hostname.toLowerCase()
    : address;
  return digest(secret, "ip", canonical);
}
