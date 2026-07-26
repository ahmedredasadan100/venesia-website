import type {
  MediaRuntimeEnvironment,
  MediaStorageProvider,
  MediaStorageRuntimeContext,
} from "../media-storage-adapter";

export type ManagedMediaProvider = MediaStorageProvider;

export type CanonicalMediaIdentity = {
  provider: ManagedMediaProvider;
  bucket: string;
  objectKey: string;
};

export type ManagedMediaUploadProof = {
  reconciliationRunIdentity: string;
  environmentKey: string;
  providerRegistryVersion: string;
  baselineStorageAssetCount: number;
  baselineCatalogAssetCount: number;
  baselineIdentityFingerprint: string;
};

export type MediaCatalogState = "available" | "unavailable" | "uncertain";
export type MediaReconciliationState =
  | "synced"
  | "storage_only"
  | "catalog_only"
  | "missing_object"
  | "uncertain";

export type MediaCatalogAsset = CanonicalMediaIdentity & {
  id: string;
  publicUrl: string;
  originalFilename: string;
  displayName: string;
  kind: "image" | "document";
  mimeType: string | null;
  extension: string;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  checksum: string | null;
  folderPath: string;
  status: "active" | "deleting" | "deleted" | "missing";
  uploadedBy: number | null;
  defaultAltText: string | null;
  defaultTitle: string | null;
  defaultCaption: string | null;
  reconciliationState: MediaReconciliationState;
  missingObject: boolean;
  catalogRegistered: boolean;
  source: "catalog" | "storage" | "catalog_storage";
  createdAt: string;
  updatedAt: string;
  referenceCount: number | null;
  managedUploadProof?: ManagedMediaUploadProof | null;
};

export type MediaCatalogFolder = {
  id: string;
  path: string;
  parentPath: string | null;
  displayName: string;
  reconciliationState: "synced" | "storage_only" | "catalog_only" | "uncertain";
  childFolderCount: number;
  directAssetCount: number;
  directTotalBytes: number;
  totalAssetCount: number;
  totalBytes: number;
};

export type MediaCatalogSnapshot = {
  catalogState: MediaCatalogState;
  warning: string | null;
  assets: MediaCatalogAsset[];
  folders: MediaCatalogFolder[];
};

export type MediaLibrarySummary = {
  provider: MediaStorageProvider;
  folderCount: number;
  assetCount: number;
  storageAssetCount: number;
  managedStorageAssetCount: number;
  readOnlyAssetCount: number;
  catalogRegisteredCount: number;
  imageCount: number;
  documentCount: number;
  missingObjectCount: number;
  unreconciledAssetCount: number;
  usageUnknownCount: number;
  totalBytes: number;
  unknownSizeCount: number;
  largestAsset: {
    id: string;
    displayName: string;
    publicUrl: string;
    folderPath: string;
    sizeBytes: number;
  } | null;
};

export type MediaReferenceState = "draft" | "active" | "archived" | "soft_deleted" | "restorable";

export type MediaReferenceRecord = {
  id: string;
  assetId: string;
  domainKey: string;
  entityType: string;
  entityIdentity: string;
  entityLabel: string | null;
  fieldKey: string;
  editHref: string | null;
  publicHref: string | null;
  referenceState: MediaReferenceState;
  restorable: boolean;
};

export type MediaSmartView =
  | "all"
  | "used"
  | "unused"
  | "missing_alt"
  | "missing"
  | "drift";

export type MediaCatalogRuntimeState = {
  state: "synced" | "uncertain";
  provider: MediaStorageProvider | null;
  environment: MediaRuntimeEnvironment | null;
  environmentKey: string | null;
  providerRegistryVersion: string | null;
  lastScanAt: string | null;
  lastCatalogSync: string | null;
  lastDryRun: string | null;
  lastSuccessfulReconciliationRunIdentity: string | null;
  lastSuccessfulReconciliationAt: string | null;
  storageAssetCount: number | null;
  catalogAssetCount: number | null;
  warnings: string[];
};

export type MediaCatalogReadinessReason =
  | "catalog_unavailable"
  | "managed_storage_unavailable"
  | "environment_identity_unproven"
  | "runtime_state_missing"
  | "runtime_context_mismatch"
  | "runtime_dataset_mismatch"
  | "provider_registry_mismatch"
  | "catalog_coverage_incomplete"
  | "asset_reconciliation_incomplete"
  | "provider_scan_uncertain";

export type MediaCatalogReadiness = {
  context: MediaStorageRuntimeContext;
  catalogAvailable: boolean;
  managedStorageAvailable: boolean;
  runtimeContextMatches: boolean;
  runtimeDatasetMatches: boolean;
  providerRegistryMatches: boolean;
  catalogCoverageComplete: boolean;
  assetReconciliationComplete: boolean;
  usageResultsAuthoritative: boolean;
  safeDeleteReady: boolean;
  managedStorageAssetCount: number;
  catalogAssetCount: number;
  unregisteredAssetCount: number;
  missingObjectCount: number;
  unreconciledAssetCount: number;
  unscannedAssetCount: number;
  lastScanAt: string | null;
  lastCompletedScanAt: string | null;
  reasons: MediaCatalogReadinessReason[];
  warnings: string[];
};

export type MediaCatalogPage = {
  catalogState: MediaCatalogState;
  warning: string | null;
  assets: MediaCatalogAsset[];
  folders: MediaCatalogFolder[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  summary: MediaLibrarySummary;
  readiness: MediaCatalogReadiness;
};

export type MediaDeleteEligibility =
  | { state: "safe_to_delete"; asset: MediaCatalogAsset; references: [] }
  | { state: "in_use"; asset: MediaCatalogAsset; references: MediaReferenceRecord[] }
  | { state: "uncertain"; asset: MediaCatalogAsset | null; reasons: string[] }
  | { state: "unmanaged"; asset: null }
  | { state: "already_missing"; asset: MediaCatalogAsset }
  | { state: "catalog_storage_drift"; asset: MediaCatalogAsset; reasons: string[] };
