import "server-only";

import type { AnalyticsMetric } from "../../reports/analytics-contract";
import { assertRequiredAssets, type IntegrationAsset } from "../integrations-contract";
import type { IntegrationProviderAdapter, ProviderRuntimeContext, ProviderSyncResult, ProviderTokenSet } from "../provider-adapter-contract";
import { formBody, isoAfterSeconds, providerJson } from "../provider-http";
import { resolveIntegrationApplicationConfiguration } from "../server-configuration-resolver";
import { assertGrantedScopes, dateRange, finiteNumber, metric, requireAsset, uniqueAssets } from "./shared";
import {
  collectMetaGraphPages,
  metaGraphBase,
  requireMetaApplicationCredentials,
  testMetaApplicationConfiguration,
} from "./meta-graph";

function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` };
}

type MetaToken = { access_token?: string; token_type?: string; expires_in?: number };

async function grantedPermissions(accessToken: string) {
  const rows = await collectMetaGraphPages<{ permission?: string; status?: string }>(
    `${metaGraphBase()}/me/permissions?fields=permission,status&limit=100`,
    accessToken,
    "meta_permission_discovery_failed",
  );
  return rows.filter((item) => item.status === "granted" && item.permission).map((item) => item.permission!);
}

async function discoverMetaAssets(accessToken: string) {
  const businesses = await collectMetaGraphPages<{ id?: string; name?: string }>(
    `${metaGraphBase()}/me/businesses?fields=id,name&limit=100`,
    accessToken,
    "meta_business_discovery_failed",
  );
  const assets: IntegrationAsset[] = [];
  for (const business of businesses) {
    if (!business.id) continue;
    assets.push({ type: "business", externalId: business.id, parentExternalId: null, displayName: business.name ?? business.id, permissions: ["business_management"], metadata: {} });
    const accounts = await collectMetaGraphPages<Record<string, unknown>>(
      `${metaGraphBase()}/${business.id}/owned_ad_accounts?fields=id,name,account_status,currency,timezone_name&limit=100`,
      accessToken,
      "meta_ad_account_discovery_failed",
    );
    for (const account of accounts) {
      const id = String(account.id ?? "").replace(/^act_/, "");
      if (!id) continue;
      assets.push({
        type: "ad_account", externalId: id, parentExternalId: business.id,
        displayName: String(account.name ?? id), permissions: ["ads_read"],
        metadata: { status: Number(account.account_status ?? 0), currency: String(account.currency ?? ""), timeZone: String(account.timezone_name ?? "") },
      });
      const pixels = await collectMetaGraphPages<Record<string, unknown>>(
        `${metaGraphBase()}/act_${id}/adspixels?fields=id,name,last_fired_time&limit=100`,
        accessToken,
        "meta_pixel_discovery_failed",
      );
      for (const pixel of pixels) {
        const pixelId = String(pixel.id ?? "");
        if (!pixelId) continue;
        assets.push({
          type: "pixel", externalId: pixelId, parentExternalId: id,
          displayName: String(pixel.name ?? pixelId), permissions: ["ads_read"],
          metadata: { lastFiredAt: typeof pixel.last_fired_time === "string" ? pixel.last_fired_time : null },
        });
      }
    }
  }
  return uniqueAssets(assets);
}

function extractActionValue(actions: unknown, wanted: string[]) {
  if (!Array.isArray(actions)) return 0;
  return actions.reduce((sum, item) => {
    if (!item || typeof item !== "object") return sum;
    const row = item as Record<string, unknown>;
    return wanted.includes(String(row.action_type)) ? sum + finiteNumber(row.value) : sum;
  }, 0);
}

async function syncMeta(input: ProviderRuntimeContext): Promise<ProviderSyncResult> {
  const account = requireAsset(input.assets, "ad_account");
  const query = { period: "last_30_days", compare: "none" } as const;
  const range = dateRange(30);
  const url = new URL(`${metaGraphBase()}/act_${account.externalId}/insights`);
  url.searchParams.set("fields", "campaign_id,campaign_name,impressions,clicks,spend,actions");
  url.searchParams.set("level", "campaign");
  url.searchParams.set("time_range", JSON.stringify({ since: range.start, until: range.end }));
  url.searchParams.set("limit", "500");
  const rows = await collectMetaGraphPages<Record<string, unknown>>(url.toString(), input.accessToken, "meta_marketing_sync_failed");
  const metrics: AnalyticsMetric[] = [];
  let leads = 0;
  let clicks = 0;
  for (const row of rows) {
    const campaignLeads = extractActionValue(row.actions, ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"]);
    const campaignClicks = finiteNumber(row.clicks);
    leads += campaignLeads;
    clicks += campaignClicks;
    metrics.push(metric({
      key: "business.campaign_performance", label: String(row.campaign_name ?? row.campaign_id ?? "Meta campaign"), value: campaignLeads,
      unit: "count", periodStart: range.startIso, periodEnd: range.endIso,
      dimensions: { provider: "meta_marketing", campaignId: String(row.campaign_id ?? ""), impressions: String(finiteNumber(row.impressions)), clicks: String(campaignClicks), spend: String(finiteNumber(row.spend)) },
    }));
  }
  if (leads > 0 || clicks > 0) {
    metrics.unshift(
      metric({ key: "business.leads", label: "Meta leads", value: leads, unit: "count", periodStart: range.startIso, periodEnd: range.endIso, dimensions: { provider: "meta_marketing" } }),
      metric({ key: "business.conversion_rate", label: "Meta lead rate", value: clicks ? leads / clicks : 0, unit: "ratio", periodStart: range.startIso, periodEnd: range.endIso, dimensions: { provider: "meta_marketing" } }),
    );
  }
  return {
    status: metrics.length ? "completed" : "partial",
    message: metrics.length ? "Meta campaign read model synchronized." : "Meta returned no campaign metrics.",
    recordsWritten: metrics.length,
    watermark: { adAccountId: account.externalId, periodEnd: range.end },
    connectionReadModelValid: true,
    analytics: [{ provider: "meta_marketing", status: metrics.length ? "ready" : "unavailable", checkedAt: new Date().toISOString(), message: metrics.length ? "Real Meta Marketing metrics synchronized." : "Meta returned no metrics.", metrics, query, sourceUpdatedAt: new Date().toISOString(), watermark: { adAccountId: account.externalId } }],
  };
}

export const metaMarketingAdapter: IntegrationProviderAdapter = {
  integration: "meta_business",
  analyticsProvider: "meta_marketing",
  configuration() {
    return resolveIntegrationApplicationConfiguration("meta_business");
  },
  testApplicationConfiguration() {
    return testMetaApplicationConfiguration("meta_business");
  },
  async buildAuthorizationRequest(context) {
    const credentials = await requireMetaApplicationCredentials("meta_business");
    const url = new URL(`https://www.facebook.com/${metaGraphBase().split("/").at(-1)}/dialog/oauth`);
    url.searchParams.set("client_id", credentials.appId);
    url.searchParams.set("redirect_uri", context.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "ads_read,business_management");
    url.searchParams.set("state", context.state);
    return { url: url.toString(), pkceVerifierRequired: false };
  },
  async exchangeAuthorizationCode(input): Promise<ProviderTokenSet> {
    const credentials = await requireMetaApplicationCredentials("meta_business");
    const tokenEndpoint = `${metaGraphBase()}/oauth/access_token`;
    const short = await providerJson<MetaToken>(tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: formBody({
        client_id: credentials.appId,
        client_secret: credentials.appSecret,
        redirect_uri: input.redirectUri,
        code: input.code,
      }),
    }, "meta_oauth_exchange_failed");
    if (!short.access_token) throw new Error("meta_oauth_access_token_missing");
    const long = await providerJson<MetaToken>(tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: formBody({
        grant_type: "fb_exchange_token",
        client_id: credentials.appId,
        client_secret: credentials.appSecret,
        fb_exchange_token: short.access_token,
      }),
    }, "meta_long_lived_token_exchange_failed");
    const accessToken = long.access_token ?? short.access_token;
    const grantedScopes = await grantedPermissions(accessToken);
    assertGrantedScopes(grantedScopes, ["ads_read", "business_management"], "meta_oauth_scope_missing");
    const me = await providerJson<{ id?: string }>(`${metaGraphBase()}/me?fields=id`, { headers: authHeaders(accessToken) }, "meta_subject_lookup_failed");
    return {
      strategy: { kind: "meta_user", refreshSupported: false }, accessToken, refreshToken: null,
      accessExpiresAt: isoAfterSeconds(long.expires_in ?? short.expires_in), refreshExpiresAt: null,
      grantedScopes, externalSubjectId: me.id ?? null,
    };
  },
  async refreshCredential() { return null; },
  async discoverAssets(input) { return discoverMetaAssets(input.accessToken); },
  validateAssetSelection(assets) {
    assertRequiredAssets("meta_business", assets);
    const business = requireAsset(assets, "business");
    const account = requireAsset(assets, "ad_account");
    if (account.parentExternalId !== business.externalId) throw new Error("meta_asset_relationship_invalid");
    const pixels = assets.filter((asset) => asset.type === "pixel" && asset.selected !== false);
    if (pixels.some((pixel) => pixel.parentExternalId !== account.externalId)) throw new Error("meta_pixel_relationship_invalid");
  },
  async testConnection(input) {
    try {
      this.validateAssetSelection(input.assets);
      const account = requireAsset(input.assets, "ad_account");
      await providerJson(`${metaGraphBase()}/act_${account.externalId}?fields=id,name,account_status`, { headers: authHeaders(input.accessToken) }, "meta_connection_test_failed");
      return { ok: true, checkedAt: new Date().toISOString(), message: "Meta Ad Account access verified.", requiresReauth: false, diagnosticCode: "integration_test_ok" };
    } catch (error) {
      const requiresReauth = Boolean(error && typeof error === "object" && "requiresReauth" in error && (error as { requiresReauth?: unknown }).requiresReauth);
      return { ok: false, checkedAt: new Date().toISOString(), message: error instanceof Error ? error.message : "Meta test failed.", requiresReauth, diagnosticCode: "meta_connection_test_failed" };
    }
  },
  syncAnalytics: syncMeta,
  async revokeConnection() {
    return {
      providerRevoked: false,
      message: "Local Vault credentials were deleted. Meta app-level deauthorization is intentionally external because it can revoke other independent Meta connections.",
    };
  },
  async diagnoseConnection(input) {
    const test = await this.testConnection(input);
    return { status: test.ok ? "ready" : "unavailable", code: test.diagnosticCode, message: test.message, checkedAt: test.checkedAt, requiresReauth: test.requiresReauth, metadata: { refreshSupported: false, selectedAssets: input.assets.filter((asset) => asset.selected).length } };
  },
};
