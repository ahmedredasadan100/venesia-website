import "server-only";

import { getSupabaseAdmin } from "../../supabase-admin";
import type { AnalyticsIngestionModel } from "../integrations/provider-adapter-contract";
import {
  ANALYTICS_PROVIDER_DEFINITIONS,
  assertAnalyticsProviderResult,
} from "./analytics-contract";

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
    p_metrics: model.metrics,
    p_source_updated_at: model.sourceUpdatedAt,
    p_watermark: model.watermark,
  });
  if (error) throw new Error(error.message);
}
