import "server-only";

import type { AnalyticsMetric, AnalyticsProviderKey } from "../../reports/analytics-contract";
import { assertRequiredAssets, type IntegrationAsset, type LiveIntegrationKey } from "../integrations-contract";
import type {
  IntegrationProviderAdapter,
  ProviderRuntimeContext,
  ProviderSyncResult,
  ProviderTokenSet,
} from "../provider-adapter-contract";
import { formBody, isoAfterSeconds, providerJson, selectedAsset } from "../provider-http";
import {
  requireApplicationConfigurationValue,
  requireIntegrationApplicationConfiguration,
  resolveGoogleAdsApiVersion,
  resolveIntegrationApplicationConfiguration,
} from "../server-configuration-resolver";
import {
  assertGrantedScopes,
  dateRange,
  finiteNumber,
  metric,
  queryDays,
  requireAsset,
  splitScopes,
  uniqueAssets,
} from "./shared";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE = "https://oauth2.googleapis.com/revoke";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

type GoogleKind = "analytics" | "search_console" | "ads";

const GOOGLE_DEFINITIONS: Record<GoogleKind, {
  integration: LiveIntegrationKey;
  analyticsProvider: AnalyticsProviderKey;
  scopes: string[];
}> = {
  analytics: {
    integration: "google_analytics",
    analyticsProvider: "google_analytics_4",
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
  },
  search_console: {
    integration: "google_search_console",
    analyticsProvider: "google_search_console",
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  },
  ads: {
    integration: "google_ads",
    analyticsProvider: "google_ads",
    scopes: ["https://www.googleapis.com/auth/adwords"],
  },
};

function googleHeaders(accessToken: string, loginCustomerId?: string | null) {
  return {
    authorization: `Bearer ${accessToken}`,
    ...(loginCustomerId ? { "login-customer-id": loginCustomerId.replace(/\D/g, "") } : {}),
  };
}

async function googleAdsHeaders(accessToken: string, loginCustomerId?: string | null) {
  const configuration = await requireIntegrationApplicationConfiguration("google_ads");
  return {
    ...googleHeaders(accessToken, loginCustomerId),
    "developer-token": requireApplicationConfigurationValue(
      configuration,
      "google_ads_developer_token",
    ),
  };
}

async function exchangeGoogleCode(
  integration: LiveIntegrationKey,
  code: string,
  redirectUri: string,
  pkceVerifier: string | null,
) {
  const configuration = await requireIntegrationApplicationConfiguration(integration);
  return providerJson<GoogleTokenResponse>(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: formBody({
      client_id: requireApplicationConfigurationValue(configuration, "google_client_id"),
      client_secret: requireApplicationConfigurationValue(configuration, "google_client_secret"),
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      ...(pkceVerifier ? { code_verifier: pkceVerifier } : {}),
    }),
  }, "google_oauth_exchange_failed");
}

function tokenSet(payload: GoogleTokenResponse, fallbackRefresh: string | null = null): ProviderTokenSet {
  if (!payload.access_token) throw new Error("google_oauth_access_token_missing");
  return {
    strategy: { kind: "google_oauth_refresh", refreshSupported: true },
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? fallbackRefresh,
    accessExpiresAt: isoAfterSeconds(payload.expires_in),
    refreshExpiresAt: null,
    grantedScopes: splitScopes(payload.scope),
    externalSubjectId: null,
  };
}

async function refreshGoogle(input: ProviderRuntimeContext) {
  if (!input.refreshToken) throw new Error("google_oauth_refresh_token_missing");
  const configuration = await requireIntegrationApplicationConfiguration(input.integration);
  const payload = await providerJson<GoogleTokenResponse>(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: formBody({
      client_id: requireApplicationConfigurationValue(configuration, "google_client_id"),
      client_secret: requireApplicationConfigurationValue(configuration, "google_client_secret"),
      refresh_token: input.refreshToken,
      grant_type: "refresh_token",
    }),
  }, "google_oauth_refresh_failed");
  return tokenSet(payload, input.refreshToken);
}

async function discoverGa4(accessToken: string) {
  const assets: IntegrationAsset[] = [];
  let pageToken = "";
  do {
    const url = new URL("https://analyticsadmin.googleapis.com/v1alpha/accountSummaries");
    url.searchParams.set("pageSize", "200");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const payload = await providerJson<{ accountSummaries?: Array<Record<string, unknown>>; nextPageToken?: string }>(url.toString(), {
      headers: googleHeaders(accessToken),
    }, "google_analytics_asset_discovery_failed");
    for (const account of payload.accountSummaries ?? []) {
      const accountId = String(account.account ?? "");
      if (!accountId) continue;
      assets.push({
        type: "account", externalId: accountId, parentExternalId: null,
        displayName: String(account.displayName ?? accountId), permissions: ["analytics.readonly"], metadata: {},
      });
      const properties = Array.isArray(account.propertySummaries) ? account.propertySummaries : [];
      for (const raw of properties) {
        const property = raw as Record<string, unknown>;
        const propertyId = String(property.property ?? "");
        if (!propertyId) continue;
        assets.push({
          type: "property", externalId: propertyId, parentExternalId: accountId,
          displayName: String(property.displayName ?? propertyId), permissions: ["analytics.readonly"], metadata: {},
        });
      }
    }
    pageToken = payload.nextPageToken ?? "";
  } while (pageToken);
  return uniqueAssets(assets);
}

async function discoverSearchConsole(accessToken: string) {
  const payload = await providerJson<{ siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }> }>(
    "https://www.googleapis.com/webmasters/v3/sites",
    { headers: googleHeaders(accessToken) },
    "google_search_console_asset_discovery_failed",
  );
  return (payload.siteEntry ?? []).flatMap((site): IntegrationAsset[] => site.siteUrl ? [{
    type: "site",
    externalId: site.siteUrl,
    parentExternalId: null,
    displayName: site.siteUrl,
    permissions: site.permissionLevel ? [site.permissionLevel] : [],
    metadata: { permissionLevel: site.permissionLevel ?? null },
  }] : []);
}

function googleAdsVersion() {
  return resolveGoogleAdsApiVersion();
}

async function googleAdsSearch<T>(input: {
  accessToken: string;
  customerId: string;
  query: string;
  loginCustomerId?: string | null;
}) {
  const customerId = input.customerId.replace(/\D/g, "");
  const results: T[] = [];
  let pageToken = "";
  for (let page = 0; page < 100; page += 1) {
    const payload = await providerJson<{ results?: T[]; nextPageToken?: string }>(
      `https://googleads.googleapis.com/${googleAdsVersion()}/customers/${customerId}/googleAds:search`, {
      method: "POST",
      headers: { ...await googleAdsHeaders(input.accessToken, input.loginCustomerId), "content-type": "application/json" },
      body: JSON.stringify({ query: input.query, pageSize: 10000, ...(pageToken ? { pageToken } : {}) }),
    }, "google_ads_query_failed");
    results.push(...(payload.results ?? []));
    pageToken = payload.nextPageToken ?? "";
    if (!pageToken) return { results };
  }
  throw new Error("google_ads_query_pagination_limit_exceeded");
}

async function discoverGoogleAds(accessToken: string) {
  const payload = await providerJson<{ resourceNames?: string[] }>(
    `https://googleads.googleapis.com/${googleAdsVersion()}/customers:listAccessibleCustomers`,
    { headers: await googleAdsHeaders(accessToken) },
    "google_ads_asset_discovery_failed",
  );
  const assets: IntegrationAsset[] = [];
  for (const resource of payload.resourceNames ?? []) {
    const customerId = resource.split("/").at(-1)?.replace(/\D/g, "");
    if (!customerId) continue;
    const details = await googleAdsSearch<{ customer?: Record<string, unknown> }>({
      accessToken,
      customerId,
      query: "SELECT customer.id, customer.descriptive_name, customer.manager, customer.currency_code, customer.time_zone, customer.status FROM customer LIMIT 1",
    });
    const customer = details.results?.[0]?.customer ?? {};
    const manager = customer.manager === true;
    assets.push({
      type: manager ? "manager_customer" : "customer",
      externalId: customerId,
      parentExternalId: null,
      displayName: String(customer.descriptiveName ?? customer.descriptive_name ?? customerId),
      permissions: ["adwords"],
      metadata: {
        manager,
        currencyCode: String(customer.currencyCode ?? customer.currency_code ?? ""),
        timeZone: String(customer.timeZone ?? customer.time_zone ?? ""),
        status: String(customer.status ?? ""),
      },
    });
    if (manager) {
      const clients = await googleAdsSearch<{ customerClient?: Record<string, unknown> }>({
        accessToken,
        customerId,
        loginCustomerId: customerId,
        query: "SELECT customer_client.client_customer, customer_client.descriptive_name, customer_client.manager, customer_client.currency_code, customer_client.time_zone, customer_client.status, customer_client.level FROM customer_client WHERE customer_client.level = 1",
      });
      for (const row of clients.results) {
        const client = row.customerClient ?? {};
        const clientId = String(client.clientCustomer ?? client.client_customer ?? "").split("/").at(-1)?.replace(/\D/g, "") ?? "";
        if (!clientId || client.manager === true) continue;
        assets.push({
          type: "customer",
          externalId: clientId,
          parentExternalId: customerId,
          displayName: String(client.descriptiveName ?? client.descriptive_name ?? clientId),
          permissions: ["adwords"],
          metadata: {
            manager: false,
            currencyCode: String(client.currencyCode ?? client.currency_code ?? ""),
            timeZone: String(client.timeZone ?? client.time_zone ?? ""),
            status: String(client.status ?? ""),
          },
        });
      }
    }
  }
  return uniqueAssets(assets);
}

async function syncGa4(input: ProviderRuntimeContext): Promise<ProviderSyncResult> {
  const property = requireAsset(input.assets, "property");
  const query = { period: "last_30_days", compare: "none" } as const;
  const range = dateRange(queryDays(query));
  const payload = await providerJson<{
    rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }>;
    totals?: Array<{ metricValues?: Array<{ value?: string }> }>;
  }>(`https://analyticsdata.googleapis.com/v1beta/${property.externalId}:runReport`, {
    method: "POST",
    headers: { ...googleHeaders(input.accessToken), "content-type": "application/json" },
    body: JSON.stringify({
      dateRanges: [{ startDate: range.start, endDate: range.end }],
      dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 100,
    }),
  }, "google_analytics_sync_failed");
  const metrics: AnalyticsMetric[] = (payload.rows ?? []).flatMap((row) => {
    const path = row.dimensionValues?.[0]?.value ?? "";
    const title = row.dimensionValues?.[1]?.value ?? path;
    const value = finiteNumber(row.metricValues?.[0]?.value);
    if (!path || value <= 0) return [];
    const common = { label: title, value, unit: "count" as const, periodStart: range.startIso, periodEnd: range.endIso, dimensions: { path, title } };
    return [metric({ key: path.startsWith("/projects/") ? "projects.most_visited" : "content.most_viewed", ...common })];
  });
  return {
    status: metrics.length ? "completed" : "partial",
    message: metrics.length ? "GA4 page-view read model synchronized." : "GA4 returned no page-view rows for the selected period.",
    recordsWritten: metrics.length,
    watermark: { propertyId: property.externalId, periodEnd: range.end },
    connectionReadModelValid: true,
    analytics: [{ provider: "google_analytics_4", status: metrics.length ? "ready" : "unavailable", checkedAt: new Date().toISOString(), message: metrics.length ? "Real GA4 metrics synchronized." : "GA4 returned no metrics.", metrics, query, sourceUpdatedAt: new Date().toISOString(), watermark: { propertyId: property.externalId } }],
  };
}

async function syncSearchConsole(input: ProviderRuntimeContext): Promise<ProviderSyncResult> {
  const site = requireAsset(input.assets, "site");
  const query = { period: "last_30_days", compare: "none" } as const;
  const range = dateRange(queryDays(query));
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site.externalId)}/searchAnalytics/query`;
  const payload = await providerJson<{ rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number }> }>(url, {
    method: "POST",
    headers: { ...googleHeaders(input.accessToken), "content-type": "application/json" },
    body: JSON.stringify({ startDate: range.start, endDate: range.end, dimensions: ["query"], rowLimit: 1000 }),
  }, "google_search_console_sync_failed");
  const rows = payload.rows ?? [];
  const totals = rows.reduce<{ clicks: number; impressions: number }>(
    (sum, row) => ({
      clicks: sum.clicks + finiteNumber(row.clicks),
      impressions: sum.impressions + finiteNumber(row.impressions),
    }),
    { clicks: 0, impressions: 0 },
  );
  const metrics: AnalyticsMetric[] = rows.flatMap((row) => {
    const keyword = row.keys?.[0];
    if (!keyword) return [];
    return [metric({ key: "seo.keyword_performance", label: keyword, value: finiteNumber(row.clicks), unit: "count", periodStart: range.startIso, periodEnd: range.endIso, dimensions: { keyword, impressions: String(finiteNumber(row.impressions)), ctr: String(finiteNumber(row.ctr)) } })];
  });
  if (totals.clicks > 0 || totals.impressions > 0) {
    metrics.unshift(
      metric({ key: "seo.organic_traffic", label: "Organic clicks", value: totals.clicks, unit: "count", periodStart: range.startIso, periodEnd: range.endIso }),
      metric({ key: "seo.search_ctr", label: "Search CTR", value: totals.impressions ? totals.clicks / totals.impressions : 0, unit: "ratio", periodStart: range.startIso, periodEnd: range.endIso }),
    );
  }
  return {
    status: metrics.length ? "completed" : "partial",
    message: metrics.length ? "Search Console query read model synchronized." : "Search Console returned no rows for the selected period.",
    recordsWritten: metrics.length,
    watermark: { siteUrl: site.externalId, periodEnd: range.end },
    connectionReadModelValid: true,
    analytics: [{ provider: "google_search_console", status: metrics.length ? "ready" : "unavailable", checkedAt: new Date().toISOString(), message: metrics.length ? "Real Search Console metrics synchronized." : "Search Console returned no metrics.", metrics, query, sourceUpdatedAt: new Date().toISOString(), watermark: { siteUrl: site.externalId } }],
  };
}

async function syncGoogleAds(input: ProviderRuntimeContext): Promise<ProviderSyncResult> {
  const customer = requireAsset(input.assets, "customer");
  const manager = selectedAsset(input.assets, "manager_customer");
  const query = { period: "last_30_days", compare: "none" } as const;
  const range = dateRange(queryDays(query));
  const payload = await googleAdsSearch<{ campaign?: Record<string, unknown>; metrics?: Record<string, unknown> }>({
    accessToken: input.accessToken,
    customerId: customer.externalId,
    loginCustomerId: manager?.externalId === customer.externalId ? null : manager?.externalId,
    query: `SELECT campaign.id, campaign.name, metrics.impressions, metrics.clicks, metrics.conversions, metrics.cost_micros FROM campaign WHERE segments.date BETWEEN '${range.start}' AND '${range.end}' AND campaign.status != 'REMOVED'`,
  });
  const metrics: AnalyticsMetric[] = [];
  let conversions = 0;
  let clicks = 0;
  for (const row of payload.results ?? []) {
    const campaign = row.campaign ?? {};
    const values = row.metrics ?? {};
    const campaignConversions = finiteNumber(values.conversions);
    const campaignClicks = finiteNumber(values.clicks);
    conversions += campaignConversions;
    clicks += campaignClicks;
    metrics.push(metric({ key: "business.campaign_performance", label: String(campaign.name ?? campaign.id ?? "Campaign"), value: campaignConversions, unit: "count", periodStart: range.startIso, periodEnd: range.endIso, dimensions: { provider: "google_ads", campaignId: String(campaign.id ?? ""), impressions: String(finiteNumber(values.impressions)), clicks: String(campaignClicks), costMicros: String(finiteNumber(values.costMicros ?? values.cost_micros)) } }));
  }
  if (conversions > 0 || clicks > 0) {
    metrics.unshift(
      metric({ key: "business.leads", label: "Google Ads conversions", value: conversions, unit: "count", periodStart: range.startIso, periodEnd: range.endIso, dimensions: { provider: "google_ads" } }),
      metric({ key: "business.conversion_rate", label: "Google Ads conversion rate", value: clicks ? conversions / clicks : 0, unit: "ratio", periodStart: range.startIso, periodEnd: range.endIso, dimensions: { provider: "google_ads" } }),
    );
  }
  return {
    status: metrics.length ? "completed" : "partial", message: metrics.length ? "Google Ads campaign read model synchronized." : "Google Ads returned no campaign metrics.", recordsWritten: metrics.length,
    watermark: { customerId: customer.externalId, periodEnd: range.end }, connectionReadModelValid: true,
    analytics: [{ provider: "google_ads", status: metrics.length ? "ready" : "unavailable", checkedAt: new Date().toISOString(), message: metrics.length ? "Real Google Ads metrics synchronized." : "Google Ads returned no metrics.", metrics, query, sourceUpdatedAt: new Date().toISOString(), watermark: { customerId: customer.externalId } }],
  };
}

function createGoogleAdapter(kind: GoogleKind): IntegrationProviderAdapter {
  const definition = GOOGLE_DEFINITIONS[kind];
  return {
    integration: definition.integration,
    analyticsProvider: definition.analyticsProvider,
    async configuration() {
      return resolveIntegrationApplicationConfiguration(definition.integration);
    },
    async testApplicationConfiguration() {
      const configuration = await resolveIntegrationApplicationConfiguration(definition.integration, {
        includeSecrets: true,
        allowUntested: true,
      });
      if (configuration.missing.length) {
        return {
          status: "configuration_invalid",
          safeErrorCode: "integration_app_configuration_incomplete",
          message: "Required Google application fields are missing.",
        };
      }
      const clientId = requireApplicationConfigurationValue(configuration, "google_client_id");
      const clientSecret = requireApplicationConfigurationValue(configuration, "google_client_secret");
      const developerToken = kind === "ads"
        ? requireApplicationConfigurationValue(configuration, "google_ads_developer_token")
        : null;
      if (!/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(clientId) || clientSecret.length < 8) {
        return {
          status: "configuration_invalid",
          safeErrorCode: "google_app_credentials_format_invalid",
          message: "Google OAuth credential format is invalid.",
        };
      }
      if (developerToken && !/^[A-Za-z0-9]{22}$/.test(developerToken)) {
        return {
          status: "configuration_invalid",
          safeErrorCode: "google_ads_developer_token_format_invalid",
          message: "Google Ads Developer Token format is invalid.",
        };
      }
      return {
        status: "configuration_saved_waiting_for_authorization",
        safeErrorCode: null,
        message: "Google requires user authorization before an official credential test is possible.",
      };
    },
    async buildAuthorizationRequest(context) {
      const configuration = await requireIntegrationApplicationConfiguration(definition.integration);
      const url = new URL(GOOGLE_AUTH);
      url.searchParams.set(
        "client_id",
        requireApplicationConfigurationValue(configuration, "google_client_id"),
      );
      url.searchParams.set("redirect_uri", context.redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");
      url.searchParams.set("scope", definition.scopes.join(" "));
      url.searchParams.set("state", context.state);
      if (context.codeChallenge) {
        url.searchParams.set("code_challenge", context.codeChallenge);
        url.searchParams.set("code_challenge_method", "S256");
      }
      return { url: url.toString(), pkceVerifierRequired: true };
    },
    async exchangeAuthorizationCode(input) {
      const tokens = tokenSet(await exchangeGoogleCode(
        definition.integration,
        input.code,
        input.redirectUri,
        input.pkceVerifier,
      ));
      assertGrantedScopes(tokens.grantedScopes, definition.scopes, "google_oauth_scope_missing");
      return tokens;
    },
    async refreshCredential(input) {
      return refreshGoogle(input);
    },
    async discoverAssets(input) {
      if (kind === "analytics") return discoverGa4(input.accessToken);
      if (kind === "search_console") return discoverSearchConsole(input.accessToken);
      return discoverGoogleAds(input.accessToken);
    },
    validateAssetSelection(assets) {
      assertRequiredAssets(definition.integration, assets);
      if (kind === "analytics") {
        const property = requireAsset(assets, "property");
        const account = requireAsset(assets, "account");
        if (property.parentExternalId !== account.externalId) throw new Error("google_analytics_asset_relationship_invalid");
      } else if (kind === "ads") {
        const customer = requireAsset(assets, "customer");
        const manager = selectedAsset(assets, "manager_customer");
        if (customer.parentExternalId && manager?.externalId !== customer.parentExternalId) {
          throw new Error("google_ads_customer_manager_relationship_invalid");
        }
      }
    },
    async testConnection(input) {
      try {
        this.validateAssetSelection(input.assets);
        if (kind === "analytics") {
          const property = requireAsset(input.assets, "property");
          await providerJson(`https://analyticsadmin.googleapis.com/v1alpha/${property.externalId}`, { headers: googleHeaders(input.accessToken) }, "google_analytics_test_failed");
        } else if (kind === "search_console") {
          const site = requireAsset(input.assets, "site");
          await providerJson(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site.externalId)}`, { headers: googleHeaders(input.accessToken) }, "google_search_console_test_failed");
        } else {
          const customer = requireAsset(input.assets, "customer");
          const manager = selectedAsset(input.assets, "manager_customer");
          await googleAdsSearch({ accessToken: input.accessToken, customerId: customer.externalId, loginCustomerId: manager?.externalId ?? null, query: "SELECT customer.id FROM customer LIMIT 1" });
        }
        return { ok: true, checkedAt: new Date().toISOString(), message: "Provider asset access verified.", requiresReauth: false, diagnosticCode: "integration_test_ok" };
      } catch (error) {
        const requiresReauth = Boolean(error && typeof error === "object" && "requiresReauth" in error && (error as { requiresReauth?: unknown }).requiresReauth);
        return { ok: false, checkedAt: new Date().toISOString(), message: error instanceof Error ? error.message : "Provider test failed.", requiresReauth, diagnosticCode: "integration_test_failed" };
      }
    },
    async syncAnalytics(input) {
      if (kind === "analytics") return syncGa4(input);
      if (kind === "search_console") return syncSearchConsole(input);
      return syncGoogleAds(input);
    },
    async revokeConnection(input) {
      await providerJson(GOOGLE_REVOKE, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: formBody({ token: input.refreshToken ?? input.accessToken }),
      }, "google_oauth_revoke_failed");
      return { providerRevoked: true, message: "The Google OAuth token grant was revoked." };
    },
    async diagnoseConnection(input) {
      const test = await this.testConnection(input);
      return { status: test.ok ? "ready" : "unavailable", code: test.diagnosticCode, message: test.message, checkedAt: test.checkedAt, requiresReauth: test.requiresReauth, metadata: { refreshSupported: true, selectedAssets: input.assets.filter((asset) => asset.selected).length } };
    },
  };
}

export const googleAnalyticsAdapter = createGoogleAdapter("analytics");
export const googleSearchConsoleAdapter = createGoogleAdapter("search_console");
export const googleAdsAdapter = createGoogleAdapter("ads");
