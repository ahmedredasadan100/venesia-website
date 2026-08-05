import "server-only";

import { getSupabaseAdmin } from "../../supabase-admin";
import type {
  AnalyticsMetric,
  AnalyticsProviderAdapter,
  AnalyticsProviderKey,
  AnalyticsProviderResult,
} from "./analytics-contract";

function parseMetrics(value: unknown): AnalyticsMetric[] {
  if (!Array.isArray(value)) throw new Error("analytics_read_model_metrics_invalid");
  return value as AnalyticsMetric[];
}

export function createAnalyticsReadModelAdapter(
  provider: AnalyticsProviderKey,
): AnalyticsProviderAdapter {
  return {
    provider,
    async load(query): Promise<AnalyticsProviderResult> {
      const { data, error } = await getSupabaseAdmin()
        .from("analytics_provider_read_models")
        .select("connection_id,status,message,metrics,source_updated_at,checked_at")
        .eq("provider_key", provider)
        .eq("period_key", query.period)
        .eq("compare_key", query.compare)
        .order("checked_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) {
        return {
          provider,
          status: "unavailable",
          checkedAt: new Date().toISOString(),
          message: "No synchronized Analytics read model exists for this provider and query context.",
          metrics: [],
        };
      }
      const row = data as Record<string, unknown>;
      const metrics = parseMetrics(row.metrics);
      const { data: connection, error: connectionError } = await getSupabaseAdmin()
        .from("integration_connections")
        .select("status,revoked_at")
        .eq("id", String(row.connection_id))
        .maybeSingle();
      if (connectionError) throw new Error(connectionError.message);
      if (!connection || (connection as Record<string, unknown>).revoked_at) {
        return {
          provider,
          status: "unavailable",
          checkedAt: String(row.checked_at),
          message: "The owning Integration connection is unavailable or revoked.",
          metrics: [],
        };
      }
      const connectionStatus = String((connection as Record<string, unknown>).status);
      const sourceTime = Date.parse(String(row.source_updated_at));
      const stale = !Number.isFinite(sourceTime) || sourceTime < Date.now() - 48 * 60 * 60_000;
      const storedStatus = String(row.status);
      const status = storedStatus === "unavailable" || metrics.length === 0
        ? "unavailable"
        : storedStatus === "partial" || connectionStatus !== "connected" || stale
          ? "partial"
          : "ready";
      return {
        provider,
        status,
        checkedAt: String(row.checked_at),
        message: stale && metrics.length
          ? "Synchronized provider data is stale; the last valid metrics remain visible as partial."
          : String(row.message),
        metrics: status === "unavailable" ? [] : metrics,
      };
    },
  };
}
