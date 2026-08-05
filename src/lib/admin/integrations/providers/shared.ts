import type { AnalyticsMetric, AnalyticsQueryContext } from "../../reports/analytics-contract";
import type { IntegrationAsset, ProviderConfigurationDiagnostic } from "../integrations-contract";

export function configuredEnvironment(required: readonly string[]): ProviderConfigurationDiagnostic {
  const missing = required.filter((name) => !process.env[name]?.trim());
  return {
    configured: missing.length === 0,
    missing,
    message: missing.length
      ? `Missing server configuration: ${missing.join(", ")}`
      : "Provider application credentials are configured on the server.",
  };
}

export function oauthBaseUrl() {
  const raw = process.env.INTEGRATIONS_OAUTH_BASE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) throw new Error("integrations_oauth_base_url_missing");
  const url = new URL(raw);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("integrations_oauth_base_url_https_required");
  }
  return url.origin;
}

export function callbackUri(integration: string) {
  return `${oauthBaseUrl()}/api/admin/integrations/${integration}/callback`;
}

export function requireConfigured(diagnostic: ProviderConfigurationDiagnostic) {
  if (!diagnostic.configured) throw new Error(`integration_provider_not_configured:${diagnostic.missing.join(",")}`);
}

export function requireAsset(assets: readonly IntegrationAsset[], type: IntegrationAsset["type"]) {
  const asset = assets.find((candidate) => candidate.type === type && candidate.selected !== false);
  if (!asset) throw new Error(`integration_assets_missing:${type}`);
  return asset;
}

export function uniqueAssets(assets: IntegrationAsset[]) {
  const seen = new Set<string>();
  return assets.filter((asset) => {
    const identity = `${asset.type}:${asset.externalId}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export function dateRange(days: 30 | 90) {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const format = (date: Date) => date.toISOString().slice(0, 10);
  return { start: format(start), end: format(end), startIso: start.toISOString(), endIso: end.toISOString() };
}

export function queryDays(query: AnalyticsQueryContext) {
  return query.period === "last_90_days" ? 90 as const : 30 as const;
}

export function metric(input: Omit<AnalyticsMetric, "periodStart" | "periodEnd"> & {
  periodStart: string;
  periodEnd: string;
}) {
  return input satisfies AnalyticsMetric;
}

export function finiteNumber(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function splitScopes(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];
  return value.split(/[ ,]+/).map((item) => item.trim()).filter(Boolean);
}

export function assertGrantedScopes(
  actual: readonly string[],
  required: readonly string[],
  code: string,
) {
  const granted = new Set(actual);
  const missing = required.filter((scope) => !granted.has(scope));
  if (missing.length) throw new Error(`${code}:${missing.join(",")}`);
}
