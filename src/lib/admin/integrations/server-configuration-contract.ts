import type { LiveIntegrationKey } from "./integrations-contract";

export const INTEGRATIONS_SERVER_CONFIGURATION_CONTRACT_VERSION =
  "integrations-server-configuration-v1" as const;
export const INTEGRATIONS_SERVER_CONFIGURATION_MIGRATION_VERSION =
  "20260806140000" as const;

export const INTEGRATION_APP_CONFIGURATION_PROVIDERS = [
  "google",
  "meta",
  "tiktok",
  "snapchat",
] as const;

export type IntegrationAppConfigurationProvider =
  (typeof INTEGRATION_APP_CONFIGURATION_PROVIDERS)[number];

export const INTEGRATION_APP_CONFIGURATION_SURFACES = [
  "google",
  "meta",
  "tiktok",
  "snapchat",
  "whatsapp",
] as const;

export type IntegrationAppConfigurationSurface =
  (typeof INTEGRATION_APP_CONFIGURATION_SURFACES)[number];

export const INTEGRATION_APP_CONFIGURATION_KEYS = [
  "google_client_id",
  "google_client_secret",
  "google_ads_developer_token",
  "meta_app_id",
  "meta_app_secret",
  "tiktok_app_id",
  "tiktok_app_secret",
  "snapchat_client_id",
  "snapchat_client_secret",
] as const;

export type IntegrationAppConfigurationKey =
  (typeof INTEGRATION_APP_CONFIGURATION_KEYS)[number];

export type IntegrationAppConfigurationStatus =
  | "needs_configuration"
  | "configuration_incomplete"
  | "configuration_invalid"
  | "configuration_saved_waiting_for_authorization"
  | "ready_to_connect";

export type IntegrationAppConfigurationSource =
  | "cms_vault"
  | "environment_bootstrap"
  | "none";

export type IntegrationAppConfigurationFieldDefinition = {
  key: IntegrationAppConfigurationKey;
  label: string;
  secret: boolean;
  placeholder: string;
  help: string;
  requiredBy: readonly LiveIntegrationKey[];
  environmentBootstrapKey: string;
};

export type IntegrationAppConfigurationProviderDefinition = {
  key: IntegrationAppConfigurationProvider;
  label: string;
  description: string;
  fields: readonly IntegrationAppConfigurationFieldDefinition[];
  integrations: readonly LiveIntegrationKey[];
};

export const INTEGRATION_APP_CONFIGURATION_DEFINITIONS = [
  {
    key: "google",
    label: "Google",
    description: "OAuth لتكاملات Analytics وSearch Console وGoogle Ads، مع Developer Token مستقل لـAds.",
    integrations: ["google_analytics", "google_search_console", "google_ads"],
    fields: [
      {
        key: "google_client_id",
        label: "OAuth Client ID",
        secret: false,
        placeholder: "000000000000-….apps.googleusercontent.com",
        help: "معرّف Web application في Google Cloud Console.",
        requiredBy: ["google_analytics", "google_search_console", "google_ads"],
        environmentBootstrapKey: "GOOGLE_INTEGRATIONS_CLIENT_ID",
      },
      {
        key: "google_client_secret",
        label: "OAuth Client Secret",
        secret: true,
        placeholder: "أدخل قيمة جديدة للحفظ أوالاستبدال",
        help: "يُحفظ داخل Supabase Vault ولا يُعاد عرضه.",
        requiredBy: ["google_analytics", "google_search_console", "google_ads"],
        environmentBootstrapKey: "GOOGLE_INTEGRATIONS_CLIENT_SECRET",
      },
      {
        key: "google_ads_developer_token",
        label: "Google Ads Developer Token",
        secret: true,
        placeholder: "أدخل Developer Token",
        help: "مطلوب فقط لاستدعاءات Google Ads API.",
        requiredBy: ["google_ads"],
        environmentBootstrapKey: "GOOGLE_ADS_DEVELOPER_TOKEN",
      },
    ],
  },
  {
    key: "meta",
    label: "Meta",
    description: "App ID وApp Secret مشتركان عمدًا بين Meta Marketing وWhatsApp Business.",
    integrations: ["meta_business", "whatsapp_business"],
    fields: [
      {
        key: "meta_app_id",
        label: "Meta App ID",
        secret: false,
        placeholder: "123456789012345",
        help: "معرّف تطبيق Venesia في Meta for Developers.",
        requiredBy: ["meta_business", "whatsapp_business"],
        environmentBootstrapKey: "META_APP_ID",
      },
      {
        key: "meta_app_secret",
        label: "Meta App Secret",
        secret: true,
        placeholder: "أدخل App Secret",
        help: "مالك واحد مشترك؛ لا توجد نسخة مستقلة لـWhatsApp.",
        requiredBy: ["meta_business", "whatsapp_business"],
        environmentBootstrapKey: "META_APP_SECRET",
      },
    ],
  },
  {
    key: "tiktok",
    label: "TikTok",
    description: "App ID وSecret لتفويض TikTok Marketing API طويل العمر.",
    integrations: ["tiktok_ads"],
    fields: [
      {
        key: "tiktok_app_id",
        label: "TikTok App ID",
        secret: false,
        placeholder: "App ID",
        help: "App ID المعتمد داخل TikTok API for Business.",
        requiredBy: ["tiktok_ads"],
        environmentBootstrapKey: "TIKTOK_BUSINESS_APP_ID",
      },
      {
        key: "tiktok_app_secret",
        label: "TikTok App Secret",
        secret: true,
        placeholder: "أدخل App Secret",
        help: "يُستخدم فقط على السيرفر عند تبادل authorization code.",
        requiredBy: ["tiktok_ads"],
        environmentBootstrapKey: "TIKTOK_BUSINESS_APP_SECRET",
      },
    ],
  },
  {
    key: "snapchat",
    label: "Snapchat",
    description: "OAuth Client ID وClient Secret لتكامل Snap Marketing API.",
    integrations: ["snapchat_ads"],
    fields: [
      {
        key: "snapchat_client_id",
        label: "Snapchat Client ID",
        secret: false,
        placeholder: "00000000-0000-0000-0000-000000000000",
        help: "معرّف OAuth App في Snap Business Manager.",
        requiredBy: ["snapchat_ads"],
        environmentBootstrapKey: "SNAPCHAT_MARKETING_CLIENT_ID",
      },
      {
        key: "snapchat_client_secret",
        label: "Snapchat Client Secret",
        secret: true,
        placeholder: "أدخل Client Secret",
        help: "يظهر مرة واحدة لدى Snap ويُحفظ هنا داخل Vault فقط.",
        requiredBy: ["snapchat_ads"],
        environmentBootstrapKey: "SNAPCHAT_MARKETING_CLIENT_SECRET",
      },
    ],
  },
] as const satisfies readonly IntegrationAppConfigurationProviderDefinition[];

export const INTEGRATION_APP_CONFIGURATION_SURFACE_DEFINITIONS = [
  { key: "google", owner: "google", label: "Google", integrations: ["google_analytics", "google_search_console", "google_ads"] },
  { key: "meta", owner: "meta", label: "Meta", integrations: ["meta_business"] },
  { key: "tiktok", owner: "tiktok", label: "TikTok", integrations: ["tiktok_ads"] },
  { key: "snapchat", owner: "snapchat", label: "Snapchat", integrations: ["snapchat_ads"] },
  { key: "whatsapp", owner: "meta", label: "WhatsApp Business", integrations: ["whatsapp_business"] },
] as const satisfies readonly {
  key: IntegrationAppConfigurationSurface;
  owner: IntegrationAppConfigurationProvider;
  label: string;
  integrations: readonly LiveIntegrationKey[];
}[];

export function getIntegrationAppConfigurationDefinition(
  provider: IntegrationAppConfigurationProvider,
) {
  return INTEGRATION_APP_CONFIGURATION_DEFINITIONS.find((item) => item.key === provider)!;
}

export function getIntegrationAppConfigurationSurface(
  surface: IntegrationAppConfigurationSurface,
) {
  return INTEGRATION_APP_CONFIGURATION_SURFACE_DEFINITIONS.find((item) => item.key === surface)!;
}

export function applicationConfigurationProviderForIntegration(
  integration: LiveIntegrationKey,
): IntegrationAppConfigurationProvider {
  const definition = INTEGRATION_APP_CONFIGURATION_DEFINITIONS.find((item) =>
    (item.integrations as readonly LiveIntegrationKey[]).includes(integration),
  );
  if (!definition) throw new Error(`integration_app_configuration_owner_missing:${integration}`);
  return definition.key;
}

export function requiredApplicationConfigurationFields(
  integration: LiveIntegrationKey,
) {
  const provider = applicationConfigurationProviderForIntegration(integration);
  return getIntegrationAppConfigurationDefinition(provider).fields.filter((field) =>
    (field.requiredBy as readonly LiveIntegrationKey[]).includes(integration),
  );
}

export type IntegrationAppConfigurationDiagnostic = {
  integration: LiveIntegrationKey;
  provider: IntegrationAppConfigurationProvider;
  status: IntegrationAppConfigurationStatus;
  source: IntegrationAppConfigurationSource;
  configured: boolean;
  missing: IntegrationAppConfigurationKey[];
  message: string;
  lastTestedAt: string | null;
  safeErrorCode: string | null;
  version: number;
};

export type IntegrationAppConfigurationTestResult = {
  status:
    | "configuration_invalid"
    | "configuration_saved_waiting_for_authorization"
    | "ready_to_connect";
  safeErrorCode: string | null;
  message: string;
};

export function isIntegrationAppConfigurationAuthorizationReady(
  input: Pick<IntegrationAppConfigurationDiagnostic, "status" | "lastTestedAt">,
) {
  return input.status === "ready_to_connect" || (
    input.status === "configuration_saved_waiting_for_authorization" &&
    Boolean(input.lastTestedAt)
  );
}

export function unavailableIntegrationAppConfigurationDiagnostic(
  integration: LiveIntegrationKey,
): IntegrationAppConfigurationDiagnostic {
  return {
    integration,
    provider: applicationConfigurationProviderForIntegration(integration),
    status: "needs_configuration",
    source: "none",
    configured: false,
    missing: requiredApplicationConfigurationFields(integration).map((field) => field.key),
    message: "Application configuration diagnostics are unavailable.",
    lastTestedAt: null,
    safeErrorCode: "integration_app_configuration_diagnostics_unavailable",
    version: 0,
  };
}

export type IntegrationAppConfigurationFieldSnapshot = {
  key: IntegrationAppConfigurationKey;
  label: string;
  secret: boolean;
  placeholder: string;
  help: string;
  configured: boolean;
  safeValue: string | null;
};

export type IntegrationAppConfigurationValidationSnapshot = {
  integration: LiveIntegrationKey;
  label: string;
  status: IntegrationAppConfigurationStatus;
  configured: boolean;
  missing: IntegrationAppConfigurationKey[];
  lastTestedAt: string | null;
  safeErrorCode: string | null;
};

export type IntegrationAppConfigurationSurfaceSnapshot = {
  key: IntegrationAppConfigurationSurface;
  owner: IntegrationAppConfigurationProvider;
  label: string;
  description: string;
  sharedOwnerLabel: string | null;
  source: IntegrationAppConfigurationSource;
  version: number;
  updatedAt: string | null;
  fields: IntegrationAppConfigurationFieldSnapshot[];
  validations: IntegrationAppConfigurationValidationSnapshot[];
  callbackUrls: Array<{ integration: LiveIntegrationKey; label: string; url: string }>;
};

export type IntegrationsServerConfigurationSnapshot = {
  contractVersion: typeof INTEGRATIONS_SERVER_CONFIGURATION_CONTRACT_VERSION;
  state: "ready" | "partial" | "unavailable";
  checkedAt: string;
  migrationRegistered: boolean;
  vaultAvailable: boolean;
  canonicalOrigin: string | null;
  surfaces: IntegrationAppConfigurationSurfaceSnapshot[];
};

export function isIntegrationAppConfigurationProvider(
  value: string,
): value is IntegrationAppConfigurationProvider {
  return (INTEGRATION_APP_CONFIGURATION_PROVIDERS as readonly string[]).includes(value);
}

export function isIntegrationAppConfigurationSurface(
  value: string,
): value is IntegrationAppConfigurationSurface {
  return (INTEGRATION_APP_CONFIGURATION_SURFACES as readonly string[]).includes(value);
}
