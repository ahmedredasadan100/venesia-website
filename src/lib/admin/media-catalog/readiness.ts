import type { PublicMediaInventory } from "../media-library-paths";
import type { MediaStorageRuntimeContext } from "../media-storage-adapter";
import type {
  MediaCatalogAsset,
  MediaCatalogReadiness,
  MediaCatalogReadinessReason,
  MediaCatalogRuntimeState,
  MediaCatalogSnapshot,
} from "./types";

function catalogIdentityKey(provider: string, bucket: string, objectKey: string) {
  return `${provider}:${bucket}:${objectKey.replace(/^\/+/, "")}`;
}

const MEDIA_IDENTITY_FINGERPRINT_SEEDS = [
  0x811c9dc5,
  0x9e3779b9,
  0x85ebca6b,
  0xc2b2ae35,
  0x27d4eb2f,
  0x165667b1,
  0xd3a2646c,
  0xfd7046c5,
] as const;

export function getMediaIdentitySetFingerprint(keys: Iterable<string>) {
  const payload = JSON.stringify([...keys].sort());
  const hashes: number[] = [...MEDIA_IDENTITY_FINGERPRINT_SEEDS];
  for (let index = 0; index < payload.length; index += 1) {
    const codeUnit = payload.charCodeAt(index);
    for (let lane = 0; lane < hashes.length; lane += 1) {
      let hash = hashes[lane] ^ (codeUnit & 0xff);
      hash = Math.imul(hash, 0x01000193) >>> 0;
      hash ^= codeUnit >>> 8;
      hashes[lane] = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hashes.map((hash) => hash.toString(16).padStart(8, "0")).join("");
}

function isNonNegativeInteger(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= 0;
}

function getTrustedRuntimeBaseline(input: {
  runtimeState: MediaCatalogRuntimeState;
  context: MediaStorageRuntimeContext;
  currentProviderRegistryVersion: string;
}) {
  const { runtimeState, context, currentProviderRegistryVersion } = input;
  const storageAssetCount = runtimeState.storageAssetCount;
  const catalogAssetCount = runtimeState.catalogAssetCount;
  const completedAt = runtimeState.lastSuccessfulReconciliationAt
    ? Date.parse(runtimeState.lastSuccessfulReconciliationAt)
    : Number.NaN;

  if (
    runtimeState.state !== "synced" ||
    runtimeState.warnings.length > 0 ||
    !context.identity ||
    runtimeState.environmentKey !== context.identity ||
    runtimeState.provider !== context.provider ||
    runtimeState.environment !== context.environment ||
    runtimeState.providerRegistryVersion !== currentProviderRegistryVersion ||
    !runtimeState.lastSuccessfulReconciliationRunIdentity ||
    !Number.isFinite(completedAt) ||
    !isNonNegativeInteger(storageAssetCount) ||
    !isNonNegativeInteger(catalogAssetCount) ||
    storageAssetCount !== catalogAssetCount
  ) {
    return null;
  }

  return {
    storageAssetCount,
    catalogAssetCount,
    reconciliationRunIdentity: runtimeState.lastSuccessfulReconciliationRunIdentity,
  };
}

function hasManagedUploadProofForBaseline(input: {
  asset: MediaCatalogAsset;
  baseline: NonNullable<ReturnType<typeof getTrustedRuntimeBaseline>>;
  context: MediaStorageRuntimeContext;
  currentProviderRegistryVersion: string;
}) {
  const { asset, baseline, context, currentProviderRegistryVersion } = input;
  const proof = asset.managedUploadProof;
  return Boolean(
    proof &&
      proof.reconciliationRunIdentity === baseline.reconciliationRunIdentity &&
      proof.environmentKey === context.identity &&
      proof.providerRegistryVersion === currentProviderRegistryVersion &&
      proof.baselineStorageAssetCount === baseline.storageAssetCount &&
      proof.baselineCatalogAssetCount === baseline.catalogAssetCount &&
      /^[a-f0-9]{64}$/.test(proof.baselineIdentityFingerprint),
  );
}

function isExactReconciledDatasetMatch(input: {
  catalogAssets: MediaCatalogAsset[];
  managedStorageAssetCount: number;
  runtimeState: MediaCatalogRuntimeState;
  context: MediaStorageRuntimeContext;
  currentProviderRegistryVersion: string;
}) {
  const baseline = getTrustedRuntimeBaseline(input);
  if (
    !baseline ||
    input.managedStorageAssetCount !== baseline.storageAssetCount ||
    input.catalogAssets.length !== baseline.catalogAssetCount
  ) {
    return false;
  }
  return !input.catalogAssets.some((asset) =>
    hasManagedUploadProofForBaseline({
      asset,
      baseline,
      context: input.context,
      currentProviderRegistryVersion: input.currentProviderRegistryVersion,
    }),
  );
}

function isTrustedManagedUploadDatasetExtension(input: {
  catalogAssets: MediaCatalogAsset[];
  managedStorageKeys: Set<string>;
  managedStorageAssetCount: number;
  runtimeState: MediaCatalogRuntimeState;
  context: MediaStorageRuntimeContext;
  currentProviderRegistryVersion: string;
}) {
  const {
    catalogAssets,
    managedStorageKeys,
    managedStorageAssetCount,
    runtimeState,
    context,
    currentProviderRegistryVersion,
  } = input;
  const baseline = getTrustedRuntimeBaseline({
    runtimeState,
    context,
    currentProviderRegistryVersion,
  });
  if (!baseline) return false;

  const storageDelta = managedStorageAssetCount - baseline.storageAssetCount;
  const catalogDelta = catalogAssets.length - baseline.catalogAssetCount;
  if (storageDelta <= 0 || storageDelta !== catalogDelta) return false;

  const provenUploadAssets = catalogAssets.filter((asset) =>
    hasManagedUploadProofForBaseline({
      asset,
      baseline,
      context,
      currentProviderRegistryVersion,
    }),
  );
  if (provenUploadAssets.length !== catalogDelta) {
    return false;
  }

  const provenUploadKeys = new Set(
    provenUploadAssets.map((asset) =>
      catalogIdentityKey(asset.provider, asset.bucket, asset.objectKey),
    ),
  );
  const baselineCatalogKeys = catalogAssets
    .map((asset) => catalogIdentityKey(asset.provider, asset.bucket, asset.objectKey))
    .filter((key) => !provenUploadKeys.has(key));
  const baselineFingerprint = getMediaIdentitySetFingerprint(baselineCatalogKeys);
  if (
    baselineCatalogKeys.length !== baseline.catalogAssetCount ||
    provenUploadAssets.some(
      (asset) => asset.managedUploadProof?.baselineIdentityFingerprint !== baselineFingerprint,
    )
  ) {
    return false;
  }

  return provenUploadAssets.every((asset) => {
    const storageKey = catalogIdentityKey(asset.provider, asset.bucket, asset.objectKey);
    return (
      asset.provider === context.provider &&
      asset.catalogRegistered &&
      asset.status === "active" &&
      asset.reconciliationState === "synced" &&
      !asset.missingObject &&
      managedStorageKeys.has(storageKey)
    );
  });
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
  const exactRuntimeDatasetMatch = Boolean(
    runtimeState &&
      isExactReconciledDatasetMatch({
        catalogAssets,
        managedStorageAssetCount: managedStorageAssets.length,
        runtimeState,
        context,
        currentProviderRegistryVersion,
      }),
  );
  // An official upload is an additive, reference-free dataset transition. Trust
  // it only when every delta identity carries the registration owner's proof for
  // this exact scan baseline and has the same live managed Storage identity.
  const runtimeDatasetMatches = Boolean(
    exactRuntimeDatasetMatch ||
      (runtimeState &&
        isTrustedManagedUploadDatasetExtension({
          catalogAssets,
          managedStorageKeys: storageKeys,
          managedStorageAssetCount: managedStorageAssets.length,
          runtimeState,
          context,
          currentProviderRegistryVersion,
        })),
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

type MediaReadinessReasonPresentation = {
  label: string;
  action: string;
  actionHref: "/admin/settings/media" | null;
};

const RUN_MEDIA_SCAN_ACTION =
  "افتح إعدادات الميديا، ثم استخدم «معاينة الفحص»، وبعد نجاحها استخدم «تنفيذ الفحص والمزامنة».";

const READINESS_REASON_PRESENTATIONS: Record<
  MediaCatalogReadinessReason,
  MediaReadinessReasonPresentation
> = {
  catalog_unavailable: {
    label: "بيانات إدارة الملفات غير متاحة في البيئة المتصلة.",
    action: "أعد تحميل الصفحة. إذا استمرت المشكلة، تواصل مع مسؤول النظام للتحقق من إتاحة سجل المكتبة.",
    actionHref: null,
  },
  managed_storage_unavailable: {
    label: "تعذر قراءة التخزين المُدار.",
    action: "أعد المحاولة. إذا استمرت المشكلة، تواصل مع مسؤول النظام للتحقق من اتصال مكان الحفظ.",
    actionHref: null,
  },
  environment_identity_unproven: {
    label: "تعذر إثبات هوية بيئة التخزين المتصلة.",
    action: "تواصل مع مسؤول النظام لإثبات بيئة التخزين قبل تنفيذ أي عملية حذف.",
    actionHref: null,
  },
  runtime_state_missing: {
    label: "لم يُنفذ فحص مكتمل لهذه البيئة بعد.",
    action: RUN_MEDIA_SCAN_ACTION,
    actionHref: "/admin/settings/media",
  },
  runtime_context_mismatch: {
    label: "آخر فحص يخص بيئة أو موفرًا مختلفًا.",
    action: RUN_MEDIA_SCAN_ACTION,
    actionHref: "/admin/settings/media",
  },
  runtime_dataset_mismatch: {
    label: "تغيرت مجموعة الملفات منذ آخر فحص مكتمل.",
    action: RUN_MEDIA_SCAN_ACTION,
    actionHref: "/admin/settings/media",
  },
  provider_registry_mismatch: {
    label: "تغيرت مصادر الارتباطات منذ آخر فحص مكتمل.",
    action: RUN_MEDIA_SCAN_ACTION,
    actionHref: "/admin/settings/media",
  },
  catalog_coverage_incomplete: {
    label: "توجد ملفات مُدارة لم تكتمل مطابقتها مع مكتبة الوسائط.",
    action: RUN_MEDIA_SCAN_ACTION,
    actionHref: "/admin/settings/media",
  },
  asset_reconciliation_incomplete: {
    label: "توجد ملفات تحتاج تجهيزًا أو مراجعة.",
    action: RUN_MEDIA_SCAN_ACTION,
    actionHref: "/admin/settings/media",
  },
  provider_scan_uncertain: {
    label: "لم يكتمل فحص بعض مواضع الاستخدام.",
    action: RUN_MEDIA_SCAN_ACTION,
    actionHref: "/admin/settings/media",
  },
};

export function getMediaReadinessReasonPresentation(reason: MediaCatalogReadinessReason) {
  return READINESS_REASON_PRESENTATIONS[reason];
}

export function getMediaReadinessReasonLabel(reason: MediaCatalogReadinessReason) {
  return getMediaReadinessReasonPresentation(reason).label;
}
