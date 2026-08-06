import "server-only";

import { resolveCanonicalBaseUrl } from "../../seo/generate-sitemap-entries";
import {
  getIntegrationsEnvironmentKey,
  readVaultSecret,
} from "./connection-repository";
import type { LiveIntegrationKey } from "./integrations-contract";
import {
  applicationConfigurationProviderForIntegration,
  getIntegrationAppConfigurationDefinition,
  requiredApplicationConfigurationFields,
  type IntegrationAppConfigurationDiagnostic,
  type IntegrationAppConfigurationKey,
  type IntegrationAppConfigurationProvider,
} from "./server-configuration-contract";
import {
  loadApplicationConfigurationGroup,
  type PersistedApplicationConfigurationGroup,
} from "./server-configuration-repository";

export type ResolvedIntegrationApplicationConfiguration =
  IntegrationAppConfigurationDiagnostic & {
    values: Partial<Record<IntegrationAppConfigurationKey, string>>;
  };

function environmentValue(key: IntegrationAppConfigurationKey) {
  const provider = ["google", "meta", "tiktok", "snapchat"]
    .map((candidate) => getIntegrationAppConfigurationDefinition(candidate as IntegrationAppConfigurationProvider))
    .find((definition) => definition.fields.some((field) => field.key === key));
  const field = provider?.fields.find((candidate) => candidate.key === key);
  return field ? process.env[field.environmentBootstrapKey]?.trim() || null : null;
}

export function readEnvironmentBootstrapConfiguration(
  provider: IntegrationAppConfigurationProvider,
) {
  const values: Partial<Record<IntegrationAppConfigurationKey, string>> = {};
  for (const field of getIntegrationAppConfigurationDefinition(provider).fields) {
    const value = environmentValue(field.key);
    if (value) values[field.key] = value;
  }
  return values;
}

function validationFor(
  group: PersistedApplicationConfigurationGroup,
  integration: LiveIntegrationKey,
) {
  return group.validations.find((validation) => validation.integration === integration) ?? null;
}

function safeMessage(input: {
  source: "cms_vault" | "environment_bootstrap" | "none";
  missing: IntegrationAppConfigurationKey[];
  status: IntegrationAppConfigurationDiagnostic["status"];
  lastTestedAt: string | null;
}) {
  if (input.source === "none") return "App credentials are not configured.";
  if (input.missing.length) return "The selected configuration owner is incomplete.";
  if (input.status === "configuration_invalid") return "The latest safe configuration test failed.";
  if (input.source === "environment_bootstrap") {
    return "Using the declared legacy environment bootstrap. Import it into CMS Vault to close compatibility.";
  }
  if (input.status === "configuration_saved_waiting_for_authorization" && !input.lastTestedAt) {
    return "Configuration is saved in Vault and must pass the safe pre-authorization test.";
  }
  if (input.status === "configuration_saved_waiting_for_authorization") {
    return "Safe preflight passed; the official provider check requires user authorization.";
  }
  return "Application configuration is ready for provider authorization.";
}

async function valuesFromGroup(
  group: PersistedApplicationConfigurationGroup,
  required: ReturnType<typeof requiredApplicationConfigurationFields>,
  includeSecrets: boolean,
) {
  const values: Partial<Record<IntegrationAppConfigurationKey, string>> = {};
  for (const field of required) {
    const entry = group.entries.find((candidate) => candidate.key === field.key);
    if (!entry) continue;
    if (!entry.secret && entry.safeValue) values[field.key] = entry.safeValue;
    if (entry.secret && includeSecrets && entry.secretId) {
      const value = await readVaultSecret(entry.secretId);
      if (value) values[field.key] = value;
    }
  }
  return values;
}

export async function resolveIntegrationApplicationConfiguration(
  integration: LiveIntegrationKey,
  options: { includeSecrets?: boolean; allowUntested?: boolean } = {},
): Promise<ResolvedIntegrationApplicationConfiguration> {
  const provider = applicationConfigurationProviderForIntegration(integration);
  const required = requiredApplicationConfigurationFields(integration);
  let group: PersistedApplicationConfigurationGroup | null;
  try {
    group = await loadApplicationConfigurationGroup(provider);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "integration_app_configuration_persistence_not_installed") {
      throw error;
    }
    group = null;
  }

  if (group) {
    const values = await valuesFromGroup(group, required, options.includeSecrets === true);
    const missing = required
      .filter((field) => !group.entries.some((entry) => entry.key === field.key))
      .map((field) => field.key);
    const validation = validationFor(group, integration);
    const status = missing.length
      ? "configuration_incomplete" as const
      : validation?.status ?? "configuration_saved_waiting_for_authorization";
    const lastTestedAt = validation?.lastTestedAt ?? null;
    const configured = missing.length === 0 && status !== "configuration_invalid" && (
      options.allowUntested === true ||
      status === "ready_to_connect" ||
      (status === "configuration_saved_waiting_for_authorization" && Boolean(lastTestedAt))
    );
    return {
      integration,
      provider,
      status,
      source: "cms_vault",
      configured,
      missing,
      message: safeMessage({ source: "cms_vault", missing, status, lastTestedAt }),
      lastTestedAt,
      safeErrorCode: validation?.safeErrorCode ?? null,
      version: group.version,
      values,
    };
  }

  const values: Partial<Record<IntegrationAppConfigurationKey, string>> = {};
  const present = new Set<IntegrationAppConfigurationKey>();
  for (const field of required) {
    const value = environmentValue(field.key);
    if (!value) continue;
    present.add(field.key);
    if (!field.secret || options.includeSecrets === true) values[field.key] = value;
  }
  const missing = required.filter((field) => !present.has(field.key)).map((field) => field.key);
  const source = missing.length === required.length ? "none" as const : "environment_bootstrap" as const;
  const status = missing.length
    ? (source === "none" ? "needs_configuration" as const : "configuration_incomplete" as const)
    : "configuration_saved_waiting_for_authorization" as const;
  return {
    integration,
    provider,
    status,
    source,
    configured: missing.length === 0,
    missing,
    message: safeMessage({ source, missing, status, lastTestedAt: null }),
    lastTestedAt: null,
    safeErrorCode: null,
    version: 0,
    values,
  };
}

export async function requireIntegrationApplicationConfiguration(
  integration: LiveIntegrationKey,
) {
  const resolved = await resolveIntegrationApplicationConfiguration(integration, {
    includeSecrets: true,
  });
  if (!resolved.configured) {
    throw new Error(`integration_provider_not_configured:${resolved.missing.join(",")}`);
  }
  return resolved;
}

export function requireApplicationConfigurationValue(
  configuration: ResolvedIntegrationApplicationConfiguration,
  key: IntegrationAppConfigurationKey,
) {
  const value = configuration.values[key];
  if (!value) throw new Error(`integration_app_configuration_value_missing:${key}`);
  return value;
}

export async function resolveIntegrationOAuthOrigin() {
  const raw = await resolveCanonicalBaseUrl();
  const url = new URL(raw);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("integrations_oauth_base_url_https_required");
  }
  if (!url.hostname || url.username || url.password) {
    throw new Error("integrations_oauth_base_url_invalid");
  }
  return url.origin;
}

export async function integrationCallbackUri(integration: LiveIntegrationKey) {
  return `${await resolveIntegrationOAuthOrigin()}/api/admin/integrations/${integration}/callback`;
}

export function currentIntegrationEnvironmentKey() {
  return getIntegrationsEnvironmentKey();
}

export function resolveMetaGraphApiVersion() {
  const value = process.env.META_GRAPH_API_VERSION?.trim() || "v24.0";
  if (!/^v\d+\.\d+$/.test(value)) throw new Error("meta_graph_api_version_invalid");
  return value;
}

export function resolveGoogleAdsApiVersion() {
  const value = process.env.GOOGLE_ADS_API_VERSION?.trim() || "v25";
  if (!/^v\d+$/.test(value)) throw new Error("google_ads_api_version_invalid");
  return value;
}
