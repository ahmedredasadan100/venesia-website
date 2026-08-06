import "server-only";

import type { AnalyticsMetric } from "../../reports/analytics-contract";
import { assertRequiredAssets, type IntegrationAsset } from "../integrations-contract";
import type { IntegrationProviderAdapter, ProviderRuntimeContext, ProviderSyncResult, ProviderTokenSet } from "../provider-adapter-contract";
import { providerJson } from "../provider-http";
import {
  requireApplicationConfigurationValue,
  requireIntegrationApplicationConfiguration,
  resolveIntegrationApplicationConfiguration,
} from "../server-configuration-resolver";
import { dateRange, finiteNumber, metric, requireAsset, splitScopes, uniqueAssets } from "./shared";

const TIKTOK_BASE = "https://business-api.tiktok.com/open_api/v1.3";
const TIKTOK_AUTHORIZATION = "https://ads.tiktok.com/marketing_api/auth";

function headers(accessToken: string) {
  return { "Access-Token": accessToken, "content-type": "application/json" };
}

function unwrap<T>(payload: { code?: number; message?: string; data?: T }, code: string): T {
  if (payload.code != null && payload.code !== 0) throw new Error(`${code}:${payload.code}`);
  if (!payload.data) throw new Error(`${code}_data_missing`);
  return payload.data;
}

type TikTokTokenData = {
  access_token?: string;
  advertiser_ids?: string[];
  scope?: string[] | string;
};

type TikTokPageInfo = {
  page?: number;
  page_size?: number;
  total_page?: number;
  total_number?: number;
};

async function collectTikTokPages<T>(input: {
  url: URL;
  accessToken: string;
  code: string;
  rows: (data: Record<string, unknown>) => T[];
}) {
  const rows: T[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const url = new URL(input.url);
    url.searchParams.set("page", String(page));
    if (!url.searchParams.has("page_size")) url.searchParams.set("page_size", "100");
    const payload = await providerJson<{ code?: number; message?: string; data?: Record<string, unknown> }>(
      url.toString(),
      { headers: headers(input.accessToken) },
      input.code,
    );
    const data = unwrap(payload, input.code);
    const pageRows = input.rows(data);
    rows.push(...pageRows);
    const pageInfo = data.page_info as TikTokPageInfo | undefined;
    const totalPages = Number(pageInfo?.total_page ?? 0);
    if ((totalPages > 0 && page >= totalPages) || (totalPages <= 0 && pageRows.length < Number(url.searchParams.get("page_size")))) {
      return rows;
    }
  }
  throw new Error(`${input.code}_pagination_limit_exceeded`);
}

function advertiserIds(input: ProviderRuntimeContext) {
  if (!input.externalSubjectId) return [];
  try {
    const value = JSON.parse(input.externalSubjectId) as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return input.externalSubjectId.split(",").map((item) => item.trim()).filter(Boolean);
  }
}

async function discoverTikTok(input: ProviderRuntimeContext) {
  const ids = advertiserIds(input);
  if (!ids.length) throw new Error("tiktok_authorized_advertisers_missing");
  const infoUrl = new URL(`${TIKTOK_BASE}/advertiser/info/`);
  infoUrl.searchParams.set("advertiser_ids", JSON.stringify(ids));
  infoUrl.searchParams.set("fields", JSON.stringify(["advertiser_id", "name", "currency", "timezone", "status"]));
  const infoPayload = await providerJson<{ code?: number; message?: string; data?: { list?: Array<Record<string, unknown>> } }>(infoUrl.toString(), { headers: headers(input.accessToken) }, "tiktok_advertiser_discovery_failed");
  const list = unwrap(infoPayload, "tiktok_advertiser_discovery_failed").list ?? [];
  const assets: IntegrationAsset[] = [];
  const businessCentersUrl = new URL(`${TIKTOK_BASE}/bc/get/`);
  const businessCenters = await collectTikTokPages<Record<string, unknown>>({
    url: businessCentersUrl,
    accessToken: input.accessToken,
    code: "tiktok_business_center_discovery_failed",
    rows: (data) => {
      const value = data.list ?? data.bc_list;
      return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
    },
  });
  for (const businessCenter of businessCenters) {
    const id = String(businessCenter.bc_id ?? businessCenter.id ?? "");
    if (!id) continue;
    assets.push({
      type: "business_center",
      externalId: id,
      parentExternalId: null,
      displayName: String(businessCenter.bc_name ?? businessCenter.name ?? id),
      permissions: ["read_business_center"],
      metadata: {
        role: String(businessCenter.user_role ?? businessCenter.role ?? ""),
        status: String(businessCenter.status ?? ""),
      },
    });
  }
  for (const advertiser of list) {
    const id = String(advertiser.advertiser_id ?? "");
    if (!id) continue;
    assets.push({
      type: "advertiser", externalId: id, parentExternalId: null,
      displayName: String(advertiser.name ?? id), permissions: ["reporting"],
      metadata: { currency: String(advertiser.currency ?? ""), timeZone: String(advertiser.timezone ?? ""), status: String(advertiser.status ?? "") },
    });
    const pixelUrl = new URL(`${TIKTOK_BASE}/pixel/list/`);
    pixelUrl.searchParams.set("advertiser_id", id);
    const pixels = await collectTikTokPages<Record<string, unknown>>({
      url: pixelUrl,
      accessToken: input.accessToken,
      code: "tiktok_pixel_discovery_failed",
      rows: (data) => {
        const value = data.pixels ?? data.list;
        return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
      },
    });
    for (const pixel of pixels) {
      const pixelId = String(pixel.pixel_code ?? pixel.pixel_id ?? "");
      if (!pixelId) continue;
      assets.push({ type: "pixel", externalId: pixelId, parentExternalId: id, displayName: String(pixel.pixel_name ?? pixel.name ?? pixelId), permissions: ["read"], metadata: { status: String(pixel.status ?? "") } });
    }
  }
  return uniqueAssets(assets);
}

async function syncTikTok(input: ProviderRuntimeContext): Promise<ProviderSyncResult> {
  const advertiser = requireAsset(input.assets, "advertiser");
  const query = { period: "last_30_days", compare: "none" } as const;
  const range = dateRange(30);
  const url = new URL(`${TIKTOK_BASE}/report/integrated/get/`);
  url.searchParams.set("advertiser_id", advertiser.externalId);
  url.searchParams.set("service_type", "AUCTION");
  url.searchParams.set("report_type", "BASIC");
  url.searchParams.set("data_level", "AUCTION_CAMPAIGN");
  url.searchParams.set("dimensions", JSON.stringify(["campaign_id"]));
  url.searchParams.set("metrics", JSON.stringify(["campaign_name", "spend", "impressions", "clicks", "conversion"]));
  url.searchParams.set("start_date", range.start);
  url.searchParams.set("end_date", range.end);
  url.searchParams.set("page_size", "1000");
  const rows = await collectTikTokPages<{ dimensions?: Record<string, unknown>; metrics?: Record<string, unknown> }>({
    url,
    accessToken: input.accessToken,
    code: "tiktok_ads_sync_failed",
    rows: (data) => Array.isArray(data.list) ? data.list as Array<{ dimensions?: Record<string, unknown>; metrics?: Record<string, unknown> }> : [],
  });
  const metrics: AnalyticsMetric[] = [];
  let conversions = 0;
  let clicks = 0;
  for (const row of rows) {
    const values = row.metrics ?? {};
    const dimensions = row.dimensions ?? {};
    const rowConversions = finiteNumber(values.conversion);
    const rowClicks = finiteNumber(values.clicks);
    conversions += rowConversions;
    clicks += rowClicks;
    metrics.push(metric({
      key: "business.campaign_performance", label: String(values.campaign_name ?? dimensions.campaign_id ?? "TikTok campaign"),
      value: rowConversions, unit: "count", periodStart: range.startIso, periodEnd: range.endIso,
      dimensions: { provider: "tiktok_ads", campaignId: String(dimensions.campaign_id ?? ""), impressions: String(finiteNumber(values.impressions)), clicks: String(rowClicks), spend: String(finiteNumber(values.spend)) },
    }));
  }
  if (conversions > 0 || clicks > 0) {
    metrics.unshift(
      metric({ key: "business.leads", label: "TikTok conversions", value: conversions, unit: "count", periodStart: range.startIso, periodEnd: range.endIso, dimensions: { provider: "tiktok_ads" } }),
      metric({ key: "business.conversion_rate", label: "TikTok conversion rate", value: clicks ? conversions / clicks : 0, unit: "ratio", periodStart: range.startIso, periodEnd: range.endIso, dimensions: { provider: "tiktok_ads" } }),
    );
  }
  return {
    status: metrics.length ? "completed" : "partial", message: metrics.length ? "TikTok campaign read model synchronized." : "TikTok returned no campaign metrics.",
    recordsWritten: metrics.length, watermark: { advertiserId: advertiser.externalId, periodEnd: range.end }, connectionReadModelValid: true,
    analytics: [{ provider: "tiktok_ads", status: metrics.length ? "ready" : "unavailable", checkedAt: new Date().toISOString(), message: metrics.length ? "Real TikTok Ads metrics synchronized." : "TikTok returned no metrics.", metrics, query, sourceUpdatedAt: new Date().toISOString(), watermark: { advertiserId: advertiser.externalId } }],
  };
}

export const tiktokAdsAdapter: IntegrationProviderAdapter = {
  integration: "tiktok_ads",
  analyticsProvider: "tiktok_ads",
  configuration() {
    return resolveIntegrationApplicationConfiguration("tiktok_ads");
  },
  async testApplicationConfiguration() {
    const configuration = await resolveIntegrationApplicationConfiguration("tiktok_ads", {
      includeSecrets: true,
      allowUntested: true,
    });
    if (configuration.missing.length) {
      return { status: "configuration_invalid", safeErrorCode: "integration_app_configuration_incomplete", message: "Required TikTok application fields are missing." };
    }
    const appId = requireApplicationConfigurationValue(configuration, "tiktok_app_id");
    const appSecret = requireApplicationConfigurationValue(configuration, "tiktok_app_secret");
    if (!/^[A-Za-z0-9_-]{4,128}$/.test(appId) || appSecret.length < 8) {
      return { status: "configuration_invalid", safeErrorCode: "tiktok_app_credentials_format_invalid", message: "TikTok application credential format is invalid." };
    }
    return { status: "configuration_saved_waiting_for_authorization", safeErrorCode: null, message: "TikTok Marketing API requires an authorization code before it can verify the App ID and Secret." };
  },
  async buildAuthorizationRequest(context) {
    const configuration = await requireIntegrationApplicationConfiguration("tiktok_ads");
    const url = new URL(TIKTOK_AUTHORIZATION);
    url.searchParams.set("state", context.state);
    url.searchParams.set("app_id", requireApplicationConfigurationValue(configuration, "tiktok_app_id"));
    url.searchParams.set("redirect_uri", context.redirectUri);
    return { url: url.toString(), pkceVerifierRequired: false };
  },
  async exchangeAuthorizationCode(input): Promise<ProviderTokenSet> {
    const configuration = await requireIntegrationApplicationConfiguration("tiktok_ads");
    const payload = await providerJson<{ code?: number; message?: string; data?: TikTokTokenData }>(`${TIKTOK_BASE}/oauth2/access_token/`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        app_id: requireApplicationConfigurationValue(configuration, "tiktok_app_id"),
        secret: requireApplicationConfigurationValue(configuration, "tiktok_app_secret"),
        auth_code: input.code,
      }),
    }, "tiktok_oauth_exchange_failed");
    const data = unwrap(payload, "tiktok_oauth_exchange_failed");
    if (!data.access_token) throw new Error("tiktok_access_token_missing");
    return {
      strategy: { kind: "tiktok_marketing_long_lived", refreshSupported: false },
      accessToken: data.access_token, refreshToken: null, accessExpiresAt: null, refreshExpiresAt: null,
      grantedScopes: splitScopes(data.scope), externalSubjectId: JSON.stringify(data.advertiser_ids ?? []),
    };
  },
  async refreshCredential() { return null; },
  discoverAssets: discoverTikTok,
  validateAssetSelection(assets) {
    assertRequiredAssets("tiktok_ads", assets);
    const advertiser = requireAsset(assets, "advertiser");
    if (assets.some((asset) => asset.type === "pixel" && asset.selected !== false && asset.parentExternalId !== advertiser.externalId)) {
      throw new Error("tiktok_pixel_relationship_invalid");
    }
  },
  async testConnection(input) {
    try {
      this.validateAssetSelection(input.assets);
      const advertiser = requireAsset(input.assets, "advertiser");
      const url = new URL(`${TIKTOK_BASE}/advertiser/info/`);
      url.searchParams.set("advertiser_ids", JSON.stringify([advertiser.externalId]));
      url.searchParams.set("fields", JSON.stringify(["advertiser_id", "name", "status"]));
      await providerJson(url.toString(), { headers: headers(input.accessToken) }, "tiktok_connection_test_failed");
      return { ok: true, checkedAt: new Date().toISOString(), message: "TikTok Advertiser access verified.", requiresReauth: false, diagnosticCode: "integration_test_ok" };
    } catch (error) {
      const requiresReauth = Boolean(error && typeof error === "object" && "requiresReauth" in error && (error as { requiresReauth?: unknown }).requiresReauth);
      return { ok: false, checkedAt: new Date().toISOString(), message: error instanceof Error ? error.message : "TikTok test failed.", requiresReauth, diagnosticCode: "tiktok_connection_test_failed" };
    }
  },
  syncAnalytics: syncTikTok,
  async revokeConnection() {
    // TikTok Marketing API does not expose a refresh/revoke endpoint for the
    // long-lived advertiser token. Local Vault deletion closes this owner;
    // provider-side revocation remains an Ads Manager action.
    return { providerRevoked: false, message: "Local Vault credentials were deleted; provider-side revocation remains an Ads Manager action." };
  },
  async diagnoseConnection(input) {
    const test = await this.testConnection(input);
    return { status: test.ok ? "ready" : "unavailable", code: test.diagnosticCode, message: test.message, checkedAt: test.checkedAt, requiresReauth: test.requiresReauth, metadata: { refreshSupported: false, providerRevocationExternal: true, selectedAssets: input.assets.filter((asset) => asset.selected).length } };
  },
};
