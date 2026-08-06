import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

import {
  INTEGRATION_DEFINITIONS,
  INTEGRATION_KEYS,
  INTEGRATIONS_CONTRACT_VERSION,
  INTEGRATIONS_MIGRATION_VERSION,
  LIVE_INTEGRATION_KEYS,
  assertRequiredAssets,
  type IntegrationAsset,
} from "../src/lib/admin/integrations/integrations-contract.ts";
import {
  createIntegrationProviderRegistry,
  type IntegrationProviderAdapter,
} from "../src/lib/admin/integrations/provider-adapter-contract.ts";
import { assertGrantedScopes } from "../src/lib/admin/integrations/providers/shared.ts";
import {
  applicationConfigurationProviderForIntegration,
  requiredApplicationConfigurationFields,
} from "../src/lib/admin/integrations/server-configuration-contract.ts";
import { ANALYTICS_PROVIDER_DEFINITIONS } from "../src/lib/admin/reports/analytics-contract.ts";

const root = resolve(import.meta.dirname, "..");
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

function walk(path: string): string[] {
  return readdirSync(resolve(root, path)).flatMap((name) => {
    const entry = resolve(root, path, name);
    return statSync(entry).isDirectory()
      ? walk(relative(root, entry))
      : [relative(root, entry).replaceAll("\\", "/")];
  });
}

assert.equal(INTEGRATIONS_CONTRACT_VERSION, "external-integrations-v2");
assert.equal(INTEGRATIONS_MIGRATION_VERSION, "20260806010000");
assert.deepEqual(INTEGRATION_KEYS, [
  "google_analytics",
  "google_search_console",
  "microsoft_clarity",
  "google_ads",
  "meta_business",
  "tiktok_ads",
  "snapchat_ads",
  "whatsapp_business",
  "venesia_crm",
]);
assert.deepEqual(LIVE_INTEGRATION_KEYS, [
  "google_analytics",
  "google_search_console",
  "google_ads",
  "meta_business",
  "tiktok_ads",
  "snapchat_ads",
  "whatsapp_business",
]);
assert.equal(new Set(INTEGRATION_KEYS).size, 9, "integration identities must be unique");
assert.equal(new Set(LIVE_INTEGRATION_KEYS).size, 7, "provider registry identities must be unique");
assert.equal(INTEGRATION_DEFINITIONS.length, 9);
assert.deepEqual(
  INTEGRATION_DEFINITIONS.filter((item) => !item.liveConnectionSupported).map((item) => item.key),
  ["microsoft_clarity", "venesia_crm"],
  "Clarity and CRM remain explicitly unavailable",
);
assert.deepEqual(
  INTEGRATION_DEFINITIONS.filter((item) => item.liveConnectionSupported).map((item) => item.key),
  LIVE_INTEGRATION_KEYS,
);
assert.ok(INTEGRATION_DEFINITIONS.every((item) => item.reportsHref.startsWith("/admin/reports/")));
assert.deepEqual(
  ANALYTICS_PROVIDER_DEFINITIONS.map((item) => item.key),
  ["google_analytics_4", "google_search_console", "google_ads", "meta_marketing", "tiktok_ads", "snapchat_ads", "microsoft_clarity", "crm"],
);

const selected = (type: IntegrationAsset["type"], id: string): IntegrationAsset => ({
  type,
  externalId: id,
  parentExternalId: null,
  displayName: id,
  permissions: [],
  metadata: {},
  selected: true,
});
assert.doesNotThrow(() => assertRequiredAssets("google_analytics", [selected("account", "a"), selected("property", "p")]));
assert.throws(() => assertRequiredAssets("google_analytics", [selected("account", "a")]), /integration_assets_missing:property/);
assert.throws(
  () => assertRequiredAssets("google_analytics", [selected("account", "a"), selected("property", "p1"), selected("property", "p2")]),
  /integration_assets_duplicate_type:property/,
);
assert.doesNotThrow(() => assertGrantedScopes(["read", "reporting"], ["read"], "scope_missing"));
assert.throws(() => assertGrantedScopes(["read"], ["reporting"], "scope_missing"), /scope_missing:reporting/);

const adapter = (integration: (typeof LIVE_INTEGRATION_KEYS)[number]): IntegrationProviderAdapter => ({
  integration,
  analyticsProvider: null,
  configuration: async () => ({
    integration,
    provider: applicationConfigurationProviderForIntegration(integration),
    configured: false,
    status: "needs_configuration",
    source: "none",
    missing: requiredApplicationConfigurationFields(integration).map((field) => field.key),
    message: "not configured",
    lastTestedAt: null,
    safeErrorCode: null,
    version: 0,
  }),
  testApplicationConfiguration: async () => ({
    status: "configuration_invalid",
    safeErrorCode: "not_configured",
    message: "not configured",
  }),
  buildAuthorizationRequest: async () => ({ url: "https://provider.invalid/authorize", pkceVerifierRequired: false }),
  exchangeAuthorizationCode: async () => { throw new Error("not configured"); },
  refreshCredential: async () => null,
  discoverAssets: async () => [],
  validateAssetSelection: () => undefined,
  testConnection: async () => ({ ok: false, checkedAt: new Date(0).toISOString(), message: "not configured", requiresReauth: false, diagnosticCode: "not_configured" }),
  syncAnalytics: async () => ({ status: "partial", message: "not configured", recordsWritten: 0, watermark: {}, analytics: [], connectionReadModelValid: false }),
  revokeConnection: async () => ({ providerRevoked: false, message: "not configured" }),
  diagnoseConnection: async () => ({ status: "unavailable", code: "not_configured", message: "not configured", checkedAt: new Date(0).toISOString(), requiresReauth: false, metadata: {} }),
});
const registry = createIntegrationProviderRegistry(LIVE_INTEGRATION_KEYS.map(adapter));
assert.deepEqual(registry.definitions().map((item) => item.integration), LIVE_INTEGRATION_KEYS);
assert.throws(() => createIntegrationProviderRegistry([adapter("google_analytics"), adapter("google_analytics")]), /duplicate_integration_provider_adapter/);
assert.throws(() => createIntegrationProviderRegistry([]).get("google_analytics"), /integration_provider_adapter_missing/);

const foundationMigration = source("sql/migrations/20260805234500_external_integrations_capability.sql");
const recoveryMigration = source("sql/migrations/20260806010000_external_integrations_asset_reselection_recovery.sql");
const configurationMigration = source("sql/migrations/20260806140000_integrations_server_configuration_capability.sql");
const migration = `${foundationMigration}\n${recoveryMigration}\n${configurationMigration}`;
const credentialTable = foundationMigration.match(/create table(?:\s+if not exists)?\s+public\.integration_credentials[\s\S]*?;\s*create table/i)?.[0] ?? "";
assert.ok(credentialTable, "the credential table definition must be inspected rather than skipped");
for (const required of [
  "integration_authorization_attempts",
  "integration_connections",
  "integration_credentials",
  "integration_connection_assets",
  "integration_sync_runs",
  "analytics_provider_read_models",
  "create_integration_vault_secret",
  "read_integration_vault_secret",
  "delete_integration_vault_secret",
  "prune_integration_authorization_attempts",
  "claim_integration_sync_run",
  "complete_integration_sync_run",
  "fail_integration_sync_run",
  "ingest_analytics_provider_read_model",
  "external_integrations_capability_health",
]) assert.match(migration, new RegExp(required, "i"), `${required} must be migration-owned`);
assert.match(migration, /vault\.create_secret/i);
assert.match(migration, /vault\.decrypted_secrets/i);
assert.match(migration, /run\.status = 'running' and run\.leased_until <= clock_timestamp\(\)/i, "expired leases must be reclaimable");
assert.match(migration, /analytics_ingestion_connection_provider_mismatch/);
assert.match(recoveryMigration, /status in \('pending_selection', 'testing', 'needs_attention'\)/i, "asset selection must recover from interrupted or failed tests");
assert.match(recoveryMigration, /'migrationVersion', '20260806010000'/i, "health must prove the latest corrective migration");
assert.match(configurationMigration, /'migrationVersion', '20260806010000'/i, "health must preserve the deployed Core Integrations migration contract");
assert.match(configurationMigration, /'serverConfigurationMigrationVersion', '20260806140000'/i, "health must prove the Server Configuration migration independently");
assert.match(migration, /enable row level security/gi);
assert.match(migration, /grant execute[\s\S]*service_role/i);
assert.doesNotMatch(credentialTable, /\baccess_token\b|\brefresh_token\b/i, "token plaintext must never be a table column");

const repository = source("src/lib/admin/integrations/connection-repository.ts");
const loader = source("src/lib/admin/integrations/load-admin-integrations.ts");
const providerRegistry = source("src/lib/admin/integrations/provider-registry.ts");
const analyticsLoader = source("src/lib/admin/reports/load-analytics.ts");
const ingestion = source("src/lib/admin/reports/analytics-ingestion-adapter.ts");
const coordinator = source("src/lib/admin/integrations/sync-coordinator.ts");
const credentialManager = source("src/lib/admin/integrations/credential-manager.ts");
const cron = source("src/app/api/admin/integrations/sync/route.ts");
const wizard = source("src/components/admin/integrations/IntegrationConnectionWizard.tsx");
const actionRoute = source("src/app/api/admin/integrations/[integration]/action/route.ts");
const connectionService = source("src/lib/admin/integrations/connection-service.ts");
const envExample = source(".env.example");
const vercel = JSON.parse(source("vercel.json")) as { crons?: Array<{ path: string }> };

assert.doesNotMatch(loader, /loadAnalyticsSnapshot|AnalyticsProviderResult/, "connection truth must not be inferred from Analytics metrics");
assert.match(loader, /loadIntegrationPersistenceSnapshot/);
assert.match(loader, /needs_configuration/);
assert.match(repository, /create_integration_vault_secret/);
assert.match(repository, /read_integration_vault_secret/);
assert.doesNotMatch(repository, /console\.(?:log|error|warn)[\s\S]*(?:accessToken|refreshToken)/i);
for (const key of LIVE_INTEGRATION_KEYS) assert.match(providerRegistry, new RegExp(key === "meta_business" ? "metaMarketingAdapter" : key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), "i"));
for (const provider of ["google_analytics_4", "google_search_console", "google_ads", "meta_marketing", "tiktok_ads", "snapchat_ads"]) {
  assert.match(analyticsLoader, new RegExp(`createAnalyticsReadModelAdapter\\(\"${provider}\"\\)`));
}
assert.doesNotMatch(analyticsLoader, /googleapis|graph\.facebook|business-api\.tiktok|adsapi\.snapchat/i);
assert.match(ingestion, /assertAnalyticsProviderResult/);
assert.match(ingestion, /ingest_analytics_provider_read_model/);
assert.match(coordinator, /claimSyncRun/);
assert.match(coordinator, /getFreshRuntimeConnection/);
assert.match(credentialManager, /refreshCredential/);
assert.match(credentialManager, /rotateCredentials/);
assert.match(coordinator, /ingestAnalyticsModel/);
assert.match(coordinator, /integration_sync_analytics_projection_invalid/);
assert.match(coordinator, /integration_sync_unowned_analytics_projection/);
assert.match(coordinator, /failSyncRun/);
assert.match(coordinator, /pruneAuthorizationAttempts/);
assert.match(cron, /CRON_SECRET/);
assert.match(cron, /timingSafeEqual/);
assert.match(wizard, /select_test_sync/);
assert.match(wizard, /diagnose/);
assert.match(wizard, /AdminConfirmDialog/);
assert.doesNotMatch(wizard, /Math\.random|mock|placeholder|window\.confirm/i);
assert.match(actionRoute, /requireAdminApi/);
assert.match(actionRoute, /requireAdminSession/);
assert.match(connectionService, /integration_connection_provider_mismatch/);
assert.match(connectionService, /integrationAssetsDiscoveryFailed/);
assert.match(connectionService, /integrationDiagnosed/);
assert.deepEqual(vercel.crons, [{ path: "/api/admin/integrations/sync", schedule: "17 2 * * *" }]);
for (const name of ["GOOGLE_INTEGRATIONS_CLIENT_ID", "META_APP_ID", "TIKTOK_BUSINESS_APP_ID", "SNAPCHAT_MARKETING_CLIENT_ID", "CRON_SECRET"]) {
  assert.match(envExample, new RegExp(`^${name}=`, "m"));
}
assert.match(envExample, /Legacy bootstrap only/);
assert.doesNotMatch(envExample, /^INTEGRATIONS_OAUTH_BASE_URL=/m);
assert.doesNotMatch(envExample, /^TIKTOK_BUSINESS_AUTHORIZATION_URL=/m);

const providerHosts = /googleapis\.com|graph\.facebook\.com|business-api\.tiktok\.com|adsapi\.snapchat\.com|api\.snapchat\.com/i;
const providerFiles = walk("src").filter((path) => /\.(?:ts|tsx)$/.test(path));
for (const path of providerFiles) {
  if (!providerHosts.test(source(path))) continue;
  assert.ok(
    path.startsWith("src/lib/admin/integrations/providers/") || path === "src/lib/admin/integrations/provider-http.ts",
    `direct provider API call escaped the Provider Adapter Registry: ${path}`,
  );
}
for (const path of walk("src/lib/admin/integrations").filter((entry) => /\.(?:ts|tsx)$/.test(entry))) {
  if (path === "src/lib/admin/integrations/provider-http.ts") continue;
  assert.doesNotMatch(source(path), /\bfetch\(/, `provider network calls must use the guarded HTTP owner: ${path}`);
}
const providerSource = walk("src/lib/admin/integrations/providers")
  .filter((path) => /\.ts$/.test(path))
  .map(source)
  .join("\n");
assert.doesNotMatch(providerSource, /\/(?:events|messages)(?:[?"'`])/i, "event and messaging writers are outside this phase");
assert.doesNotMatch(providerSource, /include_granted_scopes|graph\.facebook\.com[^\n]*access_token=/i, "connections must not share grants or put credentials in provider URLs");

console.log("OK: External Integrations owner, provider registry, Vault references, sync leases, Analytics boundary, truthful unavailable states, and architecture guards passed.");
