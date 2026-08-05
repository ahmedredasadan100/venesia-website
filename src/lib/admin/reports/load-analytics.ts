import "server-only";

import {
  createAnalyticsProviderRegistry,
  type AnalyticsSnapshot,
} from "./analytics-contract";

// This is the single server composition root. Provider-specific adapters are
// registered here; Reports never import a provider SDK or provider API.
const analyticsRegistry = createAnalyticsProviderRegistry([]);

export async function loadAnalyticsSnapshot(): Promise<AnalyticsSnapshot> {
  return analyticsRegistry.load();
}
