import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";

import { AUDIT_ACTIONS } from "../audit/audit-actions";
import { recordAdminAuditEvent } from "../audit/record-admin-audit-event";
import type { AdminUserRecord } from "../auth/admin-users";
import {
  consumeAuthorizationAttempt,
  createAuthorizationAttempt,
  findRuntimeConnection,
  getRuntimeConnection,
  hashOAuthState,
  pruneAuthorizationAttempts,
  promoteAuthorization,
  queueConnectionSync,
  replaceDiscoveredAssets,
  revokeConnection,
  selectConnectionAssets,
  setConnectionStatus,
} from "./connection-repository";
import { getFreshRuntimeConnection, providerRuntimeContext, type IntegrationRuntimeConnection } from "./credential-manager";
import { assertRequiredAssets, getIntegrationDefinition, type LiveIntegrationKey } from "./integrations-contract";
import { integrationProviderRegistry } from "./provider-registry";
import { ProviderRequestError } from "./provider-http";
import { callbackUri } from "./providers/shared";
import { runIntegrationSync } from "./sync-coordinator";

function actor(user: AdminUserRecord) {
  return { actorAdminUserId: user.id, actorUsername: user.username };
}

function safeFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "integration_operation_failed";
  return {
    code: error instanceof ProviderRequestError ? error.code : message.split(":")[0].slice(0, 120),
    message: message.slice(0, 500),
    requiresReauth: (error instanceof ProviderRequestError && error.requiresReauth) || /reauthorization|invalid_grant|token.*expired/i.test(message),
  };
}

function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

function assertRouteOwnsConnection(
  runtime: IntegrationRuntimeConnection,
  routeIntegration: LiveIntegrationKey,
) {
  if (runtime.connection.integrationKey !== routeIntegration) {
    throw new Error("integration_connection_provider_mismatch");
  }
}

async function audit(
  user: AdminUserRecord,
  action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS],
  integration: LiveIntegrationKey,
  metadata: Record<string, unknown>,
) {
  await recordAdminAuditEvent({
    ...actor(user),
    action,
    entityType: "integration_connection",
    entityLabel: getIntegrationDefinition(integration).label,
    metadata: { integration, ...metadata },
  });
}

export async function beginIntegrationAuthorization(
  integration: LiveIntegrationKey,
  user: AdminUserRecord,
) {
  const adapter = integrationProviderRegistry.get(integration);
  const configuration = adapter.configuration();
  if (!configuration.configured) {
    throw new Error(`integration_provider_not_configured:${configuration.missing.join(",")}`);
  }
  await pruneAuthorizationAttempts();
  const attemptId = randomUUID();
  const nonce = randomBytes(32).toString("base64url");
  const state = `${attemptId}.${nonce}`;
  const verifier = randomBytes(48).toString("base64url");
  const redirectUri = callbackUri(integration);
  const request = adapter.buildAuthorizationRequest({
    redirectUri,
    state,
    codeChallenge: pkceChallenge(verifier),
  });
  await createAuthorizationAttempt({
    id: attemptId,
    integration,
    actorAdminUserId: user.id,
    stateHash: hashOAuthState(state),
    pkceVerifier: request.pkceVerifierRequired ? verifier : null,
    returnPath: `/admin/settings/integrations/${integration}`,
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  await audit(user, AUDIT_ACTIONS.integrationAuthorizationStarted, integration, { attemptId });
  return request.url;
}

export async function completeIntegrationAuthorization(input: {
  routeIntegration: LiveIntegrationKey;
  code: string;
  state: string;
  user: AdminUserRecord;
}) {
  const [attemptId] = input.state.split(".");
  if (!attemptId) throw new Error("integration_oauth_state_invalid");
  const attempt = await consumeAuthorizationAttempt({
    attemptId,
    stateHash: hashOAuthState(input.state),
    actorAdminUserId: input.user.id,
  });
  if (attempt.integration !== input.routeIntegration) throw new Error("integration_oauth_provider_mismatch");
  const adapter = integrationProviderRegistry.get(input.routeIntegration);
  let connectionId: string;
  try {
    const tokenSet = await adapter.exchangeAuthorizationCode({
      code: input.code,
      redirectUri: callbackUri(input.routeIntegration),
      pkceVerifier: attempt.pkceVerifier,
    });
    connectionId = await promoteAuthorization({
      integration: input.routeIntegration,
      actorAdminUserId: input.user.id,
      tokenSet,
    });
    await audit(input.user, AUDIT_ACTIONS.integrationAuthorizationSucceeded, input.routeIntegration, {
      connectionId,
      credentialStrategy: tokenSet.strategy.kind,
      grantedScopes: tokenSet.grantedScopes,
    });
  } catch (error) {
    const safe = safeFailure(error);
    await audit(input.user, AUDIT_ACTIONS.integrationAuthorizationFailed, input.routeIntegration, {
      attemptId,
      code: safe.code,
    });
    throw error;
  }
  await discoverIntegrationAssets(connectionId, input.routeIntegration, input.user);
  return connectionId;
}

export async function discoverIntegrationAssets(
  connectionId: string,
  routeIntegration: LiveIntegrationKey,
  user: AdminUserRecord,
) {
  let runtime = await getRuntimeConnection(connectionId);
  assertRouteOwnsConnection(runtime, routeIntegration);
  const integration = runtime.connection.integrationKey;
  const adapter = integrationProviderRegistry.get(integration);
  await setConnectionStatus(connectionId, "discovering_assets", user.id);
  try {
    runtime = await getFreshRuntimeConnection(connectionId);
    const assets = await adapter.discoverAssets(providerRuntimeContext(runtime));
    const count = await replaceDiscoveredAssets(connectionId, assets, user.id);
    await audit(user, AUDIT_ACTIONS.integrationAssetsDiscovered, integration, { connectionId, count });
    return count;
  } catch (error) {
    const safe = safeFailure(error);
    await setConnectionStatus(connectionId, safe.requiresReauth ? "needs_reauth" : "needs_attention", user.id, safe);
    await audit(user, AUDIT_ACTIONS.integrationAssetsDiscoveryFailed, integration, {
      connectionId,
      code: safe.code,
      requiresReauth: safe.requiresReauth,
    });
    throw error;
  }
}

export async function selectTestAndSyncIntegration(input: {
  connectionId: string;
  routeIntegration: LiveIntegrationKey;
  assetIds: string[];
  user: AdminUserRecord;
}) {
  let runtime = await getFreshRuntimeConnection(input.connectionId);
  assertRouteOwnsConnection(runtime, input.routeIntegration);
  const adapter = integrationProviderRegistry.get(runtime.connection.integrationKey);
  const selected = runtime.connection.assets
    .filter((asset) => asset.id && input.assetIds.includes(asset.id))
    .map((asset) => ({ ...asset, selected: true }));
  assertRequiredAssets(runtime.connection.integrationKey, selected);
  adapter.validateAssetSelection(selected);
  await selectConnectionAssets(input.connectionId, input.assetIds, input.user.id);
  await audit(input.user, AUDIT_ACTIONS.integrationAssetsSelected, runtime.connection.integrationKey, {
    connectionId: input.connectionId,
    selectedAssetTypes: selected.map((asset) => asset.type),
  });
  runtime = await getFreshRuntimeConnection(input.connectionId);
  const test = await adapter.testConnection(providerRuntimeContext(runtime));
  if (!test.ok) {
    await setConnectionStatus(input.connectionId, test.requiresReauth ? "needs_reauth" : "needs_attention", input.user.id, {
      code: test.diagnosticCode,
      message: test.message,
    });
    await audit(input.user, AUDIT_ACTIONS.integrationTestFailed, runtime.connection.integrationKey, {
      connectionId: input.connectionId,
      code: test.diagnosticCode,
    });
    throw new Error(test.diagnosticCode);
  }
  await audit(input.user, AUDIT_ACTIONS.integrationTestSucceeded, runtime.connection.integrationKey, {
    connectionId: input.connectionId,
  });
  const runId = await queueConnectionSync(input.connectionId, "initial", input.user.id);
  await audit(input.user, AUDIT_ACTIONS.integrationSyncRequested, runtime.connection.integrationKey, {
    connectionId: input.connectionId,
    runId,
    trigger: "initial",
  });
  const result = await runIntegrationSync(runId);
  if (!result.completed) throw new Error(result.error?.code ?? "integration_initial_sync_failed");
  return result;
}

export async function testExistingIntegration(
  connectionId: string,
  routeIntegration: LiveIntegrationKey,
  user: AdminUserRecord,
) {
  const runtime = await getFreshRuntimeConnection(connectionId);
  assertRouteOwnsConnection(runtime, routeIntegration);
  const adapter = integrationProviderRegistry.get(runtime.connection.integrationKey);
  const selected = runtime.connection.assets.filter((asset) => asset.selected);
  adapter.validateAssetSelection(selected);
  const test = await adapter.testConnection(providerRuntimeContext(runtime));
  await audit(user, test.ok ? AUDIT_ACTIONS.integrationTestSucceeded : AUDIT_ACTIONS.integrationTestFailed, runtime.connection.integrationKey, {
    connectionId,
    code: test.diagnosticCode,
  });
  if (!test.ok) {
    await setConnectionStatus(connectionId, test.requiresReauth ? "needs_reauth" : "needs_attention", user.id, {
      code: test.diagnosticCode,
      message: test.message,
    });
  }
  return test;
}

export async function syncIntegrationNow(
  connectionId: string,
  routeIntegration: LiveIntegrationKey,
  user: AdminUserRecord,
) {
  const runtime = await getRuntimeConnection(connectionId);
  assertRouteOwnsConnection(runtime, routeIntegration);
  const runId = await queueConnectionSync(connectionId, "manual", user.id);
  await audit(user, AUDIT_ACTIONS.integrationSyncRequested, runtime.connection.integrationKey, { connectionId, runId, trigger: "manual" });
  return runIntegrationSync(runId);
}

export async function disconnectIntegration(
  connectionId: string,
  routeIntegration: LiveIntegrationKey,
  user: AdminUserRecord,
) {
  const runtime = await getRuntimeConnection(connectionId);
  assertRouteOwnsConnection(runtime, routeIntegration);
  const adapter = integrationProviderRegistry.get(runtime.connection.integrationKey);
  let revocation = { providerRevoked: false, message: "Provider revocation was not completed." };
  try {
    revocation = await adapter.revokeConnection(providerRuntimeContext(runtime));
  } catch (error) {
    if (!(error instanceof ProviderRequestError && error.requiresReauth)) throw error;
  }
  await revokeConnection(connectionId, user.id);
  await audit(user, AUDIT_ACTIONS.integrationDisconnected, runtime.connection.integrationKey, {
    connectionId,
    providerRevoked: revocation.providerRevoked,
    providerRevocationDisposition: revocation.providerRevoked ? "revoked" : "external_manual_action",
  });
}

export async function diagnoseIntegration(
  integration: LiveIntegrationKey,
  user: AdminUserRecord,
) {
  const runtime = await findRuntimeConnection(integration);
  if (!runtime) return null;
  const diagnostic = await integrationProviderRegistry.get(integration).diagnoseConnection(providerRuntimeContext(runtime));
  if (diagnostic.status !== "ready") {
    await setConnectionStatus(runtime.connection.id, diagnostic.requiresReauth ? "needs_reauth" : "needs_attention", user.id, {
      code: diagnostic.code,
      message: diagnostic.message,
    });
  }
  await audit(user, AUDIT_ACTIONS.integrationDiagnosed, integration, {
    connectionId: runtime.connection.id,
    status: diagnostic.status,
    code: diagnostic.code,
    requiresReauth: diagnostic.requiresReauth,
  });
  return diagnostic;
}
