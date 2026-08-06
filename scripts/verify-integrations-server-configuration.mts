import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import {
  INTEGRATION_APP_CONFIGURATION_DEFINITIONS,
  INTEGRATION_APP_CONFIGURATION_KEYS,
  INTEGRATION_APP_CONFIGURATION_PROVIDERS,
  INTEGRATION_APP_CONFIGURATION_SURFACE_DEFINITIONS,
  INTEGRATION_APP_CONFIGURATION_SURFACES,
  INTEGRATIONS_SERVER_CONFIGURATION_CONTRACT_VERSION,
  applicationConfigurationProviderForIntegration,
  isIntegrationAppConfigurationAuthorizationReady,
  requiredApplicationConfigurationFields,
} from "../src/lib/admin/integrations/server-configuration-contract.ts";
import { LIVE_INTEGRATION_KEYS } from "../src/lib/admin/integrations/integrations-contract.ts";

const root = resolve(import.meta.dirname, "..");
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

assert.equal(INTEGRATIONS_SERVER_CONFIGURATION_CONTRACT_VERSION, "integrations-server-configuration-v1");
assert.deepEqual(INTEGRATION_APP_CONFIGURATION_PROVIDERS, ["google", "meta", "tiktok", "snapchat"]);
assert.deepEqual(INTEGRATION_APP_CONFIGURATION_SURFACES, ["google", "meta", "tiktok", "snapchat", "whatsapp"]);
assert.equal(new Set(INTEGRATION_APP_CONFIGURATION_KEYS).size, INTEGRATION_APP_CONFIGURATION_KEYS.length);
assert.equal(INTEGRATION_APP_CONFIGURATION_DEFINITIONS.length, 4, "WhatsApp must not create a parallel App owner");
assert.deepEqual(
  INTEGRATION_APP_CONFIGURATION_SURFACE_DEFINITIONS.find((surface) => surface.key === "whatsapp"),
  { key: "whatsapp", owner: "meta", label: "WhatsApp Business", integrations: ["whatsapp_business"] },
);
for (const integration of LIVE_INTEGRATION_KEYS) {
  const provider = applicationConfigurationProviderForIntegration(integration);
  assert.ok(INTEGRATION_APP_CONFIGURATION_PROVIDERS.includes(provider));
  assert.ok(requiredApplicationConfigurationFields(integration).length > 0, `${integration} must have explicit App requirements`);
}
assert.deepEqual(
  requiredApplicationConfigurationFields("google_ads").map((field) => field.key),
  ["google_client_id", "google_client_secret", "google_ads_developer_token"],
);
assert.deepEqual(
  requiredApplicationConfigurationFields("whatsapp_business").map((field) => field.key),
  ["meta_app_id", "meta_app_secret"],
);
assert.equal(isIntegrationAppConfigurationAuthorizationReady({ status: "needs_configuration", lastTestedAt: null }), false);
assert.equal(isIntegrationAppConfigurationAuthorizationReady({ status: "configuration_saved_waiting_for_authorization", lastTestedAt: null }), false);
assert.equal(isIntegrationAppConfigurationAuthorizationReady({ status: "configuration_saved_waiting_for_authorization", lastTestedAt: "2026-08-06T00:00:00.000Z" }), true);
assert.equal(isIntegrationAppConfigurationAuthorizationReady({ status: "ready_to_connect", lastTestedAt: null }), true);

const migration = source("sql/migrations/20260806140000_integrations_server_configuration_capability.sql");
for (const owner of [
  "integration_app_configuration_groups",
  "integration_app_configuration_entries",
  "integration_app_configuration_validations",
  "replace_integration_app_configuration",
  "remove_integration_app_configuration",
  "claim_integration_app_configuration_test",
  "complete_integration_app_configuration_test",
]) assert.match(migration, new RegExp(owner, "i"), `${owner} must remain migration-owned`);
assert.match(migration, /'migrationVersion',\s*'20260806010000'/i);
assert.match(migration, /'serverConfigurationMigrationVersion',\s*'20260806140000'/i);
assert.match(migration, /'serverConfigurationMigrationRegistered'/i);
assert.match(migration, /vault\.create_secret\(/i, "secret creation must be inside the atomic replacement RPC");
assert.match(migration, /delete from vault\.secrets/i, "replacement and removal must remove retired Vault values");
assert.match(migration, /for update/i, "optimistic writes and tests must lock their Aggregate rows");
assert.match(migration, /integration_app_configuration_version_conflict/i);
assert.match(migration, /test_attempts_in_window\s*>=\s*5/i, "safe tests must be rate limited at the owner");
assert.match(migration, /interval '10 minutes'/i);
assert.match(migration, /enable row level security/gi);
assert.match(migration, /revoke all[\s\S]*from public, anon, authenticated/gi);
assert.match(migration, /grant execute[\s\S]*to service_role/gi);
assert.match(migration, /configuration_source in \('cms_vault','environment_import'\)/i);
assert.match(migration, /plaintextCredentialColumns',\s*0/i);
const entriesTable = migration.match(/create table public\.integration_app_configuration_entries \([\s\S]*?\n\);/i)?.[0] ?? "";
assert.ok(entriesTable);
assert.doesNotMatch(entriesTable, /^\s*(?:access_token|refresh_token|client_secret|app_secret|developer_token)\s+/im);
assert.match(entriesTable, /vault_secret_id uuid/i);
assert.doesNotMatch(migration, /grant (?:select|insert|update|delete|execute)[^;]*\b(?:anon|authenticated)\b/i);

const repository = source("src/lib/admin/integrations/server-configuration-repository.ts");
const resolver = source("src/lib/admin/integrations/server-configuration-resolver.ts");
const service = source("src/lib/admin/integrations/server-configuration-service.ts");
const route = source("src/app/api/admin/integrations/server-configuration/[surface]/route.ts");
const loader = source("src/lib/admin/integrations/load-integrations-server-configuration.ts");
const client = source("src/components/admin/integrations/IntegrationsServerConfiguration.tsx");
const wizard = source("src/components/admin/integrations/IntegrationConnectionWizard.tsx");
const connectionService = source("src/lib/admin/integrations/connection-service.ts");
const auditActions = source("src/lib/admin/audit/audit-actions.ts");
const envExample = source(".env.example");

assert.match(repository, /replace_integration_app_configuration/);
assert.match(repository, /secret_value:\s*entry\.secretValue/);
assert.doesNotMatch(service, /createIntegrationVaultSecret|deleteIntegrationVaultSecret/, "App replacement must be one database transaction");
assert.match(service, /recordAdminAuditEvent/);
assert.doesNotMatch(service, /fieldsChanged:\s*changedKeys/);
for (const action of ["Created", "Replaced", "Removed", "TestPassed", "TestFailed", "ReadinessChanged"]) {
  assert.match(auditActions, new RegExp(`integrationAppConfiguration${action}`));
}
assert.match(route, /requireAdminApi/);
assert.match(route, /requireAdminSession/);
assert.match(route, /sameOriginMutation/);
assert.match(route, /z\.discriminatedUnion/);
assert.match(route, /private, no-store/);
assert.doesNotMatch(route, /console\.|accessToken|refreshToken|secretId/);
assert.match(resolver, /resolveCanonicalBaseUrl/);
assert.doesNotMatch(resolver, /headers\(\)|request\.headers|get\(["']host["']\)/i, "OAuth origin must not trust request Host");
assert.match(resolver, /source:\s*"cms_vault"/);
assert.match(resolver, /"environment_bootstrap" as const/);
assert.match(resolver, /integration_app_configuration_persistence_not_installed/);
assert.doesNotMatch(resolver, /loadApplicationConfigurationGroup\(provider\)\.catch\(\(\) => null\)/);
assert.match(loader, /safeValue:\s*field\.secret \? null/);
assert.doesNotMatch(loader, /secretId|vaultSecretId/);
assert.match(client, /type=\{field\.secret \? "password" : "text"\}/);
assert.match(client, /محفوظ — اكتب قيمة جديدة للاستبدال/);
assert.doesNotMatch(client, /reveal|showSecret|localStorage|sessionStorage|console\./i);
assert.doesNotMatch(client, /useState\([^\n]*(?:secret|token|credential)/i, "browser state must not own credential plaintext");
assert.match(wizard, /isIntegrationAppConfigurationAuthorizationReady/);
assert.match(wizard, /appConfigurationLastTestedAt/);
assert.match(connectionService, /isIntegrationAppConfigurationAuthorizationReady\(configuration\)/);
assert.match(connectionService, /await adapter\.configuration\(\)/);
assert.match(connectionService, /await adapter\.buildAuthorizationRequest/);
assert.match(envExample, /Legacy bootstrap only/);
assert.doesNotMatch(envExample, /^INTEGRATIONS_OAUTH_BASE_URL=/m);
assert.doesNotMatch(envExample, /^TIKTOK_BUSINESS_AUTHORIZATION_URL=/m);

const providerFiles = readdirSync(resolve(root, "src/lib/admin/integrations/providers"))
  .filter((name) => name.endsWith(".ts"));
for (const file of providerFiles) {
  const providerSource = source(`src/lib/admin/integrations/providers/${file}`);
  assert.doesNotMatch(providerSource, /process\.env\.(?:GOOGLE_INTEGRATIONS|GOOGLE_ADS_DEVELOPER|META_APP|TIKTOK_BUSINESS|SNAPCHAT_MARKETING)/, `${file} bypasses the Server Configuration owner`);
}
const sourceCorpus = source("src/lib/admin/integrations/server-configuration-contract.ts") + resolver;
for (const definition of INTEGRATION_APP_CONFIGURATION_DEFINITIONS) {
  for (const field of definition.fields) {
    assert.equal(
      (sourceCorpus.match(new RegExp(field.environmentBootstrapKey, "g")) ?? []).length,
      1,
      `${field.environmentBootstrapKey} must be declared once and resolved dynamically by the owner`,
    );
  }
}

console.log("OK: Integrations Server Configuration has one provider owner, atomic Vault writes, safe readiness, trusted callbacks, audit, diagnostics, and regression guards.");
