import "server-only";

import { getSupabaseAdmin } from "../../supabase-admin";
import { getIntegrationsEnvironmentKey } from "./connection-repository";
import type {
  IntegrationAppConfigurationKey,
  IntegrationAppConfigurationProvider,
  IntegrationAppConfigurationStatus,
} from "./server-configuration-contract";

type JsonRecord = Record<string, unknown>;

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

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is IntegrationAppConfigurationKey => typeof item === "string")
    : [];
}

function mapGroup(
  row: JsonRecord,
  entryRows: JsonRecord[],
  validationRows: JsonRecord[],
): PersistedApplicationConfigurationGroup {
  const groupId = String(row.id);
  return {
    id: groupId,
    provider: String(row.provider_key) as IntegrationAppConfigurationProvider,
    environmentKey: String(row.environment_key),
    source: String(row.configuration_source) as "cms_vault" | "environment_import",
    version: Number(row.version ?? 0),
    updatedAt: String(row.updated_at),
    entries: entryRows
      .filter((entry) => String(entry.group_id) === groupId)
      .map((entry) => ({
        key: String(entry.configuration_key) as IntegrationAppConfigurationKey,
        secret: Boolean(entry.is_secret),
        secretId: optionalText(entry.vault_secret_id),
        safeValue: optionalText(entry.safe_value),
      })),
    validations: validationRows
      .filter((validation) => String(validation.group_id) === groupId)
      .map((validation) => ({
        integration: String(validation.integration_key),
        status: String(validation.status) as IntegrationAppConfigurationStatus,
        missing: stringArray(validation.missing_keys),
        lastTestedAt: optionalText(validation.last_tested_at),
        safeErrorCode: optionalText(validation.safe_error_code),
        version: Number(validation.version ?? 1),
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
  const groups = (groupsResult.data ?? []) as JsonRecord[];
  if (!groups.length) return [];
  const groupIds = groups.map((group) => String(group.id));
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
  const entries = (entriesResult.data ?? []) as JsonRecord[];
  const validations = (validationsResult.data ?? []) as JsonRecord[];
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
  if (error || !data || typeof data !== "object") {
    throw new Error(error?.message ?? "integration_app_configuration_replace_failed");
  }
  const result = data as JsonRecord;
  return { groupId: String(result.groupId), version: Number(result.version) };
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
  if (error || !data || typeof data !== "object") {
    throw new Error(error?.message ?? "integration_app_configuration_test_claim_failed");
  }
  const result = data as JsonRecord;
  return {
    groupVersion: Number(result.groupVersion),
    testVersion: Number(result.testVersion),
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
    p_safe_error_code: input.safeErrorCode,
  });
  if (error) throw new Error(error.message);
}
