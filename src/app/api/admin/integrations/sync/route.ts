import { timingSafeEqual } from "node:crypto";

import { runDueIntegrationSyncs } from "../../../../../lib/admin/integrations/sync-coordinator";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization") ?? "";
  if (!secret || secret.length < 16) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET?.trim()) {
    return Response.json({ ok: false, error: "integration_cron_not_configured" }, { status: 503 });
  }
  if (!authorized(request)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const result = await runDueIntegrationSyncs(8);
  return Response.json({ ok: true, ...result }, { headers: { "cache-control": "private, no-store" } });
}
