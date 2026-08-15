import "server-only";

import { createHash } from "node:crypto";

import type { Json, Tables } from "../../database.types";
import { getSupabaseAdmin } from "../../supabase-admin";
import {
  INTEGRATIONS_MIGRATION_VERSION,
  isLiveIntegrationKey,
  type IntegrationAsset,
  type IntegrationCredentialStrategy,
  type LiveIntegrationKey,
  type PersistedIntegrationConnection,
} from "./integrations-contract";
import type { ProviderTokenSet } from "./provider-adapter-contract";

type JsonRecord = Record<string, unknown>;

function jsonValue(value: unknown): Json | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") throw new TypeError("integration_json_bigint_unsupported");
  if (value === undefined || typeof value === "function" || typeof value === "symbol") {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((item) => jsonValue(item) ?? null);
  }
  if (!value || typeof value !== "object") return undefined;
  if ("toJSON" in value && typeof value.toJSON === "function") {
    return jsonValue(value.toJSON());
  }
  const result: { [key: string]: Json | undefined } = {};
  for (const [key, item] of Object.entries(value)) {
    const mapped = jsonValue(item);
    if (mapped !== undefined) result[key] = mapped;
  }
  return result;
}

function jsonRecord(value: Record<string, unknown>): Json {
  return jsonValue(value) ?? {};
}

function integrationAssetJson(asset: IntegrationAsset): Json {
  return {
    ...(asset.id === undefined ? {} : { id: asset.id }),
    type: asset.type,
    externalId: asset.externalId,
    parentExternalId: asset.parentExternalId,
    displayName: asset.displayName,
    permissions: asset.permissions,
    metadata: { ...asset.metadata },
    ...(asset.selected === undefined ? {} : { selected: asset.selected }),
  };
}

export function getIntegrationsEnvironmentKey() {
  const value = process.env.INTEGRATIONS_ENVIRONMENT_KEY?.trim() ||
    (process.env.VERCEL_ENV === "production" ? "production" : process.env.VERCEL_ENV?.trim()) ||
    process.env.NODE_ENV || "development";
  if (!/^[a-z0-9][a-z0-9_-]{1,39}$/i.test(value)) {
    throw new Error("integrations_environment_key_invalid");
  }
  return value.toLowerCase();
}

export function hashOAuthState(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function asRecord(value: unknown, name: string): JsonRecord {
  if (!isRecord(value)) {
    throw new Error(`${name}_invalid`);
  }
  return value;
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function optionalText(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function requireAssetType(value: string): IntegrationAsset["type"] {
  if (value === "account" ||
    value === "property" ||
    value === "site" ||
    value === "manager_customer" ||
    value === "customer" ||
    value === "business" ||
    value === "ad_account" ||
    value === "pixel" ||
    value === "dataset" ||
    value === "business_center" ||
    value === "advertiser" ||
    value === "organization" ||
    value === "waba" ||
    value === "phone_number") {
    return value;
  }
  throw new Error("integration_asset_type_invalid");
}

function requireConnectionStatus(
  value: string,
): PersistedIntegrationConnection["status"] {
  if (value === "authorized_unbound" ||
    value === "discovering_assets" ||
    value === "pending_selection" ||
    value === "testing" ||
    value === "syncing" ||
    value === "connected" ||
    value === "needs_reauth" ||
    value === "needs_attention") {
    return value;
  }
  throw new Error("integration_connection_status_invalid");
}

function requireCredentialStrategy(
  value: string,
): IntegrationCredentialStrategy["kind"] {
  if (value === "google_oauth_refresh" ||
    value === "meta_user" ||
    value === "meta_system_user" ||
    value === "tiktok_marketing_long_lived" ||
    value === "snap_oauth_refresh") {
    return value;
  }
  throw new Error("integration_credential_strategy_invalid");
}

function requireLiveIntegrationKey(value: string): LiveIntegrationKey {
  if (isLiveIntegrationKey(value)) return value;
  throw new Error("integration_key_invalid");
}

function integrationAssetMetadata(value: Json): IntegrationAsset["metadata"] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const metadata: IntegrationAsset["metadata"] = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue;
    if (item === null || typeof item === "string" || typeof item === "boolean") {
      metadata[key] = item;
      continue;
    }
    if (typeof item === "number" && Number.isFinite(item)) {
      metadata[key] = item;
      continue;
    }
    throw new Error("integration_asset_metadata_invalid");
  }
  return metadata;
}

function mapAsset(row: Tables<"integration_connection_assets">): IntegrationAsset {
  return {
    id: row.id,
    type: requireAssetType(row.asset_type),
    externalId: row.external_id,
    parentExternalId: optionalText(row.parent_external_id),
    displayName: row.display_name,
    permissions: stringArray(row.permissions),
    metadata: integrationAssetMetadata(row.metadata),
    selected: row.selected,
  };
}

function mapConnection(
  row: Tables<"integration_connections">,
  assets: IntegrationAsset[],
  analyticsReady: boolean,
): PersistedIntegrationConnection {
  return {
    id: row.id,
    integrationKey: requireLiveIntegrationKey(row.integration_key),
    externalSubjectId: optionalText(row.external_subject_id),
    status: requireConnectionStatus(row.status),
    credentialStrategy: requireCredentialStrategy(row.credential_strategy),
    grantedScopes: stringArray(row.granted_scopes),
    accessExpiresAt: optionalText(row.access_expires_at),
    refreshExpiresAt: optionalText(row.refresh_expires_at),
    lastValidatedAt: optionalText(row.last_validated_at),
    lastSyncAt: optionalText(row.last_sync_at),
    nextSyncAt: optionalText(row.next_sync_at),
    lastErrorCode: optionalText(row.last_error_code),
    lastErrorMessage: optionalText(row.last_error_message),
    consecutiveFailures: row.consecutive_failures,
    backoffUntil: optionalText(row.backoff_until),
    version: row.version,
    assets,
    analyticsReady,
  };
}

export async function loadIntegrationPersistenceSnapshot() {
  const database = getSupabaseAdmin();
  const [connectionsResult, assetsResult, analyticsResult, healthResult] = await Promise.all([
    database.from("integration_connections").select("*").is("revoked_at", null),
    database.from("integration_connection_assets").select("*").order("discovered_at"),
    database.from("analytics_provider_read_models").select("connection_id,status,metrics"),
    database.rpc("external_integrations_capability_health"),
  ]);
  const error = connectionsResult.error ?? assetsResult.error ?? analyticsResult.error ?? healthResult.error;
  if (error) throw new Error(error.message);

  const assetsByConnection = new Map<string, IntegrationAsset[]>();
  for (const row of assetsResult.data ?? []) {
    const connectionId = String(row.connection_id);
    assetsByConnection.set(connectionId, [...(assetsByConnection.get(connectionId) ?? []), mapAsset(row)]);
  }
  const analyticsReady = new Set(
    (analyticsResult.data ?? [])
      .filter((row) => {
        return (row.status === "ready" || row.status === "partial") &&
          Array.isArray(row.metrics) && row.metrics.length > 0;
      })
      .map((row) => row.connection_id),
  );
  const connections = (connectionsResult.data ?? []).map((row) => {
    const id = row.id;
    return mapConnection(row, assetsByConnection.get(id) ?? [], analyticsReady.has(id));
  });
  const health = asRecord(healthResult.data, "integrations_health");
  return {
    connections,
    health: {
      vaultAvailable: health.vaultAvailable === true,
      migrationRegistered: health.migrationRegistered === true,
      migrationVersion: String(health.migrationVersion ?? ""),
      serverConfigurationMigrationRegistered:
        health.serverConfigurationMigrationRegistered === true,
      serverConfigurationMigrationVersion: String(
        health.serverConfigurationMigrationVersion ?? "",
      ),
      valid: health.vaultAvailable === true &&
        health.migrationRegistered === true &&
        health.migrationVersion === INTEGRATIONS_MIGRATION_VERSION,
    },
  };
}

export async function createIntegrationVaultSecret(secret: string, name: string, description: string) {
  const { data, error } = await getSupabaseAdmin().rpc("create_integration_vault_secret", {
    p_secret: secret,
    p_name: name,
    p_description: description,
  });
  if (error || typeof data !== "string") throw new Error(error?.message ?? "integration_vault_write_failed");
  return data;
}

export async function readVaultSecret(secretId: string | null) {
  if (!secretId) return null;
  const { data, error } = await getSupabaseAdmin().rpc("read_integration_vault_secret", {
    p_secret_id: secretId,
  });
  if (error || typeof data !== "string" || !data) {
    throw new Error(error?.message ?? "integration_vault_read_failed");
  }
  return data;
}

export async function deleteIntegrationVaultSecret(secretId: string | null) {
  if (!secretId) return;
  await getSupabaseAdmin().rpc("delete_integration_vault_secret", { p_secret_id: secretId });
}

export async function createAuthorizationAttempt(input: {
  id: string;
  integration: LiveIntegrationKey;
  actorAdminUserId: number;
  stateHash: string;
  pkceVerifier: string | null;
  returnPath: string;
  expiresAt: string;
}) {
  const verifierSecretId = input.pkceVerifier
    ? await createIntegrationVaultSecret(
        input.pkceVerifier,
        `integration-oauth-pkce-${input.integration}-${Date.now()}`,
        "Short-lived OAuth PKCE verifier. Deleted after callback consumption.",
      )
    : null;
  const { data, error } = await getSupabaseAdmin()
    .from("integration_authorization_attempts")
    .insert({
      id: input.id,
      integration_key: input.integration,
      environment_key: getIntegrationsEnvironmentKey(),
      actor_admin_user_id: input.actorAdminUserId,
      state_hash: input.stateHash,
      pkce_verifier_secret_id: verifierSecretId,
      return_path: input.returnPath,
      expires_at: input.expiresAt,
    })
    .select("id")
    .single();
  if (error || !data) {
    await deleteIntegrationVaultSecret(verifierSecretId);
    throw new Error(error?.message ?? "integration_oauth_attempt_write_failed");
  }
  return data.id;
}

export async function consumeAuthorizationAttempt(input: {
  attemptId: string;
  stateHash: string;
  actorAdminUserId: number;
}) {
  const { data, error } = await getSupabaseAdmin().rpc("consume_integration_authorization_attempt", {
    p_attempt_id: input.attemptId,
    p_state_hash: input.stateHash,
    p_actor_admin_user_id: input.actorAdminUserId,
  });
  if (error) throw new Error(error.message);
  const row = asRecord(data, "integration_oauth_attempt");
  const integration = requireLiveIntegrationKey(String(row.integrationKey));
  const verifierSecretId = optionalText(row.pkceVerifierSecretId);
  const pkceVerifier = await readVaultSecret(verifierSecretId);
  await deleteIntegrationVaultSecret(verifierSecretId);
  return {
    integration,
    environmentKey: String(row.environmentKey),
    returnPath: String(row.returnPath),
    pkceVerifier,
  };
}

export async function pruneAuthorizationAttempts() {
  const { data, error } = await getSupabaseAdmin().rpc("prune_integration_authorization_attempts");
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function promoteAuthorization(input: {
  integration: LiveIntegrationKey;
  actorAdminUserId: number;
  tokenSet: ProviderTokenSet;
}) {
  const accessSecretId = await createIntegrationVaultSecret(
    input.tokenSet.accessToken,
    `integration-access-${input.integration}-${Date.now()}`,
    "Provider access credential managed by External Integrations Capability.",
  );
  const refreshSecretId = input.tokenSet.refreshToken
    ? await createIntegrationVaultSecret(
        input.tokenSet.refreshToken,
        `integration-refresh-${input.integration}-${Date.now()}`,
        "Provider refresh credential managed by External Integrations Capability.",
      )
    : null;
  const { data, error } = await getSupabaseAdmin().rpc("promote_integration_authorization", {
    p_integration_key: input.integration,
    p_environment_key: getIntegrationsEnvironmentKey(),
    p_actor_admin_user_id: input.actorAdminUserId,
    p_credential_strategy: input.tokenSet.strategy.kind,
    p_access_secret_id: accessSecretId,
    p_refresh_secret_id: refreshSecretId,
    p_external_subject_id: input.tokenSet.externalSubjectId,
    p_granted_scopes: input.tokenSet.grantedScopes,
    p_access_expires_at: input.tokenSet.accessExpiresAt,
    p_refresh_expires_at: input.tokenSet.refreshExpiresAt,
  });
  if (error || typeof data !== "string") {
    await Promise.all([deleteIntegrationVaultSecret(accessSecretId), deleteIntegrationVaultSecret(refreshSecretId)]);
    throw new Error(error?.message ?? "integration_authorization_promotion_failed");
  }
  return data;
}

export async function rotateCredentials(connectionId: string, tokenSet: ProviderTokenSet) {
  const accessSecretId = await createIntegrationVaultSecret(
    tokenSet.accessToken,
    `integration-access-rotation-${connectionId}-${Date.now()}`,
    "Rotated provider access credential.",
  );
  const refreshSecretId = tokenSet.refreshToken
    ? await createIntegrationVaultSecret(
        tokenSet.refreshToken,
        `integration-refresh-rotation-${connectionId}-${Date.now()}`,
        "Rotated provider refresh credential.",
      )
    : null;
  const { error } = await getSupabaseAdmin().rpc("rotate_integration_credentials", {
    p_connection_id: connectionId,
    p_access_secret_id: accessSecretId,
    p_refresh_secret_id: refreshSecretId,
    p_granted_scopes: tokenSet.grantedScopes,
    p_access_expires_at: tokenSet.accessExpiresAt,
    p_refresh_expires_at: tokenSet.refreshExpiresAt,
  });
  if (error) {
    await Promise.all([deleteIntegrationVaultSecret(accessSecretId), deleteIntegrationVaultSecret(refreshSecretId)]);
    throw new Error(error.message);
  }
}

export async function setConnectionStatus(
  connectionId: string,
  status: PersistedIntegrationConnection["status"],
  actorAdminUserId: number,
  failure?: { code: string; message: string } | null,
) {
  const { error } = await getSupabaseAdmin().from("integration_connections").update({
    status,
    last_error_code: failure?.code ?? null,
    last_error_message: failure?.message.slice(0, 500) ?? null,
    updated_by_admin_user_id: actorAdminUserId,
    updated_at: new Date().toISOString(),
  }).eq("id", connectionId).is("revoked_at", null);
  if (error) throw new Error(error.message);
}

export async function replaceDiscoveredAssets(
  connectionId: string,
  assets: readonly IntegrationAsset[],
  actorAdminUserId: number,
) {
  const { data, error } = await getSupabaseAdmin().rpc("replace_integration_discovered_assets", {
    p_connection_id: connectionId,
    p_assets: assets.map(integrationAssetJson),
    p_actor_admin_user_id: actorAdminUserId,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function selectConnectionAssets(
  connectionId: string,
  assetIds: string[],
  actorAdminUserId: number,
) {
  const { data, error } = await getSupabaseAdmin().rpc("select_integration_assets", {
    p_connection_id: connectionId,
    p_asset_ids: assetIds,
    p_actor_admin_user_id: actorAdminUserId,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function getRuntimeConnection(connectionId: string) {
  const database = getSupabaseAdmin();
  const [connectionResult, credentialResult, assetsResult] = await Promise.all([
    database.from("integration_connections").select("*").eq("id", connectionId).is("revoked_at", null).single(),
    database.from("integration_credentials").select("*").eq("connection_id", connectionId).single(),
    database.from("integration_connection_assets").select("*").eq("connection_id", connectionId).order("discovered_at"),
  ]);
  const error = connectionResult.error ?? credentialResult.error ?? assetsResult.error;
  if (error || !connectionResult.data || !credentialResult.data) {
    throw new Error(error?.message ?? "integration_connection_runtime_missing");
  }
  const connectionRow = connectionResult.data;
  const credentialRow = credentialResult.data;
  const assets = (assetsResult.data ?? []).map(mapAsset);
  const accessToken = await readVaultSecret(credentialRow.access_secret_id);
  if (!accessToken) throw new Error("integration_access_credential_missing");
  return {
    connection: mapConnection(connectionRow, assets, false),
    accessToken,
    refreshToken: await readVaultSecret(optionalText(credentialRow.refresh_secret_id)),
  };
}

export async function findRuntimeConnection(integration: LiveIntegrationKey) {
  const { data, error } = await getSupabaseAdmin()
    .from("integration_connections")
    .select("id")
    .eq("integration_key", integration)
    .eq("environment_key", getIntegrationsEnvironmentKey())
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? getRuntimeConnection(data.id) : null;
}

export async function queueConnectionSync(
  connectionId: string,
  trigger: "initial" | "manual" | "cron",
  actorAdminUserId: number,
) {
  const { data, error } = await getSupabaseAdmin().rpc("queue_integration_initial_sync", {
    p_connection_id: connectionId,
    p_trigger_kind: trigger,
    p_actor_admin_user_id: actorAdminUserId,
  });
  if (error || typeof data !== "string") throw new Error(error?.message ?? "integration_sync_queue_failed");
  return data;
}

export async function claimSyncRun(runId?: string) {
  const { data, error } = await getSupabaseAdmin().rpc("claim_integration_sync_run", {
    ...(runId === undefined ? {} : { p_run_id: runId }),
    p_lease_seconds: 240,
  });
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = asRecord(data, "integration_sync_claim");
  return {
    runId: String(row.runId),
    connectionId: String(row.connectionId),
    leaseToken: String(row.leaseToken),
  };
}

export async function queueDueSyncRuns(limit = 8) {
  const { data, error } = await getSupabaseAdmin().rpc("queue_due_integration_sync_runs", {
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function completeSyncRun(input: {
  runId: string;
  leaseToken: string;
  status: "completed" | "partial";
  watermark: Record<string, unknown>;
  recordsWritten: number;
  message: string;
}) {
  const { error } = await getSupabaseAdmin().rpc("complete_integration_sync_run", {
    p_run_id: input.runId,
    p_lease_token: input.leaseToken,
    p_status: input.status,
    p_watermark: jsonRecord(input.watermark),
    p_records_written: input.recordsWritten,
    p_message: input.message,
  });
  if (error) throw new Error(error.message);
}

export async function failSyncRun(input: {
  runId: string;
  leaseToken: string;
  code: string;
  message: string;
  requiresReauth: boolean;
}) {
  const { error } = await getSupabaseAdmin().rpc("fail_integration_sync_run", {
    p_run_id: input.runId,
    p_lease_token: input.leaseToken,
    p_error_code: input.code,
    p_error_message: input.message,
    p_requires_reauth: input.requiresReauth,
  });
  if (error) throw new Error(error.message);
}

export async function revokeConnection(connectionId: string, actorAdminUserId: number) {
  const { error } = await getSupabaseAdmin().rpc("revoke_integration_connection", {
    p_connection_id: connectionId,
    p_actor_admin_user_id: actorAdminUserId,
  });
  if (error) throw new Error(error.message);
}
