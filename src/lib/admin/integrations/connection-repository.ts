import "server-only";

import { createHash } from "node:crypto";

import { getSupabaseAdmin } from "../../supabase-admin";
import {
  INTEGRATIONS_MIGRATION_VERSION,
  type IntegrationAsset,
  type IntegrationCredentialStrategy,
  type LiveIntegrationKey,
  type PersistedIntegrationConnection,
} from "./integrations-contract";
import type { ProviderTokenSet } from "./provider-adapter-contract";

type JsonRecord = Record<string, unknown>;

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
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name}_invalid`);
  }
  return value as JsonRecord;
}

function optionalText(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function mapAsset(row: JsonRecord): IntegrationAsset {
  const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? row.metadata as IntegrationAsset["metadata"]
    : {};
  return {
    id: String(row.id),
    type: String(row.asset_type) as IntegrationAsset["type"],
    externalId: String(row.external_id),
    parentExternalId: optionalText(row.parent_external_id),
    displayName: String(row.display_name),
    permissions: stringArray(row.permissions),
    metadata,
    selected: Boolean(row.selected),
  };
}

function mapConnection(
  row: JsonRecord,
  assets: IntegrationAsset[],
  analyticsReady: boolean,
): PersistedIntegrationConnection {
  return {
    id: String(row.id),
    integrationKey: String(row.integration_key) as LiveIntegrationKey,
    externalSubjectId: optionalText(row.external_subject_id),
    status: String(row.status) as PersistedIntegrationConnection["status"],
    credentialStrategy: String(row.credential_strategy) as IntegrationCredentialStrategy["kind"],
    grantedScopes: stringArray(row.granted_scopes),
    accessExpiresAt: optionalText(row.access_expires_at),
    refreshExpiresAt: optionalText(row.refresh_expires_at),
    lastValidatedAt: optionalText(row.last_validated_at),
    lastSyncAt: optionalText(row.last_sync_at),
    nextSyncAt: optionalText(row.next_sync_at),
    lastErrorCode: optionalText(row.last_error_code),
    lastErrorMessage: optionalText(row.last_error_message),
    consecutiveFailures: Number(row.consecutive_failures ?? 0),
    backoffUntil: optionalText(row.backoff_until),
    version: Number(row.version ?? 1),
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
  for (const raw of assetsResult.data ?? []) {
    const row = raw as JsonRecord;
    const connectionId = String(row.connection_id);
    assetsByConnection.set(connectionId, [...(assetsByConnection.get(connectionId) ?? []), mapAsset(row)]);
  }
  const analyticsReady = new Set(
    (analyticsResult.data ?? [])
      .filter((raw) => {
        const row = raw as JsonRecord;
        return (row.status === "ready" || row.status === "partial") &&
          Array.isArray(row.metrics) && row.metrics.length > 0;
      })
      .map((raw) => String((raw as JsonRecord).connection_id)),
  );
  const connections = (connectionsResult.data ?? []).map((raw) => {
    const row = raw as JsonRecord;
    const id = String(row.id);
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
  return String((data as JsonRecord).id);
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
  const verifierSecretId = optionalText(row.pkceVerifierSecretId);
  const pkceVerifier = await readVaultSecret(verifierSecretId);
  await deleteIntegrationVaultSecret(verifierSecretId);
  return {
    integration: String(row.integrationKey) as LiveIntegrationKey,
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
    p_assets: assets,
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
  const connectionRow = connectionResult.data as JsonRecord;
  const credentialRow = credentialResult.data as JsonRecord;
  const assets = (assetsResult.data ?? []).map((row) => mapAsset(row as JsonRecord));
  const accessToken = await readVaultSecret(String(credentialRow.access_secret_id));
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
  return data ? getRuntimeConnection(String((data as JsonRecord).id)) : null;
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
    p_run_id: runId ?? null,
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
    p_watermark: input.watermark,
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
