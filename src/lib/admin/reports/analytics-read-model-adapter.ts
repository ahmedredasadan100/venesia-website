import "server-only";

import { getSupabaseAdmin } from "../../supabase-admin";
import { isAnalyticsMetricKey } from "./analytics-contract";
import type {
  AnalyticsMetric,
  AnalyticsProviderAdapter,
  AnalyticsProviderKey,
  AnalyticsProviderResult,
} from "./analytics-contract";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isAnalyticsMetricUnit(value: unknown): value is AnalyticsMetric["unit"] {
  return value === "count" ||
    value === "milliseconds" ||
    value === "ratio" ||
    value === "currency";
}

function parseDimensions(value: unknown): Record<string, string> | undefined {
  if (value === null || value === undefined) return undefined;
  if (!isRecord(value)) throw new Error("analytics_read_model_dimensions_invalid");
  const dimensions: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== "string") {
      throw new Error("analytics_read_model_dimensions_invalid");
    }
    dimensions[key] = item;
  }
  return dimensions;
}

function parseComparison(value: unknown): AnalyticsMetric["comparison"] {
  if (value === null || value === undefined) return undefined;
  if (!isRecord(value) ||
    typeof value.value !== "number" ||
    !Number.isFinite(value.value) ||
    typeof value.periodStart !== "string" ||
    typeof value.periodEnd !== "string" ||
    (value.changeRatio !== undefined &&
      (typeof value.changeRatio !== "number" || !Number.isFinite(value.changeRatio)))) {
    throw new Error("analytics_read_model_comparison_invalid");
  }
  return {
    value: value.value,
    periodStart: value.periodStart,
    periodEnd: value.periodEnd,
    ...(value.changeRatio === undefined ? {} : { changeRatio: value.changeRatio }),
  };
}

function parseMetric(value: unknown): AnalyticsMetric {
  if (!isRecord(value) ||
    !isAnalyticsMetricKey(value.key) ||
    typeof value.label !== "string" ||
    typeof value.value !== "number" ||
    !Number.isFinite(value.value) ||
    !isAnalyticsMetricUnit(value.unit) ||
    typeof value.periodStart !== "string" ||
    typeof value.periodEnd !== "string") {
    throw new Error("analytics_read_model_metric_invalid");
  }
  const dimensions = parseDimensions(value.dimensions);
  const comparison = parseComparison(value.comparison);
  return {
    key: value.key,
    label: value.label,
    value: value.value,
    unit: value.unit,
    periodStart: value.periodStart,
    periodEnd: value.periodEnd,
    ...(dimensions === undefined ? {} : { dimensions }),
    ...(comparison === undefined ? {} : { comparison }),
  };
}

function parseMetrics(value: unknown): AnalyticsMetric[] {
  if (!Array.isArray(value)) throw new Error("analytics_read_model_metrics_invalid");
  return value.map(parseMetric);
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
      const metrics = parseMetrics(data.metrics);
      const { data: connection, error: connectionError } = await getSupabaseAdmin()
        .from("integration_connections")
        .select("status,revoked_at")
        .eq("id", data.connection_id)
        .maybeSingle();
      if (connectionError) throw new Error(connectionError.message);
      if (!connection || connection.revoked_at) {
        return {
          provider,
          status: "unavailable",
          checkedAt: data.checked_at,
          message: "The owning Integration connection is unavailable or revoked.",
          metrics: [],
        };
      }
      const connectionStatus = connection.status;
      const sourceTime = Date.parse(data.source_updated_at);
      const stale = !Number.isFinite(sourceTime) || sourceTime < Date.now() - 48 * 60 * 60_000;
      const storedStatus = data.status;
      const status = storedStatus === "unavailable" || metrics.length === 0
        ? "unavailable"
        : storedStatus === "partial" || connectionStatus !== "connected" || stale
          ? "partial"
          : "ready";
      return {
        provider,
        status,
        checkedAt: data.checked_at,
        message: stale && metrics.length
          ? "Synchronized provider data is stale; the last valid metrics remain visible as partial."
          : data.message,
        metrics: status === "unavailable" ? [] : metrics,
      };
    },
  };
}
