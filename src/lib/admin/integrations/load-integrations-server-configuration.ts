import "server-only";

import { requireAdminSession } from "../auth/require-admin-session";
import { loadIntegrationPersistenceSnapshot } from "./connection-repository";
import {
  getIntegrationDefinition,
} from "./integrations-contract";
import { integrationProviderRegistry } from "./provider-registry";
import {
  INTEGRATION_APP_CONFIGURATION_SURFACE_DEFINITIONS,
  INTEGRATIONS_SERVER_CONFIGURATION_CONTRACT_VERSION,
  INTEGRATIONS_SERVER_CONFIGURATION_MIGRATION_VERSION,
  getIntegrationAppConfigurationDefinition,
  unavailableIntegrationAppConfigurationDiagnostic,
  type IntegrationsServerConfigurationSnapshot,
} from "./server-configuration-contract";
import {
  integrationCallbackUri,
  readEnvironmentBootstrapConfiguration,
  resolveIntegrationOAuthOrigin,
} from "./server-configuration-resolver";
import { loadApplicationConfigurationGroups } from "./server-configuration-repository";

export async function loadIntegrationsServerConfigurationSnapshot(): Promise<IntegrationsServerConfigurationSnapshot> {
  await requireAdminSession();
  const checkedAt = new Date().toISOString();
  const [groupsResult, healthResult, originResult, diagnostics] = await Promise.all([
    loadApplicationConfigurationGroups()
      .then((groups) => ({ groups, available: true as const }))
      .catch(() => ({ groups: [], available: false as const })),
    loadIntegrationPersistenceSnapshot()
      .then((result) => result.health)
      .catch(() => null),
    resolveIntegrationOAuthOrigin().catch(() => null),
    Promise.all(integrationProviderRegistry.definitions().map(async (adapter) => {
      try {
        return [adapter.integration, await adapter.configuration()] as const;
      } catch {
        return [adapter.integration, unavailableIntegrationAppConfigurationDiagnostic(adapter.integration)] as const;
      }
    })),
  ]);
  const diagnosticMap = new Map(diagnostics);

  const surfaces = await Promise.all(INTEGRATION_APP_CONFIGURATION_SURFACE_DEFINITIONS.map(async (surface) => {
    const definition = getIntegrationAppConfigurationDefinition(surface.owner);
    const group = groupsResult.groups.find((candidate) => candidate.provider === surface.owner) ?? null;
    const environment = group ? {} : readEnvironmentBootstrapConfiguration(surface.owner);
    const validations = surface.integrations.map((integration) => {
      const diagnostic = diagnosticMap.get(integration)!;
      return {
        integration,
        label: getIntegrationDefinition(integration).label,
        status: diagnostic.status,
        configured: diagnostic.configured,
        missing: diagnostic.missing,
        lastTestedAt: diagnostic.lastTestedAt,
        safeErrorCode: diagnostic.safeErrorCode,
      };
    });
    const source = validations.some((validation) => diagnosticMap.get(validation.integration)?.source === "cms_vault")
      ? "cms_vault" as const
      : validations.some((validation) => diagnosticMap.get(validation.integration)?.source === "environment_bootstrap")
        ? "environment_bootstrap" as const
        : "none" as const;
    const fields = definition.fields.map((field) => {
      const entry = group?.entries.find((candidate) => candidate.key === field.key) ?? null;
      return {
        key: field.key,
        label: field.label,
        secret: field.secret,
        placeholder: field.placeholder,
        help: field.help,
        configured: Boolean(entry) || Boolean(environment[field.key]),
        safeValue: field.secret ? null : entry?.safeValue ?? null,
      };
    });
    return {
      key: surface.key,
      owner: surface.owner,
      label: surface.label,
      description: surface.key === "whatsapp"
        ? "يستخدم Meta App owner نفسه دون تخزين App ID أوApp Secret مرة ثانية."
        : definition.description,
      sharedOwnerLabel: surface.key === "whatsapp" ? "Meta" : null,
      source,
      version: group?.version ?? 0,
      updatedAt: group?.updatedAt ?? null,
      fields,
      validations,
      callbackUrls: await Promise.all(surface.integrations.map(async (integration) => ({
        integration,
        label: getIntegrationDefinition(integration).label,
        url: originResult ? await integrationCallbackUri(integration) : "",
      }))),
    };
  }));

  const migrationRegistered = healthResult?.serverConfigurationMigrationRegistered === true &&
    healthResult.serverConfigurationMigrationVersion === INTEGRATIONS_SERVER_CONFIGURATION_MIGRATION_VERSION;
  const vaultAvailable = healthResult?.vaultAvailable === true;
  const state = groupsResult.available && migrationRegistered && vaultAvailable && originResult
    ? "ready" as const
    : groupsResult.available || originResult
      ? "partial" as const
      : "unavailable" as const;

  return {
    contractVersion: INTEGRATIONS_SERVER_CONFIGURATION_CONTRACT_VERSION,
    state,
    checkedAt,
    migrationRegistered,
    vaultAvailable,
    canonicalOrigin: originResult,
    surfaces,
  };
}
