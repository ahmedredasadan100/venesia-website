import "server-only";

import { logError, logInfo } from "../../logging";
import { ingestAnalyticsModel } from "../reports/analytics-ingestion-adapter";
import {
  claimSyncRun,
  completeSyncRun,
  failSyncRun,
  queueDueSyncRuns,
  pruneAuthorizationAttempts,
} from "./connection-repository";
import { getFreshRuntimeConnection, providerRuntimeContext } from "./credential-manager";
import { integrationProviderRegistry } from "./provider-registry";
import { ProviderRequestError } from "./provider-http";

function failure(error: unknown) {
  if (error instanceof ProviderRequestError) {
    return { code: error.code, message: error.message, requiresReauth: error.requiresReauth };
  }
  const message = error instanceof Error ? error.message : "Integration sync failed.";
  return {
    code: message.startsWith("integration_assets_missing") ? "integration_assets_missing" : "integration_sync_failed",
    message: message.slice(0, 500),
    requiresReauth: /invalid_grant|token.*expired|reauth/i.test(message),
  };
}

export async function runIntegrationSync(runId?: string) {
  const claim = await claimSyncRun(runId);
  if (!claim) return { claimed: false, completed: false, connectionId: null };
  try {
    const runtime = await getFreshRuntimeConnection(claim.connectionId);
    const adapter = integrationProviderRegistry.get(runtime.connection.integrationKey);
    adapter.validateAssetSelection(runtime.connection.assets.filter((asset) => asset.selected));
    const result = await adapter.syncAnalytics(providerRuntimeContext(runtime));
    if (!result.connectionReadModelValid) throw new Error("integration_sync_read_model_invalid");
    if (adapter.analyticsProvider) {
      if (result.analytics.length !== 1 || result.analytics[0]?.provider !== adapter.analyticsProvider) {
        throw new Error("integration_sync_analytics_projection_invalid");
      }
    } else if (result.analytics.length > 0) {
      throw new Error("integration_sync_unowned_analytics_projection");
    }
    for (const model of result.analytics) {
      await ingestAnalyticsModel(runtime.connection.id, model);
    }
    await completeSyncRun({
      runId: claim.runId,
      leaseToken: claim.leaseToken,
      status: result.status,
      watermark: result.watermark,
      recordsWritten: result.recordsWritten,
      message: result.message,
    });
    logInfo("Integration sync completed", {
      integration: runtime.connection.integrationKey,
      connectionId: runtime.connection.id,
      runId: claim.runId,
      status: result.status,
      recordsWritten: result.recordsWritten,
    });
    return { claimed: true, completed: true, connectionId: runtime.connection.id, result };
  } catch (error) {
    const safe = failure(error);
    await failSyncRun({ runId: claim.runId, leaseToken: claim.leaseToken, ...safe });
    logError("Integration sync failed", error, {
      connectionId: claim.connectionId,
      runId: claim.runId,
      code: safe.code,
    });
    return { claimed: true, completed: false, connectionId: claim.connectionId, error: safe };
  }
}

export async function runDueIntegrationSyncs(limit = 8) {
  const authorizationAttemptsPruned = await pruneAuthorizationAttempts();
  const queued = await queueDueSyncRuns(limit);
  const results = [];
  for (let index = 0; index < limit; index += 1) {
    const result = await runIntegrationSync();
    if (!result.claimed) break;
    results.push(result);
  }
  return { authorizationAttemptsPruned, queued, processed: results.length, completed: results.filter((item) => item.completed).length, failed: results.filter((item) => !item.completed).length };
}
