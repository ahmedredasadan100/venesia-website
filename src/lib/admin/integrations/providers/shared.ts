import type { AnalyticsMetric, AnalyticsQueryContext } from "../../reports/analytics-contract";
import type { IntegrationAsset } from "../integrations-contract";

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
