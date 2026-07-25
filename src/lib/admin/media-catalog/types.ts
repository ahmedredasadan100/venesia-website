import type { MediaStorageProvider } from "../media-storage-adapter";

export type ManagedMediaProvider = MediaStorageProvider;

export type CanonicalMediaIdentity = {
  provider: ManagedMediaProvider;
  bucket: string;
  objectKey: string;
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
  createdAt: string;
  updatedAt: string;
  referenceCount: number;
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
  | "recent"
  | "large"
  | "missing"
  | "drift";

export type MediaCatalogPage = {
  catalogState: MediaCatalogState;
  warning: string | null;
  assets: MediaCatalogAsset[];
  folders: MediaCatalogFolder[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type MediaDeleteEligibility =
  | { state: "safe_to_delete"; asset: MediaCatalogAsset; references: [] }
  | { state: "in_use"; asset: MediaCatalogAsset; references: MediaReferenceRecord[] }
  | { state: "uncertain"; asset: MediaCatalogAsset | null; reasons: string[] }
  | { state: "unmanaged"; asset: null }
  | { state: "already_missing"; asset: MediaCatalogAsset }
  | { state: "catalog_storage_drift"; asset: MediaCatalogAsset; reasons: string[] };
