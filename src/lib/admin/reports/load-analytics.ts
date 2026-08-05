import "server-only";

import {
  createAnalyticsProviderRegistry,
  type AnalyticsQueryContext,
  type AnalyticsSnapshot,
} from "./analytics-contract";
import { createAnalyticsReadModelAdapter } from "./analytics-read-model-adapter";

// This is the single server composition root. Provider-specific adapters are
// registered here; Reports never import a provider SDK or provider API.
const analyticsRegistry = createAnalyticsProviderRegistry([
  createAnalyticsReadModelAdapter("google_analytics_4"),
  createAnalyticsReadModelAdapter("google_search_console"),
  createAnalyticsReadModelAdapter("google_ads"),
  createAnalyticsReadModelAdapter("meta_marketing"),
  createAnalyticsReadModelAdapter("tiktok_ads"),
  createAnalyticsReadModelAdapter("snapchat_ads"),
]);

export async function loadAnalyticsSnapshot(
  query?: AnalyticsQueryContext,
): Promise<AnalyticsSnapshot> {
  return analyticsRegistry.load(query);
}
