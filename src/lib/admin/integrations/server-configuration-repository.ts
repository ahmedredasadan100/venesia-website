import "server-only";

import type { Json, Tables } from "../../database.types";
import { getSupabaseAdmin } from "../../supabase-admin";
import { getIntegrationsEnvironmentKey } from "./connection-repository";
import {
  INTEGRATION_APP_CONFIGURATION_KEYS,
  isIntegrationAppConfigurationProvider,
} from "./server-configuration-contract";
import type {
  IntegrationAppConfigurationKey,
  IntegrationAppConfigurationProvider,
  IntegrationAppConfigurationStatus,
} from "./server-configuration-contract";

type JsonRecord = Record<string, Json | undefined>;
type ConfigurationGroupRow = Pick<
  Tables<"integration_app_configuration_groups">,
  "id" | "provider_key" | "environment_key" | "configuration_source" | "version" | "updated_at"
>;
type ConfigurationEntryRow = Pick<
  Tables<"integration_app_configuration_entries">,
  "group_id" | "configuration_key" | "is_secret" | "vault_secret_id" | "safe_value"
>;
type ConfigurationValidationRow = Pick<
  Tables<"integration_app_configuration_validations">,
  | "group_id"
  | "integration_key"
  | "status"
  | "missing_keys"
  | "last_tested_at"
  | "safe_error_code"
  | "version"
>;

export type PersistedApplicationConfigurationEntry = {
  key: IntegrationAppConfigurationKey;
  secret: boolean;
  secretId: string | null;
  safeValue: string | null;
};

export type ApplicationConfigurationReplacementEntry = PersistedApplicationConfigurationEntry & {
  secretValue?: string | null;
};

export type PersistedApplicationConfigurationValidation = {
  integration: string;
  status: IntegrationAppConfigurationStatus;
  missing: IntegrationAppConfigurationKey[];
  lastTestedAt: string | null;
  safeErrorCode: string | null;
  version: number;
};

export type PersistedApplicationConfigurationGroup = {
  id: string;
  provider: IntegrationAppConfigurationProvider;
  environmentKey: string;
  source: "cms_vault" | "environment_import";
  version: number;
  updatedAt: string;
  entries: PersistedApplicationConfigurationEntry[];
  validations: PersistedApplicationConfigurationValidation[];
};

function optionalText(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function isJsonRecord(value: Json): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isConfigurationKey(value: string): value is IntegrationAppConfigurationKey {
  return INTEGRATION_APP_CONFIGURATION_KEYS.some((key) => key === value);
}

function requireConfigurationKey(value: string): IntegrationAppConfigurationKey {
  if (isConfigurationKey(value)) return value;
  throw new Error("integration_app_configuration_key_invalid");
}

function requireConfigurationStatus(value: string): IntegrationAppConfigurationStatus {
  if (value === "needs_configuration" ||
    value === "configuration_incomplete" ||
    value === "configuration_invalid" ||
    value === "configuration_saved_waiting_for_authorization" ||
    value === "ready_to_connect") {
    return value;
  }
  throw new Error("integration_app_configuration_status_invalid");
}

function requireConfigurationSource(value: string): PersistedApplicationConfigurationGroup["source"] {
  if (value === "cms_vault" || value === "environment_import") return value;
  throw new Error("integration_app_configuration_source_invalid");
}

function requireConfigurationProvider(value: string): IntegrationAppConfigurationProvider {
  if (isIntegrationAppConfigurationProvider(value)) return value;
  throw new Error("integration_app_configuration_provider_invalid");
}

function configurationKeys(value: string[]) {
  return value.map(requireConfigurationKey);
}

function mapGroup(
  row: ConfigurationGroupRow,
  entryRows: ConfigurationEntryRow[],
  validationRows: ConfigurationValidationRow[],
): PersistedApplicationConfigurationGroup {
  const groupId = row.id;
  return {
    id: groupId,
    provider: requireConfigurationProvider(row.provider_key),
    environmentKey: row.environment_key,
    source: requireConfigurationSource(row.configuration_source),
    version: row.version,
    updatedAt: row.updated_at,
    entries: entryRows
      .filter((entry) => entry.group_id === groupId)
      .map((entry) => ({
        key: requireConfigurationKey(entry.configuration_key),
        secret: entry.is_secret,
        secretId: optionalText(entry.vault_secret_id),
        safeValue: optionalText(entry.safe_value),
      })),
    validations: validationRows
      .filter((validation) => validation.group_id === groupId)
      .map((validation) => ({
        integration: validation.integration_key,
        status: requireConfigurationStatus(validation.status),
        missing: configurationKeys(validation.missing_keys),
        lastTestedAt: optionalText(validation.last_tested_at),
        safeErrorCode: optionalText(validation.safe_error_code),
        version: validation.version,
      })),
  };
}

export async function loadApplicationConfigurationGroups() {
  const database = getSupabaseAdmin();
  const environmentKey = getIntegrationsEnvironmentKey();
  const groupsResult = await database
    .from("integration_app_configuration_groups")
    .select("id,provider_key,environment_key,configuration_source,version,updated_at")
    .eq("environment_key", environmentKey)
    .order("provider_key");
  if (groupsResult.error) {
    if (["42P01", "PGRST205"].includes(groupsResult.error.code ?? "")) {
      throw new Error("integration_app_configuration_persistence_not_installed");
    }
    throw new Error("integration_app_configuration_persistence_unavailable");
  }
  const groups = groupsResult.data ?? [];
  if (!groups.length) return [];
  const groupIds = groups.map((group) => group.id);
  const [entriesResult, validationsResult] = await Promise.all([
    database
      .from("integration_app_configuration_entries")
      .select("group_id,configuration_key,is_secret,vault_secret_id,safe_value")
      .in("group_id", groupIds),
    database
      .from("integration_app_configuration_validations")
      .select("group_id,integration_key,status,missing_keys,last_tested_at,safe_error_code,version")
      .in("group_id", groupIds),
  ]);
  const error = entriesResult.error ?? validationsResult.error;
  if (error) throw new Error("integration_app_configuration_persistence_unavailable");
  const entries = entriesResult.data ?? [];
  const validations = validationsResult.data ?? [];
  return groups.map((group) =>
    mapGroup(group, entries, validations),
  );
}

export async function loadApplicationConfigurationGroup(
  provider: IntegrationAppConfigurationProvider,
) {
  return (await loadApplicationConfigurationGroups()).find((group) => group.provider === provider) ?? null;
}

export async function replaceApplicationConfiguration(input: {
  provider: IntegrationAppConfigurationProvider;
  expectedVersion: number;
  entries: ApplicationConfigurationReplacementEntry[];
  affectedIntegrations: string[];
  actorAdminUserId: number;
  source: "cms_vault" | "environment_import";
}) {
  const { data, error } = await getSupabaseAdmin().rpc("replace_integration_app_configuration", {
    p_provider_key: input.provider,
    p_environment_key: getIntegrationsEnvironmentKey(),
    p_expected_version: input.expectedVersion,
    p_entries: input.entries.map((entry) => ({
      configuration_key: entry.key,
      is_secret: entry.secret,
      secret_id: entry.secretId,
      secret_value: entry.secretValue ?? null,
      safe_value: entry.safeValue,
    })),
    p_affected_integrations: input.affectedIntegrations,
    p_actor_admin_user_id: input.actorAdminUserId,
    p_configuration_source: input.source === "environment_import" ? "environment_import" : "cms_vault",
  });
  if (error || !isJsonRecord(data)) {
    throw new Error(error?.message ?? "integration_app_configuration_replace_failed");
  }
  return { groupId: String(data.groupId), version: Number(data.version) };
}

export async function removeApplicationConfiguration(input: {
  provider: IntegrationAppConfigurationProvider;
  expectedVersion: number;
  actorAdminUserId: number;
}) {
  const { data, error } = await getSupabaseAdmin().rpc("remove_integration_app_configuration", {
    p_provider_key: input.provider,
    p_environment_key: getIntegrationsEnvironmentKey(),
    p_expected_version: input.expectedVersion,
    p_actor_admin_user_id: input.actorAdminUserId,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function claimApplicationConfigurationTest(input: {
  integration: string;
  expectedVersion: number;
}) {
  const { data, error } = await getSupabaseAdmin().rpc("claim_integration_app_configuration_test", {
    p_integration_key: input.integration,
    p_environment_key: getIntegrationsEnvironmentKey(),
    p_expected_group_version: input.expectedVersion,
  });
  if (error || !isJsonRecord(data)) {
    throw new Error(error?.message ?? "integration_app_configuration_test_claim_failed");
  }
  return {
    groupVersion: Number(data.groupVersion),
    testVersion: Number(data.testVersion),
  };
}

export async function completeApplicationConfigurationTest(input: {
  integration: string;
  testVersion: number;
  status:
    | "configuration_invalid"
    | "configuration_saved_waiting_for_authorization"
    | "ready_to_connect";
  safeErrorCode: string | null;
}) {
  const { error } = await getSupabaseAdmin().rpc("complete_integration_app_configuration_test", {
    p_integration_key: input.integration,
    p_environment_key: getIntegrationsEnvironmentKey(),
    p_test_version: input.testVersion,
    p_status: input.status,
    ...(input.safeErrorCode === null
      ? {}
      : { p_safe_error_code: input.safeErrorCode }),
  });
  if (error) throw new Error(error.message);
}
