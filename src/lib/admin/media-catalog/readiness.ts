import type { PublicMediaInventory } from "../media-library-paths";
import type { MediaStorageRuntimeContext } from "../media-storage-adapter";
import type {
  MediaCatalogReadiness,
  MediaCatalogReadinessReason,
  MediaCatalogRuntimeState,
  MediaCatalogSnapshot,
} from "./types";

function catalogIdentityKey(provider: string, bucket: string, objectKey: string) {
  return `${provider}:${bucket}:${objectKey.replace(/^\/+/, "")}`;
}

export function buildMediaCatalogReadiness(
  catalog: MediaCatalogSnapshot,
  inventory: PublicMediaInventory,
  runtimeState: MediaCatalogRuntimeState | null,
  context: MediaStorageRuntimeContext,
  currentProviderRegistryVersion: string,
): MediaCatalogReadiness {
  const managedStorageAvailable = inventory.providerAvailable !== false;
  const managedStorageAssets = inventory.items.filter(
    (item) => item.managed && item.provider === context.provider && Boolean(item.storagePath),
  );
  const catalogAssets = catalog.assets.filter((asset) => asset.provider === context.provider);
  const storageKeys = new Set(
    managedStorageAssets.map((item) => catalogIdentityKey(item.provider, item.bucket, item.storagePath!)),
  );
  const catalogKeys = new Set(
    catalogAssets.map((asset) => catalogIdentityKey(asset.provider, asset.bucket, asset.objectKey)),
  );
  const unregisteredAssetCount = [...storageKeys].filter((key) => !catalogKeys.has(key)).length;
  const missingObjectCount = managedStorageAvailable
    ? [...catalogKeys].filter((key) => !storageKeys.has(key)).length
    : 0;
  const unreconciledCatalogCount = catalogAssets.filter(
    (asset) => asset.reconciliationState !== "synced" || asset.missingObject,
  ).length;
  const unreconciledAssetCount = unregisteredAssetCount + unreconciledCatalogCount;
  const catalogAvailable = catalog.catalogState === "available";
  const runtimeContextMatches = Boolean(
    context.identity &&
      runtimeState?.environmentKey === context.identity &&
      runtimeState.provider === context.provider &&
      runtimeState.environment === context.environment,
  );
  const providerRegistryMatches =
    runtimeState?.providerRegistryVersion === currentProviderRegistryVersion;
  const runtimeDatasetMatches = Boolean(
    runtimeState &&
      runtimeState.storageAssetCount === managedStorageAssets.length &&
      runtimeState.catalogAssetCount === catalogAssets.length,
  );
  const catalogCoverageComplete =
    catalogAvailable &&
    managedStorageAvailable &&
    unregisteredAssetCount === 0 &&
    missingObjectCount === 0;
  const assetReconciliationComplete =
    catalogCoverageComplete && unreconciledAssetCount === 0;
  const runtimeWarnings = runtimeState?.warnings ?? [];
  const usageResultsAuthoritative = Boolean(
    context.identity &&
      runtimeState?.state === "synced" &&
      runtimeContextMatches &&
      runtimeDatasetMatches &&
      providerRegistryMatches &&
      catalogCoverageComplete &&
      assetReconciliationComplete &&
      runtimeWarnings.length === 0,
  );
  const reasons: MediaCatalogReadinessReason[] = [];
  if (!catalogAvailable) reasons.push("catalog_unavailable");
  if (!managedStorageAvailable) reasons.push("managed_storage_unavailable");
  if (!context.identity) reasons.push("environment_identity_unproven");
  if (!runtimeState?.environmentKey) reasons.push("runtime_state_missing");
  else if (!runtimeContextMatches) reasons.push("runtime_context_mismatch");
  if (!runtimeDatasetMatches) reasons.push("runtime_dataset_mismatch");
  if (!providerRegistryMatches) reasons.push("provider_registry_mismatch");
  if (!catalogCoverageComplete) reasons.push("catalog_coverage_incomplete");
  if (!assetReconciliationComplete) reasons.push("asset_reconciliation_incomplete");
  if (runtimeState?.state !== "synced" || runtimeWarnings.length) {
    reasons.push("provider_scan_uncertain");
  }

  const managedIdentityCount = new Set([...storageKeys, ...catalogKeys]).size;
  return {
    context,
    catalogAvailable,
    managedStorageAvailable,
    runtimeContextMatches,
    runtimeDatasetMatches,
    providerRegistryMatches,
    catalogCoverageComplete,
    assetReconciliationComplete,
    usageResultsAuthoritative,
    safeDeleteReady: usageResultsAuthoritative,
    managedStorageAssetCount: managedStorageAssets.length,
    catalogAssetCount: catalogAssets.length,
    unregisteredAssetCount,
    missingObjectCount,
    unreconciledAssetCount,
    unscannedAssetCount: usageResultsAuthoritative ? 0 : managedIdentityCount,
    lastScanAt: runtimeState?.lastScanAt ?? null,
    lastCompletedScanAt: runtimeState?.lastCatalogSync ?? null,
    reasons: [...new Set(reasons)],
    warnings: [...new Set([catalog.warning, inventory.warning, ...runtimeWarnings].filter((value): value is string => Boolean(value)))],
  };
}

const READINESS_REASON_LABELS: Record<MediaCatalogReadinessReason, string> = {
  catalog_unavailable: "بيانات إدارة الملفات غير متاحة في البيئة المتصلة.",
  managed_storage_unavailable: "تعذر قراءة التخزين المُدار.",
  environment_identity_unproven: "تعذر إثبات هوية بيئة التخزين المتصلة.",
  runtime_state_missing: "لم يُنفذ فحص مكتمل لهذه البيئة بعد.",
  runtime_context_mismatch: "آخر فحص يخص بيئة أو موفرًا مختلفًا.",
  runtime_dataset_mismatch: "تغيرت مجموعة الملفات منذ آخر فحص مكتمل.",
  provider_registry_mismatch: "تغيرت مصادر الارتباطات منذ آخر فحص مكتمل.",
  catalog_coverage_incomplete: "توجد ملفات مُدارة لم تكتمل مطابقتها مع مكتبة الوسائط.",
  asset_reconciliation_incomplete: "توجد ملفات تحتاج تجهيزًا أو مراجعة.",
  provider_scan_uncertain: "لم يكتمل فحص بعض مواضع الاستخدام.",
};

export function getMediaReadinessReasonLabel(reason: MediaCatalogReadinessReason) {
  return READINESS_REASON_LABELS[reason];
}
