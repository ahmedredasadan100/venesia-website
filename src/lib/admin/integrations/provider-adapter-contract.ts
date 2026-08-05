import type {
  AnalyticsProviderKey,
  AnalyticsProviderResult,
  AnalyticsQueryContext,
} from "../reports/analytics-contract";
import type {
  IntegrationAsset,
  IntegrationCredentialStrategy,
  LiveIntegrationKey,
  ProviderConfigurationDiagnostic,
} from "./integrations-contract";

export type ProviderAuthorizationContext = {
  redirectUri: string;
  state: string;
  codeChallenge: string | null;
};

export type ProviderAuthorizationRequest = {
  url: string;
  pkceVerifierRequired: boolean;
};

export type ProviderTokenSet = {
  strategy: IntegrationCredentialStrategy;
  accessToken: string;
  refreshToken: string | null;
  accessExpiresAt: string | null;
  refreshExpiresAt: string | null;
  grantedScopes: string[];
  externalSubjectId: string | null;
};

export type ProviderRuntimeContext = {
  connectionId: string;
  integration: LiveIntegrationKey;
  externalSubjectId: string | null;
  accessToken: string;
  refreshToken: string | null;
  assets: IntegrationAsset[];
  accessExpiresAt: string | null;
  refreshExpiresAt: string | null;
};

export type ProviderConnectionTest = {
  ok: boolean;
  checkedAt: string;
  message: string;
  requiresReauth: boolean;
  diagnosticCode: string;
};

export type AnalyticsIngestionModel = AnalyticsProviderResult & {
  query: AnalyticsQueryContext;
  sourceUpdatedAt: string;
  watermark: Record<string, unknown>;
};

export type ProviderSyncResult = {
  status: "completed" | "partial";
  message: string;
  recordsWritten: number;
  watermark: Record<string, unknown>;
  analytics: AnalyticsIngestionModel[];
  connectionReadModelValid: boolean;
};

export type ProviderDiagnostic = {
  status: "ready" | "warning" | "unavailable";
  code: string;
  message: string;
  checkedAt: string;
  requiresReauth: boolean;
  metadata: Record<string, string | number | boolean | null>;
};

export type ProviderRevocationResult = {
  providerRevoked: boolean;
  message: string;
};

export interface IntegrationProviderAdapter {
  readonly integration: LiveIntegrationKey;
  readonly analyticsProvider: AnalyticsProviderKey | null;
  configuration(): ProviderConfigurationDiagnostic;
  buildAuthorizationRequest(context: ProviderAuthorizationContext): ProviderAuthorizationRequest;
  exchangeAuthorizationCode(input: {
    code: string;
    redirectUri: string;
    pkceVerifier: string | null;
  }): Promise<ProviderTokenSet>;
  refreshCredential(input: ProviderRuntimeContext): Promise<ProviderTokenSet | null>;
  discoverAssets(input: ProviderRuntimeContext): Promise<IntegrationAsset[]>;
  validateAssetSelection(assets: readonly IntegrationAsset[]): void;
  testConnection(input: ProviderRuntimeContext): Promise<ProviderConnectionTest>;
  syncAnalytics(input: ProviderRuntimeContext): Promise<ProviderSyncResult>;
  revokeConnection(input: ProviderRuntimeContext): Promise<ProviderRevocationResult>;
  diagnoseConnection(input: ProviderRuntimeContext): Promise<ProviderDiagnostic>;
}

export function createIntegrationProviderRegistry(
  adapters: readonly IntegrationProviderAdapter[],
) {
  const registry = new Map<LiveIntegrationKey, IntegrationProviderAdapter>();
  for (const adapter of adapters) {
    if (registry.has(adapter.integration)) {
      throw new Error(`duplicate_integration_provider_adapter:${adapter.integration}`);
    }
    registry.set(adapter.integration, adapter);
  }
  return {
    get(integration: LiveIntegrationKey) {
      const adapter = registry.get(integration);
      if (!adapter) throw new Error(`integration_provider_adapter_missing:${integration}`);
      return adapter;
    },
    definitions() {
      return [...registry.values()];
    },
  };
}
