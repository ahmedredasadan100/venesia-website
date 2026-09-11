import { z } from "zod";
import { isCronRequestAuthorized } from "../../../../../lib/admin/auth/cron";
import { isProductionTopicViewRuntime } from "../../../../../lib/content/topic-view-security";
import { logError } from "../../../../../lib/logging";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";
const resultSchema = z.object({
  deduplication_deleted: z.number().int().nonnegative(),
  limits_deleted: z.number().int().nonnegative(),
}).strict();

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!isCronRequestAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  }
  if (!isProductionTopicViewRuntime()) return Response.json({ outcome: "excluded" }, { headers });
  try {
    const { data, error } = await getSupabaseAdmin().rpc("prune_topic_view_state");
    if (error) throw error;
    return Response.json(resultSchema.parse(data), { headers });
  } catch (error) {
    logError("Unable to prune expired topic view state", error);
    return Response.json({ error: "view_maintenance_failed" }, { status: 503, headers });
  }
}
