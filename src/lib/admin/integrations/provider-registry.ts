import "server-only";

import { createIntegrationProviderRegistry } from "./provider-adapter-contract";
import { googleAdsAdapter, googleAnalyticsAdapter, googleSearchConsoleAdapter } from "./providers/google";
import { metaMarketingAdapter } from "./providers/meta";
import { snapchatAdsAdapter } from "./providers/snapchat";
import { tiktokAdsAdapter } from "./providers/tiktok";
import { whatsappBusinessAdapter } from "./providers/whatsapp";

// Single provider composition root. Architecture guards prohibit provider API
// hosts and SDKs outside this registry subtree.
export const integrationProviderRegistry = createIntegrationProviderRegistry([
  googleAnalyticsAdapter,
  googleSearchConsoleAdapter,
  googleAdsAdapter,
  metaMarketingAdapter,
  tiktokAdsAdapter,
  snapchatAdsAdapter,
  whatsappBusinessAdapter,
]);
