import "server-only";

import { AUDIT_ACTIONS } from "../audit/audit-actions";
import { recordAdminAuditEvent } from "../audit/record-admin-audit-event";
import type { AdminUserRecord } from "../auth/admin-users";
import { getIntegrationDefinition, type LiveIntegrationKey } from "./integrations-contract";
import { integrationProviderRegistry } from "./provider-registry";
import {
  getIntegrationAppConfigurationDefinition,
  getIntegrationAppConfigurationSurface,
  type IntegrationAppConfigurationKey,
  type IntegrationAppConfigurationProvider,
  type IntegrationAppConfigurationSurface,
} from "./server-configuration-contract";
import {
  readEnvironmentBootstrapConfiguration,
  resolveIntegrationApplicationConfiguration,
} from "./server-configuration-resolver";
import {
  claimApplicationConfigurationTest,
  completeApplicationConfigurationTest,
  loadApplicationConfigurationGroup,
  removeApplicationConfiguration,
  replaceApplicationConfiguration,
  type ApplicationConfigurationReplacementEntry,
} from "./server-configuration-repository";

type ConfigurationInput = Partial<Record<IntegrationAppConfigurationKey, string>>;

function actor(user: AdminUserRecord) {
  return { actorAdminUserId: user.id, actorUsername: user.username };
}

async function audit(
  user: AdminUserRecord,
  action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS],
  provider: IntegrationAppConfigurationProvider,
  metadata: Record<string, unknown>,
) {
  await recordAdminAuditEvent({
    ...actor(user),
    action,
    entityType: "integration_app_configuration",
    entityLabel: getIntegrationAppConfigurationDefinition(provider).label,
    metadata: { provider, ...metadata },
  });
}

function trimmed(values: ConfigurationInput, key: IntegrationAppConfigurationKey) {
  const value = values[key];
  return typeof value === "string" ? value.trim() : "";
}

export async function saveIntegrationApplicationConfiguration(input: {
  provider: IntegrationAppConfigurationProvider;
  expectedVersion: number;
  values: ConfigurationInput;
  source?: "cms_vault" | "environment_import";
  user: AdminUserRecord;
}) {
  const definition = getIntegrationAppConfigurationDefinition(input.provider);
  const existing = await loadApplicationConfigurationGroup(input.provider);
  const entries: ApplicationConfigurationReplacementEntry[] = [];
  const changedKeys: IntegrationAppConfigurationKey[] = [];

  for (const field of definition.fields) {
      const current = existing?.entries.find((entry) => entry.key === field.key) ?? null;
      const next = trimmed(input.values, field.key);
      if (field.secret) {
        if (next) {
          entries.push({
            key: field.key,
            secret: true,
            secretId: null,
            secretValue: next,
            safeValue: null,
          });
          changedKeys.push(field.key);
        } else if (current?.secretId) {
          entries.push({ ...current, secretValue: null });
        }
      } else if (next) {
        entries.push({ key: field.key, secret: false, secretId: null, safeValue: next });
        if (current?.safeValue !== next) changedKeys.push(field.key);
      } else if (current?.safeValue) {
        entries.push(current);
      }
  }

  if (!entries.length) throw new Error("integration_app_configuration_empty");
  const affectedIntegrations = input.source === "environment_import" && !existing
    ? []
    : [...new Set(changedKeys.flatMap((key) =>
      definition.fields.find((field) => field.key === key)?.requiredBy ?? [],
    ))];
  const result = await replaceApplicationConfiguration({
    provider: input.provider,
    expectedVersion: input.expectedVersion,
    entries,
    affectedIntegrations,
    actorAdminUserId: input.user.id,
    source: input.source ?? "cms_vault",
  });
  await audit(
      input.user,
      existing
        ? AUDIT_ACTIONS.integrationAppConfigurationReplaced
        : AUDIT_ACTIONS.integrationAppConfigurationCreated,
      input.provider,
      {
        source: input.source ?? "cms_vault",
        fieldsChangedCount: changedKeys.length,
        version: result.version,
        affectedConnectionsRequireReauth: affectedIntegrations.length > 0,
      },
  );
  if (changedKeys.length) {
    await audit(
        input.user,
        AUDIT_ACTIONS.integrationAppConfigurationReadinessChanged,
        input.provider,
        { ready: false, reason: "configuration_changed", version: result.version },
    );
  }
  return result;
}

export async function importIntegrationApplicationConfiguration(
  provider: IntegrationAppConfigurationProvider,
  expectedVersion: number,
  user: AdminUserRecord,
) {
  const values = readEnvironmentBootstrapConfiguration(provider);
  if (!Object.values(values).some(Boolean)) {
    throw new Error("integration_environment_bootstrap_missing");
  }
  return saveIntegrationApplicationConfiguration({
    provider,
    expectedVersion,
    values,
    source: "environment_import",
    user,
  });
}

export async function removeIntegrationApplicationConfigurationOwner(
  provider: IntegrationAppConfigurationProvider,
  expectedVersion: number,
  user: AdminUserRecord,
) {
  const removed = await removeApplicationConfiguration({
    provider,
    expectedVersion,
    actorAdminUserId: user.id,
  });
  if (removed) {
    await audit(user, AUDIT_ACTIONS.integrationAppConfigurationRemoved, provider, {
      version: expectedVersion,
      affectedConnectionsRequireReauth: true,
    });
    await audit(user, AUDIT_ACTIONS.integrationAppConfigurationReadinessChanged, provider, {
      ready: false,
      reason: "configuration_removed",
    });
  }
  return { removed };
}

function safeTestFailure(error: unknown) {
  const code = error instanceof Error ? error.message.split(":")[0] : "integration_app_configuration_test_failed";
  return /^[a-z0-9_]{1,120}$/.test(code)
    ? code
    : "integration_app_configuration_test_failed";
}

export async function testIntegrationApplicationConfigurationSurface(input: {
  surface: IntegrationAppConfigurationSurface;
  expectedVersion: number;
  user: AdminUserRecord;
}) {
  const surface = getIntegrationAppConfigurationSurface(input.surface);
  const results: Array<{
    integration: LiveIntegrationKey;
    status: string;
    message: string;
    safeErrorCode: string | null;
  }> = [];

  for (const integration of surface.integrations) {
    const adapter = integrationProviderRegistry.get(integration);
    const before = await resolveIntegrationApplicationConfiguration(integration);
    if (before.missing.length) {
      results.push({
        integration,
        status: "configuration_incomplete",
        message: "Required application fields are missing.",
        safeErrorCode: "integration_app_configuration_incomplete",
      });
      continue;
    }

    let testVersion: number | null = null;
    try {
      const claim = await claimApplicationConfigurationTest({
        integration,
        expectedVersion: input.expectedVersion,
      });
      testVersion = claim.testVersion;
      const result = await adapter.testApplicationConfiguration();
      await completeApplicationConfigurationTest({
        integration,
        testVersion,
        status: result.status,
        safeErrorCode: result.safeErrorCode,
      });
      const passed = result.status !== "configuration_invalid";
      await audit(
        input.user,
        passed
          ? AUDIT_ACTIONS.integrationAppConfigurationTestPassed
          : AUDIT_ACTIONS.integrationAppConfigurationTestFailed,
        surface.owner,
        {
          integration,
          status: result.status,
          safeErrorCode: result.safeErrorCode,
        },
      );
      if (before.configured !== passed) {
        await audit(
          input.user,
          AUDIT_ACTIONS.integrationAppConfigurationReadinessChanged,
          surface.owner,
          { integration, ready: passed, status: result.status },
        );
      }
      results.push({ integration, ...result });
    } catch (error) {
      const safeErrorCode = safeTestFailure(error);
      if (testVersion != null) {
        await completeApplicationConfigurationTest({
          integration,
          testVersion,
          status: "configuration_invalid",
          safeErrorCode,
        }).catch(() => undefined);
      }
      await audit(
        input.user,
        AUDIT_ACTIONS.integrationAppConfigurationTestFailed,
        surface.owner,
        { integration, safeErrorCode },
      );
      results.push({
        integration,
        status: "configuration_invalid",
        message: "The safe provider configuration test failed.",
        safeErrorCode,
      });
    }
  }

  return {
    provider: surface.owner,
    surface: input.surface,
    results: results.map((result) => ({
      ...result,
      label: getIntegrationDefinition(result.integration).label,
    })),
  };
}
