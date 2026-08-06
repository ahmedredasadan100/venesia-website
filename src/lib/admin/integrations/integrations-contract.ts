import type { AnalyticsProviderKey } from "../reports/analytics-contract";
import type {
  IntegrationAppConfigurationSource,
  IntegrationAppConfigurationStatus,
} from "./server-configuration-contract";

export const INTEGRATIONS_CONTRACT_VERSION = "external-integrations-v2" as const;
export const INTEGRATIONS_MIGRATION_VERSION = "20260806010000" as const;

export const INTEGRATION_KEYS = [
  "google_analytics",
  "google_search_console",
  "microsoft_clarity",
  "google_ads",
  "meta_business",
  "tiktok_ads",
  "snapchat_ads",
  "whatsapp_business",
  "venesia_crm",
] as const;

export const LIVE_INTEGRATION_KEYS = [
  "google_analytics",
  "google_search_console",
  "google_ads",
  "meta_business",
  "tiktok_ads",
  "snapchat_ads",
  "whatsapp_business",
] as const;

export type IntegrationKey = (typeof INTEGRATION_KEYS)[number];
export type LiveIntegrationKey = (typeof LIVE_INTEGRATION_KEYS)[number];
export type IntegrationCategory = "analytics" | "advertising" | "communication" | "crm";
export type IntegrationConnectionStatus =
  | "authorizing"
  | "authorized_unbound"
  | "discovering_assets"
  | "pending_selection"
  | "testing"
  | "syncing"
  | "connected"
  | "disconnected"
  | "needs_configuration"
  | "needs_reauth"
  | "needs_attention"
  | "unavailable";
export type IntegrationPlatformState = "ready" | "partial" | "unavailable";
export type IntegrationSecurityState = "guarded" | "needs_attention";

export type IntegrationCredentialStrategy =
  | { kind: "google_oauth_refresh"; refreshSupported: true }
  | { kind: "meta_user"; refreshSupported: false }
  | { kind: "meta_system_user"; refreshSupported: false }
  | { kind: "tiktok_marketing_long_lived"; refreshSupported: false }
  | { kind: "snap_oauth_refresh"; refreshSupported: true };

export type IntegrationAssetType =
  | "account"
  | "property"
  | "site"
  | "manager_customer"
  | "customer"
  | "business"
  | "ad_account"
  | "pixel"
  | "dataset"
  | "business_center"
  | "advertiser"
  | "organization"
  | "waba"
  | "phone_number";

export type IntegrationAsset = {
  id?: string;
  type: IntegrationAssetType;
  externalId: string;
  parentExternalId: string | null;
  displayName: string;
  permissions: string[];
  metadata: Record<string, string | number | boolean | null>;
  selected?: boolean;
};

export type IntegrationDefinition = {
  key: IntegrationKey;
  label: string;
  category: IntegrationCategory;
  description: string;
  analyticsProvider: AnalyticsProviderKey | null;
  reportsHref: string;
  liveConnectionSupported: boolean;
  requiredAssetTypes: readonly IntegrationAssetType[];
};

export const INTEGRATION_DEFINITIONS = [
  {
    key: "google_analytics",
    label: "Google Analytics 4",
    category: "analytics",
    description: "قياس الزيارات وسلوك المحتوى والمشاريع من GA4 Property محددة.",
    analyticsProvider: "google_analytics_4",
    reportsHref: "/admin/reports/analytics?filter=providers",
    liveConnectionSupported: true,
    requiredAssetTypes: ["account", "property"],
  },
  {
    key: "google_search_console",
    label: "Google Search Console",
    category: "analytics",
    description: "أداء البحث العضوي والفهرسة والكلمات من Site Property محددة.",
    analyticsProvider: "google_search_console",
    reportsHref: "/admin/reports/analytics?filter=seo",
    liveConnectionSupported: true,
    requiredAssetTypes: ["site"],
  },
  {
    key: "microsoft_clarity",
    label: "Microsoft Clarity",
    category: "analytics",
    description: "خارج نطاق التفعيل الحالي؛ لا توجد حالة اتصال أوبيانات مفترضة.",
    analyticsProvider: "microsoft_clarity",
    reportsHref: "/admin/reports/analytics?filter=providers",
    liveConnectionSupported: false,
    requiredAssetTypes: [],
  },
  {
    key: "google_ads",
    label: "Google Ads",
    category: "advertising",
    description: "قراءة الحملات والتحويلات من Google Ads Customer محدد.",
    analyticsProvider: "google_ads",
    reportsHref: "/admin/reports/business?filter=campaigns",
    liveConnectionSupported: true,
    requiredAssetTypes: ["customer"],
  },
  {
    key: "meta_business",
    label: "Meta Marketing API",
    category: "advertising",
    description: "قراءة حملات Venesia واكتشاف Business وAd Account وPixel/Dataset.",
    analyticsProvider: "meta_marketing",
    reportsHref: "/admin/reports/business?filter=campaigns",
    liveConnectionSupported: true,
    requiredAssetTypes: ["business", "ad_account"],
  },
  {
    key: "tiktok_ads",
    label: "TikTok Ads",
    category: "advertising",
    description: "قراءة تقارير Advertiser واكتشاف Business Center وPixels المتاحة.",
    analyticsProvider: "tiktok_ads",
    reportsHref: "/admin/reports/business?filter=campaigns",
    liveConnectionSupported: true,
    requiredAssetTypes: ["advertiser"],
  },
  {
    key: "snapchat_ads",
    label: "Snapchat Ads",
    category: "advertising",
    description: "قراءة تقارير Ad Account واكتشاف Organization وPixels دون CAPI writes.",
    analyticsProvider: "snapchat_ads",
    reportsHref: "/admin/reports/business?filter=campaigns",
    liveConnectionSupported: true,
    requiredAssetTypes: ["organization", "ad_account"],
  },
  {
    key: "whatsapp_business",
    label: "WhatsApp Business",
    category: "communication",
    description: "فحص WABA وPhone Number الخاصة بـVenesia دون إرسال رسائل.",
    analyticsProvider: null,
    reportsHref: "/admin/reports/business?filter=sources",
    liveConnectionSupported: true,
    requiredAssetTypes: ["business", "waba", "phone_number"],
  },
  {
    key: "venesia_crm",
    label: "Venesia CRM",
    category: "crm",
    description: "خارج نطاق المرحلة الحالية ويظل غير متاح دون Source of Truth بديل.",
    analyticsProvider: "crm",
    reportsHref: "/admin/reports/business?filter=leads",
    liveConnectionSupported: false,
    requiredAssetTypes: [],
  },
] as const satisfies readonly IntegrationDefinition[];

export type PersistedIntegrationConnection = {
  id: string;
  integrationKey: LiveIntegrationKey;
  externalSubjectId: string | null;
  status: Exclude<IntegrationConnectionStatus, "authorizing" | "disconnected" | "needs_configuration" | "unavailable">;
  credentialStrategy: IntegrationCredentialStrategy["kind"];
  grantedScopes: string[];
  accessExpiresAt: string | null;
  refreshExpiresAt: string | null;
  lastValidatedAt: string | null;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  consecutiveFailures: number;
  backoffUntil: string | null;
  version: number;
  assets: IntegrationAsset[];
  analyticsReady: boolean;
};

export type IntegrationSnapshotItem = IntegrationDefinition & {
  connectionId: string | null;
  status: IntegrationConnectionStatus;
  checkedAt: string;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  message: string;
  security: IntegrationSecurityState;
  configureHref: string | null;
  testHref: string | null;
  reportsAvailable: boolean;
  availableAssets: IntegrationAsset[];
  selectedAssets: IntegrationAsset[];
  missingConfiguration: string[];
  appConfigurationStatus: IntegrationAppConfigurationStatus | null;
  appConfigurationSource: IntegrationAppConfigurationSource;
  appConfigurationLastTestedAt: string | null;
};

export type IntegrationStatistics = {
  total: number;
  connected: number;
  needsAttention: number;
  disconnected: number;
  connecting: number;
  syncing: number;
  unavailable: number;
};

export type IntegrationsSnapshot = {
  contractVersion: typeof INTEGRATIONS_CONTRACT_VERSION;
  state: IntegrationPlatformState;
  checkedAt: string;
  security: IntegrationSecurityState;
  vaultAvailable: boolean;
  databaseAvailable: boolean;
  migrationRegistered: boolean;
  lastSyncAt: string | null;
  statistics: IntegrationStatistics;
  integrations: IntegrationSnapshotItem[];
};

export function isIntegrationKey(value: string): value is IntegrationKey {
  return (INTEGRATION_KEYS as readonly string[]).includes(value);
}

export function isLiveIntegrationKey(value: string): value is LiveIntegrationKey {
  return (LIVE_INTEGRATION_KEYS as readonly string[]).includes(value);
}

export function getIntegrationDefinition(key: IntegrationKey) {
  return INTEGRATION_DEFINITIONS.find((item) => item.key === key)!;
}

export function assertRequiredAssets(
  integration: LiveIntegrationKey,
  assets: readonly IntegrationAsset[],
) {
  const definition = getIntegrationDefinition(integration);
  const selected = assets.filter((asset) => asset.selected !== false);
  const selectedTypes = new Set(selected.map((asset) => asset.type));
  const duplicateTypes = [...selectedTypes].filter(
    (type) => selected.filter((asset) => asset.type === type).length > 1,
  );
  if (duplicateTypes.length) {
    throw new Error(`integration_assets_duplicate_type:${duplicateTypes.join(",")}`);
  }
  const missing = definition.requiredAssetTypes.filter((type) => !selectedTypes.has(type));
  if (missing.length) {
    throw new Error(`integration_assets_missing:${missing.join(",")}`);
  }
}

export function latestTimestamp(values: Array<string | null>) {
  const timestamps = values
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, timestamp: Date.parse(value) }))
    .filter((item) => Number.isFinite(item.timestamp))
    .sort((a, b) => b.timestamp - a.timestamp);
  return timestamps[0]?.value ?? null;
}
