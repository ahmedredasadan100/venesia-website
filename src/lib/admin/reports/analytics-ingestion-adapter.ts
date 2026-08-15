import "server-only";

import type { Json } from "../../database.types";
import { getSupabaseAdmin } from "../../supabase-admin";
import type {
  AnalyticsIngestionModel,
} from "../integrations/provider-adapter-contract";
import type { AnalyticsMetric } from "./analytics-contract";
import {
  ANALYTICS_PROVIDER_DEFINITIONS,
  assertAnalyticsProviderResult,
} from "./analytics-contract";

function analyticsJsonValue(value: unknown): Json | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") throw new TypeError("analytics_json_bigint_unsupported");
  if (value === undefined || typeof value === "function" || typeof value === "symbol") {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((item) => analyticsJsonValue(item) ?? null);
  }
  if (!value || typeof value !== "object") return undefined;
  if ("toJSON" in value && typeof value.toJSON === "function") {
    return analyticsJsonValue(value.toJSON());
  }
  const result: { [key: string]: Json | undefined } = {};
  for (const [key, item] of Object.entries(value)) {
    const mapped = analyticsJsonValue(item);
    if (mapped !== undefined) result[key] = mapped;
  }
  return result;
}

function analyticsMetricJson(metric: AnalyticsMetric): Json {
  return {
    key: metric.key,
    label: metric.label,
    value: metric.value,
    unit: metric.unit,
    periodStart: metric.periodStart,
    periodEnd: metric.periodEnd,
    dimensions: metric.dimensions ? { ...metric.dimensions } : undefined,
    comparison: metric.comparison
      ? {
          value: metric.comparison.value,
          periodStart: metric.comparison.periodStart,
          periodEnd: metric.comparison.periodEnd,
          changeRatio: metric.comparison.changeRatio,
        }
      : undefined,
  };
}

export async function ingestAnalyticsModel(
  connectionId: string,
  model: AnalyticsIngestionModel,
) {
  const definition = ANALYTICS_PROVIDER_DEFINITIONS.find((item) => item.key === model.provider);
  if (!definition) throw new Error(`analytics_ingestion_provider_unknown:${model.provider}`);
  assertAnalyticsProviderResult(definition, model, model.query);
  const { error } = await getSupabaseAdmin().rpc("ingest_analytics_provider_read_model", {
    p_connection_id: connectionId,
    p_provider_key: model.provider,
    p_period_key: model.query.period,
    p_compare_key: model.query.compare,
    p_status: model.status,
    p_message: model.message,
    p_metrics: model.metrics.map(analyticsMetricJson),
    p_source_updated_at: model.sourceUpdatedAt,
    p_watermark: analyticsJsonValue(model.watermark) ?? {},
  });
  if (error) throw new Error(error.message);
}
