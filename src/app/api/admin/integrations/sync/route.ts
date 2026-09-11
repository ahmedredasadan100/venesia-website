import { isCronRequestAuthorized } from "../../../../../lib/admin/auth/cron";

import { runDueIntegrationSyncs } from "../../../../../lib/admin/integrations/sync-coordinator";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET?.trim()) {
    return Response.json({ ok: false, error: "integration_cron_not_configured" }, { status: 503 });
  }
  if (!isCronRequestAuthorized(request)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const result = await runDueIntegrationSyncs(8);
  return Response.json({ ok: true, ...result }, { headers: { "cache-control": "private, no-store" } });
}
