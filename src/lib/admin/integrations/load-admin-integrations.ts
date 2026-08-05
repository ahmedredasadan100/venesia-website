import "server-only";

import { requireAdminSession } from "../auth/require-admin-session";
import { loadIntegrationPersistenceSnapshot } from "./connection-repository";
import {
  INTEGRATION_DEFINITIONS,
  INTEGRATIONS_CONTRACT_VERSION,
  latestTimestamp,
  type IntegrationConnectionStatus,
  type IntegrationSnapshotItem,
  type IntegrationsSnapshot,
  type PersistedIntegrationConnection,
} from "./integrations-contract";
import { integrationProviderRegistry } from "./provider-registry";

function connectionMessage(connection: PersistedIntegrationConnection) {
  if (connection.lastErrorMessage) return connection.lastErrorMessage;
  const messages: Record<PersistedIntegrationConnection["status"], string> = {
    authorized_unbound: "Authorization succeeded. Asset discovery has not completed.",
    discovering_assets: "Discovering first-party assets available to the authorized account.",
    pending_selection: "Select the required first-party assets before testing the connection.",
    testing: "Selected assets are awaiting a real provider connection test.",
    syncing: "Connection test passed and the initial or scheduled synchronization is running.",
    connected: "Authorization, asset selection, provider test, and synchronization are proven.",
    needs_reauth: "Provider authorization is no longer valid and must be renewed.",
    needs_attention: "The connection exists but validation or synchronization requires attention.",
  };
  return messages[connection.status];
}

function platformItem(input: {
  definition: (typeof INTEGRATION_DEFINITIONS)[number];
  connection: PersistedIntegrationConnection | null;
  checkedAt: string;
  databaseAvailable: boolean;
}): IntegrationSnapshotItem {
  const { definition, connection, checkedAt, databaseAvailable } = input;
  if (!definition.liveConnectionSupported) {
    return {
      ...definition,
      connectionId: null,
      status: "unavailable",
      checkedAt,
      lastSyncAt: null,
      nextSyncAt: null,
      message: "This integration is intentionally outside the approved live-connection scope.",
      security: "guarded",
      configureHref: null,
      testHref: null,
      reportsAvailable: false,
      availableAssets: [],
      selectedAssets: [],
      missingConfiguration: [],
    };
  }
  const adapter = integrationProviderRegistry.get(definition.key);
  const configuration = adapter.configuration();
  const configureHref = `/admin/settings/integrations/${definition.key}`;
  if (!databaseAvailable) {
    return {
      ...definition,
      connectionId: null,
      status: "unavailable",
      checkedAt,
      lastSyncAt: null,
      nextSyncAt: null,
      message: "Connection Aggregate is unavailable; no inferred state is shown.",
      security: "needs_attention",
      configureHref,
      testHref: null,
      reportsAvailable: false,
      availableAssets: [],
      selectedAssets: [],
      missingConfiguration: configuration.missing,
    };
  }
  if (!configuration.configured) {
    return {
      ...definition,
      connectionId: connection?.id ?? null,
      status: "needs_configuration",
      checkedAt,
      lastSyncAt: connection?.lastSyncAt ?? null,
      nextSyncAt: null,
      message: configuration.message,
      security: "guarded",
      configureHref,
      testHref: null,
      reportsAvailable: false,
      availableAssets: connection?.assets ?? [],
      selectedAssets: connection?.assets.filter((asset) => asset.selected) ?? [],
      missingConfiguration: configuration.missing,
    };
  }
  if (!connection) {
    return {
      ...definition,
      connectionId: null,
      status: "disconnected",
      checkedAt,
      lastSyncAt: null,
      nextSyncAt: null,
      message: "No Connection Aggregate exists for this provider in the current environment.",
      security: "guarded",
      configureHref,
      testHref: null,
      reportsAvailable: false,
      availableAssets: [],
      selectedAssets: [],
      missingConfiguration: [],
    };
  }
  const status = connection.status as IntegrationConnectionStatus;
  return {
    ...definition,
    connectionId: connection.id,
    status,
    checkedAt,
    lastSyncAt: connection.lastSyncAt,
    nextSyncAt: connection.nextSyncAt,
    message: connectionMessage(connection),
    security: connection.status === "needs_reauth" ? "needs_attention" : "guarded",
    configureHref,
    testHref: connection.status === "pending_selection" || connection.status === "testing" || connection.status === "connected" || connection.status === "needs_attention"
      ? `${configureHref}?action=test`
      : null,
    reportsAvailable: connection.status === "connected" && Boolean(definition.analyticsProvider) && connection.analyticsReady,
    availableAssets: connection.assets,
    selectedAssets: connection.assets.filter((asset) => asset.selected),
    missingConfiguration: [],
  };
}

function unavailableSnapshot(checkedAt: string): IntegrationsSnapshot {
  const integrations = INTEGRATION_DEFINITIONS.map((definition) => platformItem({
    definition,
    connection: null,
    checkedAt,
    databaseAvailable: false,
  }));
  return {
    contractVersion: INTEGRATIONS_CONTRACT_VERSION,
    state: "unavailable",
    checkedAt,
    security: "needs_attention",
    vaultAvailable: false,
    databaseAvailable: false,
    migrationRegistered: false,
    lastSyncAt: null,
    statistics: statistics(integrations),
    integrations,
  };
}

function statistics(integrations: IntegrationSnapshotItem[]) {
  const connectingStates: IntegrationConnectionStatus[] = ["authorizing", "authorized_unbound", "discovering_assets", "pending_selection", "testing"];
  return {
    total: integrations.length,
    connected: integrations.filter((item) => item.status === "connected").length,
    needsAttention: integrations.filter((item) => ["needs_attention", "needs_reauth", "needs_configuration"].includes(item.status)).length,
    disconnected: integrations.filter((item) => item.status === "disconnected").length,
    connecting: integrations.filter((item) => connectingStates.includes(item.status)).length,
    syncing: integrations.filter((item) => item.status === "syncing").length,
    unavailable: integrations.filter((item) => item.status === "unavailable").length,
  };
}

export async function loadAdminIntegrationsSnapshot(): Promise<IntegrationsSnapshot> {
  await requireAdminSession();
  const checkedAt = new Date().toISOString();
  try {
    const persistence = await loadIntegrationPersistenceSnapshot();
    const integrations = INTEGRATION_DEFINITIONS.map((definition) => platformItem({
      definition,
      connection: persistence.connections.find((connection) => connection.integrationKey === definition.key) ?? null,
      checkedAt,
      databaseAvailable: true,
    }));
    return {
      contractVersion: INTEGRATIONS_CONTRACT_VERSION,
      state: persistence.health.valid ? "ready" : "partial",
      checkedAt,
      security: persistence.health.vaultAvailable ? "guarded" : "needs_attention",
      vaultAvailable: persistence.health.vaultAvailable,
      databaseAvailable: true,
      migrationRegistered: persistence.health.migrationRegistered,
      lastSyncAt: latestTimestamp(integrations.map((item) => item.lastSyncAt)),
      statistics: statistics(integrations),
      integrations,
    };
  } catch {
    return unavailableSnapshot(checkedAt);
  }
}
