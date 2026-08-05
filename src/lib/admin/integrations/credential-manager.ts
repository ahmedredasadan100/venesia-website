import "server-only";

import { getRuntimeConnection, rotateCredentials } from "./connection-repository";
import { integrationProviderRegistry } from "./provider-registry";

export type IntegrationRuntimeConnection = Awaited<ReturnType<typeof getRuntimeConnection>>;

export function providerRuntimeContext(runtime: IntegrationRuntimeConnection) {
  return {
    connectionId: runtime.connection.id,
    integration: runtime.connection.integrationKey,
    externalSubjectId: runtime.connection.externalSubjectId,
    accessToken: runtime.accessToken,
    refreshToken: runtime.refreshToken,
    assets: runtime.connection.assets,
    accessExpiresAt: runtime.connection.accessExpiresAt,
    refreshExpiresAt: runtime.connection.refreshExpiresAt,
  };
}

function expiresSoon(expiresAt: string | null) {
  if (!expiresAt) return false;
  const timestamp = Date.parse(expiresAt);
  return Number.isFinite(timestamp) && timestamp <= Date.now() + 5 * 60_000;
}

export async function getFreshRuntimeConnection(connectionId: string) {
  let runtime = await getRuntimeConnection(connectionId);
  if (!expiresSoon(runtime.connection.accessExpiresAt)) return runtime;

  const adapter = integrationProviderRegistry.get(runtime.connection.integrationKey);
  const rotated = await adapter.refreshCredential(providerRuntimeContext(runtime));
  if (!rotated) throw new Error("integration_credential_requires_reauthorization");
  if (rotated.strategy.kind !== runtime.connection.credentialStrategy) {
    throw new Error("integration_credential_strategy_changed");
  }
  await rotateCredentials(connectionId, rotated);
  runtime = await getRuntimeConnection(connectionId);
  return runtime;
}
