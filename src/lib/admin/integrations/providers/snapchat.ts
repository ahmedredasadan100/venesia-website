import "server-only";

import type { AnalyticsMetric } from "../../reports/analytics-contract";
import { assertRequiredAssets, type IntegrationAsset } from "../integrations-contract";
import type { IntegrationProviderAdapter, ProviderRuntimeContext, ProviderSyncResult, ProviderTokenSet } from "../provider-adapter-contract";
import { formBody, isoAfterSeconds, providerJson } from "../provider-http";
import { assertGrantedScopes, configuredEnvironment, dateRange, finiteNumber, metric, requireAsset, requireConfigured, splitScopes, uniqueAssets } from "./shared";

const SNAP_AUTH = "https://accounts.snapchat.com/login/oauth2/authorize";
const SNAP_TOKEN = "https://accounts.snapchat.com/login/oauth2/access_token";
const SNAP_API = "https://adsapi.snapchat.com/v1";

function config() {
  return configuredEnvironment(["SNAPCHAT_MARKETING_CLIENT_ID", "SNAPCHAT_MARKETING_CLIENT_SECRET", "INTEGRATIONS_OAUTH_BASE_URL"]);
}

function headers(token: string) {
  return { authorization: `Bearer ${token}` };
}

type SnapToken = { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };

function snapTokenSet(payload: SnapToken, fallbackRefresh: string | null = null): ProviderTokenSet {
  if (!payload.access_token) throw new Error("snapchat_access_token_missing");
  return {
    strategy: { kind: "snap_oauth_refresh", refreshSupported: true }, accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? fallbackRefresh, accessExpiresAt: isoAfterSeconds(payload.expires_in),
    refreshExpiresAt: null, grantedScopes: splitScopes(payload.scope), externalSubjectId: null,
  };
}

function unwrapEntries(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object") return [] as Record<string, unknown>[];
  const value = (payload as Record<string, unknown>)[key];
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): Record<string, unknown>[] => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const nested = record[key.slice(0, -1)] ?? record.organization ?? record.adaccount ?? record.pixel;
    return nested && typeof nested === "object" ? [nested as Record<string, unknown>] : [record];
  });
}

function snapNextLink(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const paging = record.paging && typeof record.paging === "object" ? record.paging as Record<string, unknown> : null;
  const value = paging?.next_link ?? paging?.next;
  if (typeof value !== "string" || !value) return null;
  const url = new URL(value, SNAP_API);
  if (url.protocol !== "https:" || url.hostname !== "adsapi.snapchat.com") {
    throw new Error("snapchat_pagination_url_invalid");
  }
  return url.toString();
}

async function collectSnapEntries(
  initialUrl: string,
  accessToken: string,
  errorCode: string,
  key: string,
) {
  const entries: Record<string, unknown>[] = [];
  let url: string | null = initialUrl;
  for (let page = 0; page < 100 && url; page += 1) {
    const payload: unknown = await providerJson<unknown>(url, { headers: headers(accessToken) }, errorCode);
    entries.push(...unwrapEntries(payload, key));
    url = snapNextLink(payload);
  }
  if (url) throw new Error(`${errorCode}_pagination_limit_exceeded`);
  return entries;
}

async function discoverSnap(input: ProviderRuntimeContext) {
  const organizations = await collectSnapEntries(`${SNAP_API}/me/organizations`, input.accessToken, "snapchat_organization_discovery_failed", "organizations");
  const assets: IntegrationAsset[] = [];
  for (const organization of organizations) {
    const organizationId = String(organization.id ?? "");
    if (!organizationId) continue;
    assets.push({ type: "organization", externalId: organizationId, parentExternalId: null, displayName: String(organization.name ?? organizationId), permissions: Array.isArray(organization.roles) ? organization.roles.filter((item): item is string => typeof item === "string") : [], metadata: {} });
    const accounts = await collectSnapEntries(`${SNAP_API}/organizations/${organizationId}/adaccounts`, input.accessToken, "snapchat_ad_account_discovery_failed", "adaccounts");
    for (const account of accounts) {
      const accountId = String(account.id ?? "");
      if (!accountId) continue;
      assets.push({ type: "ad_account", externalId: accountId, parentExternalId: organizationId, displayName: String(account.name ?? accountId), permissions: Array.isArray(account.roles) ? account.roles.filter((item): item is string => typeof item === "string") : [], metadata: { status: String(account.status ?? ""), currency: String(account.currency ?? ""), timeZone: String(account.timezone ?? "") } });
    }
    const pixels = await collectSnapEntries(`${SNAP_API}/organizations/${organizationId}/pixels`, input.accessToken, "snapchat_pixel_discovery_failed", "pixels");
    for (const pixel of pixels) {
      const pixelId = String(pixel.id ?? "");
      if (!pixelId) continue;
      assets.push({ type: "pixel", externalId: pixelId, parentExternalId: organizationId, displayName: String(pixel.name ?? pixelId), permissions: ["read"], metadata: { status: String(pixel.status ?? "") } });
    }
  }
  return uniqueAssets(assets);
}

function snapStatsRows(payload: unknown) {
  const output: Array<{ id: string; name: string; stats: Record<string, unknown> }> = [];
  const groups = unwrapEntries(payload, "timeseries_stats").concat(unwrapEntries(payload, "total_stats"));
  for (const group of groups) {
    const stats = group.stats && typeof group.stats === "object" ? group.stats as Record<string, unknown> : group;
    output.push({ id: String(group.id ?? group.campaign_id ?? ""), name: String(group.name ?? group.id ?? "Snapchat Ads"), stats });
  }
  return output;
}

async function syncSnap(input: ProviderRuntimeContext): Promise<ProviderSyncResult> {
  const account = requireAsset(input.assets, "ad_account");
  const query = { period: "last_30_days", compare: "none" } as const;
  const range = dateRange(30);
  const url = new URL(`${SNAP_API}/adaccounts/${account.externalId}/stats`);
  url.searchParams.set("granularity", "TOTAL");
  url.searchParams.set("fields", "impressions,swipes,spend,conversion_purchases,conversion_leads");
  url.searchParams.set("start_time", `${range.start}T00:00:00.000Z`);
  url.searchParams.set("end_time", `${range.end}T23:59:59.999Z`);
  const payload = await providerJson<unknown>(url.toString(), { headers: headers(input.accessToken) }, "snapchat_ads_sync_failed");
  const rows = snapStatsRows(payload);
  const metrics: AnalyticsMetric[] = [];
  let leads = 0;
  let swipes = 0;
  for (const row of rows) {
    const rowLeads = finiteNumber(row.stats.conversion_leads) + finiteNumber(row.stats.conversion_purchases);
    const rowSwipes = finiteNumber(row.stats.swipes);
    leads += rowLeads;
    swipes += rowSwipes;
    metrics.push(metric({ key: "business.campaign_performance", label: row.name, value: rowLeads, unit: "count", periodStart: range.startIso, periodEnd: range.endIso, dimensions: { provider: "snapchat_ads", campaignId: row.id, impressions: String(finiteNumber(row.stats.impressions)), swipes: String(rowSwipes), spend: String(finiteNumber(row.stats.spend)) } }));
  }
  if (leads > 0 || swipes > 0) {
    metrics.unshift(
      metric({ key: "business.leads", label: "Snapchat conversions", value: leads, unit: "count", periodStart: range.startIso, periodEnd: range.endIso, dimensions: { provider: "snapchat_ads" } }),
      metric({ key: "business.conversion_rate", label: "Snapchat conversion rate", value: swipes ? leads / swipes : 0, unit: "ratio", periodStart: range.startIso, periodEnd: range.endIso, dimensions: { provider: "snapchat_ads" } }),
    );
  }
  return {
    status: metrics.length ? "completed" : "partial", message: metrics.length ? "Snapchat Ads read model synchronized." : "Snapchat returned no report metrics.",
    recordsWritten: metrics.length, watermark: { adAccountId: account.externalId, periodEnd: range.end }, connectionReadModelValid: true,
    analytics: [{ provider: "snapchat_ads", status: metrics.length ? "ready" : "unavailable", checkedAt: new Date().toISOString(), message: metrics.length ? "Real Snapchat Ads metrics synchronized." : "Snapchat returned no metrics.", metrics, query, sourceUpdatedAt: new Date().toISOString(), watermark: { adAccountId: account.externalId } }],
  };
}

export const snapchatAdsAdapter: IntegrationProviderAdapter = {
  integration: "snapchat_ads",
  analyticsProvider: "snapchat_ads",
  configuration: config,
  buildAuthorizationRequest(context) {
    requireConfigured(config());
    const url = new URL(SNAP_AUTH);
    url.searchParams.set("client_id", process.env.SNAPCHAT_MARKETING_CLIENT_ID!.trim());
    url.searchParams.set("redirect_uri", context.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "snapchat-marketing-api");
    url.searchParams.set("state", context.state);
    return { url: url.toString(), pkceVerifierRequired: false };
  },
  async exchangeAuthorizationCode(input) {
    requireConfigured(config());
    const payload = await providerJson<SnapToken>(SNAP_TOKEN, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: formBody({ grant_type: "authorization_code", client_id: process.env.SNAPCHAT_MARKETING_CLIENT_ID!.trim(), client_secret: process.env.SNAPCHAT_MARKETING_CLIENT_SECRET!.trim(), code: input.code, redirect_uri: input.redirectUri }),
    }, "snapchat_oauth_exchange_failed");
    const tokens = snapTokenSet(payload);
    assertGrantedScopes(tokens.grantedScopes, ["snapchat-marketing-api"], "snapchat_oauth_scope_missing");
    return tokens;
  },
  async refreshCredential(input) {
    if (!input.refreshToken) throw new Error("snapchat_refresh_token_missing");
    const payload = await providerJson<SnapToken>(SNAP_TOKEN, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: formBody({ grant_type: "refresh_token", client_id: process.env.SNAPCHAT_MARKETING_CLIENT_ID!.trim(), client_secret: process.env.SNAPCHAT_MARKETING_CLIENT_SECRET!.trim(), refresh_token: input.refreshToken }),
    }, "snapchat_oauth_refresh_failed");
    return snapTokenSet(payload, input.refreshToken);
  },
  discoverAssets: discoverSnap,
  validateAssetSelection(assets) {
    assertRequiredAssets("snapchat_ads", assets);
    const organization = requireAsset(assets, "organization");
    const account = requireAsset(assets, "ad_account");
    if (account.parentExternalId !== organization.externalId) throw new Error("snapchat_asset_relationship_invalid");
    if (assets.some((asset) => asset.type === "pixel" && asset.selected !== false && asset.parentExternalId !== organization.externalId)) throw new Error("snapchat_pixel_relationship_invalid");
  },
  async testConnection(input) {
    try {
      this.validateAssetSelection(input.assets);
      const account = requireAsset(input.assets, "ad_account");
      await providerJson(`${SNAP_API}/adaccounts/${account.externalId}`, { headers: headers(input.accessToken) }, "snapchat_connection_test_failed");
      return { ok: true, checkedAt: new Date().toISOString(), message: "Snapchat Ad Account access verified.", requiresReauth: false, diagnosticCode: "integration_test_ok" };
    } catch (error) {
      const requiresReauth = Boolean(error && typeof error === "object" && "requiresReauth" in error && (error as { requiresReauth?: unknown }).requiresReauth);
      return { ok: false, checkedAt: new Date().toISOString(), message: error instanceof Error ? error.message : "Snapchat test failed.", requiresReauth, diagnosticCode: "snapchat_connection_test_failed" };
    }
  },
  syncAnalytics: syncSnap,
  async revokeConnection() {
    // Snap Marketing OAuth documents refresh but no server revocation endpoint.
    // Disconnect deletes Vault credentials; user-side app revocation remains available in Snap Business Manager.
    return { providerRevoked: false, message: "Local Vault credentials were deleted; provider-side revocation remains a Snap Business Manager action." };
  },
  async diagnoseConnection(input) {
    const test = await this.testConnection(input);
    return { status: test.ok ? "ready" : "unavailable", code: test.diagnosticCode, message: test.message, checkedAt: test.checkedAt, requiresReauth: test.requiresReauth, metadata: { refreshSupported: true, selectedAssets: input.assets.filter((asset) => asset.selected).length } };
  },
};
