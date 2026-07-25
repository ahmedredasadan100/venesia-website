import "server-only";

import path from "path";

import { parseManagedStorageAsset } from "../../storage/upload-cms-asset";
import { getSupabaseAdmin } from "../../supabase-admin";
import type {
  MediaStorageRuntimeContext,
  MediaUploadResult,
} from "../media-storage-adapter";
import type { MediaAssetItem, PublicMediaInventory } from "../media-library-paths";
import { getFolderPathFromObjectKey, isMediaCatalogMissingError } from "./identity";
import { getCanonicalMediaIdentityKey } from "./identity";
import type {
  CanonicalMediaIdentity,
  MediaCatalogAsset,
  MediaCatalogFolder,
  MediaCatalogPage,
  MediaCatalogRuntimeState,
  MediaCatalogSnapshot,
  MediaLibrarySummary,
  MediaReferenceRecord,
  MediaSmartView,
} from "./types";
import { readUploadBinaryMetadata } from "./binary-metadata";
import { MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION } from "./reference-providers";
import { buildMediaCatalogReadiness } from "./readiness";

export type { MediaCatalogRuntimeState, MediaCatalogSnapshot } from "./types";

export class MediaCatalogUnavailableError extends Error {
  readonly code = "media_catalog_unavailable";

  constructor(message = "بيانات إدارة الملفات الكاملة غير متاحة. تم إيقاف العمليات الحساسة حفاظًا على الملفات.") {
    super(message);
    this.name = "MediaCatalogUnavailableError";
  }
}

function text(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function nullableText(value: unknown) {
  const result = text(value).trim();
  return result || null;
}

function numberOrNull(value: unknown) {
  if (value == null || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function mapCatalogAsset(row: Record<string, unknown>): MediaCatalogAsset {
  return {
    id: text(row.id),
    provider: row.provider === "filesystem" ? "filesystem" : "supabase",
    bucket: text(row.bucket),
    objectKey: text(row.object_key),
    publicUrl: text(row.public_url),
    originalFilename: text(row.original_filename),
    displayName: text(row.display_name),
    kind: row.media_kind === "document" ? "document" : "image",
    mimeType: nullableText(row.mime_type),
    extension: text(row.extension),
    sizeBytes: numberOrNull(row.byte_size),
    width: numberOrNull(row.width),
    height: numberOrNull(row.height),
    checksum: nullableText(row.checksum),
    folderPath: text(row.folder_path),
    status:
      row.status === "deleting" || row.status === "deleted" || row.status === "missing"
        ? row.status
        : "active",
    uploadedBy: numberOrNull(row.uploaded_by),
    defaultAltText: nullableText(row.default_alt_text),
    defaultTitle: nullableText(row.default_title),
    defaultCaption: nullableText(row.default_caption),
    reconciliationState:
      row.reconciliation_state === "storage_only" ||
      row.reconciliation_state === "catalog_only" ||
      row.reconciliation_state === "missing_object" ||
      row.reconciliation_state === "uncertain"
        ? row.reconciliation_state
        : "synced",
    missingObject: Boolean(row.missing_object),
    catalogRegistered: true,
    source: "catalog",
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    referenceCount: Number(row.reference_count ?? 0),
  };
}

function mapCatalogFolder(row: Record<string, unknown>): MediaCatalogFolder {
  return {
    id: text(row.id),
    path: text(row.normalized_path),
    parentPath: nullableText(row.parent_path),
    displayName: text(row.display_name),
    reconciliationState:
      row.reconciliation_state === "storage_only" ||
      row.reconciliation_state === "catalog_only" ||
      row.reconciliation_state === "uncertain"
        ? row.reconciliation_state
        : "synced",
    childFolderCount: Number(row.child_folder_count ?? 0),
    directAssetCount: Number(row.direct_asset_count ?? 0),
    directTotalBytes: Number(row.direct_total_bytes ?? 0),
    totalAssetCount: Number(row.direct_asset_count ?? 0),
    totalBytes: Number(row.direct_total_bytes ?? 0),
  };
}

function mapReference(row: Record<string, unknown>): MediaReferenceRecord {
  const state = text(row.reference_state);
  return {
    id: text(row.id),
    assetId: text(row.asset_id),
    domainKey: text(row.domain_key),
    entityType: text(row.entity_type),
    entityIdentity: text(row.entity_identity),
    entityLabel: nullableText(row.entity_label),
    fieldKey: text(row.field_key),
    editHref: nullableText(row.edit_href),
    publicHref: nullableText(row.public_href),
    referenceState:
      state === "draft" || state === "archived" || state === "soft_deleted" || state === "restorable"
        ? state
        : "active",
    restorable: Boolean(row.restorable),
  };
}

function fallbackAsset(item: MediaAssetItem): MediaCatalogAsset {
  return {
    id: `unmanaged:${item.path}`,
    provider: item.provider,
    bucket: item.bucket,
    objectKey: item.storagePath ?? item.path.replace(/^\/+/, ""),
    publicUrl: item.path,
    originalFilename: item.filename,
    displayName: item.filename,
    kind: item.kind,
    mimeType: item.contentType,
    extension: item.extension,
    sizeBytes: item.sizeBytes,
    width: null,
    height: null,
    checksum: null,
    folderPath: item.storagePath ? path.posix.dirname(item.storagePath) : path.posix.dirname(item.path.replace(/^\/+/, "")),
    status: "active",
    uploadedBy: null,
    defaultAltText: null,
    defaultTitle: null,
    defaultCaption: null,
    reconciliationState: item.managed ? "storage_only" : "uncertain",
    missingObject: false,
    catalogRegistered: false,
    source: "storage",
    createdAt: item.uploadedAt ?? "",
    updatedAt: item.uploadedAt ?? "",
    referenceCount: null,
  };
}

function identityKey(identity: CanonicalMediaIdentity) {
  if (identity.provider === "supabase") return getCanonicalMediaIdentityKey(identity);
  return `${identity.provider}:${identity.bucket}:${identity.objectKey.replace(/^\/+/, "")}`;
}

function storageFolder(folderPath: string): MediaCatalogFolder {
  const parentPath = folderPath === "images" || folderPath === "files" ? null : path.posix.dirname(folderPath);
  return {
    id: `storage:${folderPath}`,
    path: folderPath,
    parentPath,
    displayName:
      folderPath === "images"
        ? "الصور"
        : folderPath === "files"
          ? "المستندات"
          : path.posix.basename(folderPath),
    reconciliationState: "storage_only",
    childFolderCount: 0,
    directAssetCount: 0,
    directTotalBytes: 0,
    totalAssetCount: 0,
    totalBytes: 0,
  };
}

function storageItemIdentity(item: MediaAssetItem) {
  return identityKey({
    provider: item.provider,
    bucket: item.bucket,
    objectKey: item.storagePath ?? item.path.replace(/^\/+/, ""),
  });
}

function mergeCatalogAndStorageAssets(catalog: MediaCatalogSnapshot, inventory: PublicMediaInventory) {
  const storageByIdentity = new Map(inventory.items.map((item) => [storageItemIdentity(item), item]));
  const storageByPublicUrl = new Map(inventory.items.map((item) => [item.path, item]));
  const matchedStorageKeys = new Set<string>();
  const merged: MediaCatalogAsset[] = [];

  for (const catalogAsset of catalog.assets) {
    const storageItem =
      storageByIdentity.get(identityKey(catalogAsset)) ?? storageByPublicUrl.get(catalogAsset.publicUrl);
    if (!storageItem) {
      merged.push(
        catalogAsset.provider === inventory.provider && inventory.providerAvailable !== false
          ? {
              ...catalogAsset,
              missingObject: true,
              reconciliationState: "missing_object",
              source: "catalog",
            }
          : catalogAsset,
      );
      continue;
    }

    matchedStorageKeys.add(storageItemIdentity(storageItem));
    merged.push({
      ...catalogAsset,
      publicUrl: storageItem.path,
      objectKey: storageItem.storagePath ?? catalogAsset.objectKey,
      sizeBytes: storageItem.sizeBytes,
      mimeType: storageItem.contentType ?? catalogAsset.mimeType,
      createdAt: storageItem.uploadedAt ?? catalogAsset.createdAt,
      missingObject: false,
      source: "catalog_storage",
    });
  }

  for (const item of inventory.items) {
    if (!matchedStorageKeys.has(storageItemIdentity(item))) merged.push(fallbackAsset(item));
  }

  return merged;
}

function buildMergedFolders(
  catalogFolders: MediaCatalogFolder[],
  inventory: PublicMediaInventory,
  assets: MediaCatalogAsset[],
) {
  const folderMap = new Map(catalogFolders.map((folder) => [folder.path, folder]));
  for (const folderPath of ["images", "files", ...inventory.folders, ...assets.map((asset) => asset.folderPath)]) {
    if (!folderMap.has(folderPath)) folderMap.set(folderPath, storageFolder(folderPath));
  }

  const physicalByFolder = new Map<string, MediaAssetItem[]>();
  for (const item of inventory.items) {
    const folderPath = item.storagePath
      ? path.posix.dirname(item.storagePath)
      : path.posix.dirname(item.path.replace(/^\/+/, ""));
    const current = physicalByFolder.get(folderPath) ?? [];
    current.push(item);
    physicalByFolder.set(folderPath, current);
  }

  const folderPaths = Array.from(folderMap.keys());
  return folderPaths
    .map((folderPath) => {
      const folder = folderMap.get(folderPath)!;
      const directAssets = assets.filter((asset) => asset.folderPath === folderPath);
      const nestedAssets = assets.filter(
        (asset) => asset.folderPath === folderPath || asset.folderPath.startsWith(`${folderPath}/`),
      );
      const directPhysical = physicalByFolder.get(folderPath) ?? [];
      const nestedPhysical = inventory.items.filter((item) => {
        const itemFolder = item.storagePath
          ? path.posix.dirname(item.storagePath)
          : path.posix.dirname(item.path.replace(/^\/+/, ""));
        return itemFolder === folderPath || itemFolder.startsWith(`${folderPath}/`);
      });
      return {
        ...folder,
        childFolderCount: folderPaths.filter((candidate) => {
          const parent = candidate === "images" || candidate === "files" ? null : path.posix.dirname(candidate);
          return parent === folderPath;
        }).length,
        directAssetCount: directAssets.length,
        directTotalBytes: directPhysical.reduce((sum, item) => sum + (item.sizeBytes ?? 0), 0),
        totalAssetCount: nestedAssets.length,
        totalBytes: nestedPhysical.reduce((sum, item) => sum + (item.sizeBytes ?? 0), 0),
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function buildMediaLibrarySummary(
  inventory: PublicMediaInventory,
  folders: MediaCatalogFolder[],
  assets: MediaCatalogAsset[],
): MediaLibrarySummary {
  const knownSizeItems = inventory.items.filter((item) => item.sizeBytes !== null);
  const largestItem = knownSizeItems.reduce<MediaAssetItem | null>(
    (largest, item) => !largest || (item.sizeBytes ?? 0) > (largest.sizeBytes ?? 0) ? item : largest,
    null,
  );
  const largestAsset = largestItem
    ? assets.find(
        (asset) => identityKey(asset) === storageItemIdentity(largestItem) || asset.publicUrl === largestItem.path,
      ) ?? fallbackAsset(largestItem)
    : null;

  return {
    provider: inventory.provider,
    folderCount: folders.length,
    assetCount: assets.length,
    storageAssetCount: inventory.items.length,
    managedStorageAssetCount: inventory.items.filter(
      (item) => item.managed && item.provider === inventory.provider,
    ).length,
    readOnlyAssetCount: inventory.items.filter((item) => !item.managed).length,
    catalogRegisteredCount: assets.filter(
      (asset) => asset.catalogRegistered && asset.provider === inventory.provider,
    ).length,
    imageCount: assets.filter((asset) => asset.kind === "image").length,
    documentCount: assets.filter((asset) => asset.kind === "document").length,
    missingObjectCount: assets.filter(
      (asset) => asset.provider === inventory.provider && asset.missingObject,
    ).length,
    unreconciledAssetCount: assets.filter(
      (asset) =>
        asset.provider === inventory.provider &&
        (!asset.catalogRegistered || asset.reconciliationState !== "synced"),
    ).length,
    usageUnknownCount: assets.filter((asset) => asset.referenceCount === null).length,
    totalBytes: inventory.items.reduce((sum, item) => sum + (item.sizeBytes ?? 0), 0),
    unknownSizeCount: inventory.items.length - knownSizeItems.length,
    largestAsset: largestAsset && largestAsset.sizeBytes !== null
      ? {
          id: largestAsset.id,
          displayName: largestAsset.displayName,
          publicUrl: largestAsset.publicUrl,
          folderPath: largestAsset.folderPath,
          sizeBytes: largestAsset.sizeBytes,
        }
      : null,
  };
}

function matchesSmartView(
  asset: MediaCatalogAsset,
  smartView: MediaSmartView,
  managedProvider: MediaStorageRuntimeContext["provider"],
) {
  if (smartView === "used") {
    return asset.provider === managedProvider && asset.catalogRegistered && asset.referenceCount !== null && asset.referenceCount > 0;
  }
  if (smartView === "unused") {
    return (
      asset.provider === managedProvider &&
      asset.catalogRegistered &&
      asset.referenceCount === 0 &&
      asset.reconciliationState === "synced" &&
      !asset.missingObject
    );
  }
  if (smartView === "missing_alt") {
    return asset.provider === managedProvider && asset.catalogRegistered && asset.kind === "image" && !asset.defaultAltText;
  }
  if (smartView === "missing") return asset.provider === managedProvider && asset.missingObject;
  if (smartView === "drift") {
    return asset.provider === managedProvider && (asset.reconciliationState !== "synced" || !asset.catalogRegistered);
  }
  return true;
}

export function buildMediaLibraryReadModel(
  catalog: MediaCatalogSnapshot,
  inventory: PublicMediaInventory,
  input: {
    folder?: string | null;
    query?: string;
    kind?: "all" | "image" | "document";
    smartView?: MediaSmartView;
    page?: number;
    pageSize?: number;
    context: MediaStorageRuntimeContext;
    runtimeState?: MediaCatalogRuntimeState | null;
  },
): MediaCatalogPage {
  const smartView = input.smartView ?? "all";
  const page = Math.max(1, Math.trunc(input.page ?? 1));
  const requestedPageSize = Math.trunc(input.pageSize ?? 20);
  const pageSize = [10, 20, 30, 50, 100].includes(requestedPageSize) ? requestedPageSize : 20;
  const mergedAssets = mergeCatalogAndStorageAssets(catalog, inventory);
  const folders = buildMergedFolders(catalog.folders, inventory, mergedAssets);
  const summary = buildMediaLibrarySummary(inventory, folders, mergedAssets);
  const readiness = buildMediaCatalogReadiness(
    catalog,
    inventory,
    input.runtimeState ?? null,
    input.context,
    MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION,
  );
  const referenceViewBlocked =
    (smartView === "used" || smartView === "unused") &&
    !readiness.usageResultsAuthoritative;
  const normalizedQuery = input.query?.trim().toLocaleLowerCase().slice(0, 120);
  const filtered = referenceViewBlocked
    ? []
    : mergedAssets
        .filter(
          (asset) =>
            !input.folder ||
            asset.folderPath === input.folder ||
            asset.folderPath.startsWith(`${input.folder}/`),
        )
        .filter((asset) => !input.kind || input.kind === "all" || asset.kind === input.kind)
        .filter((asset) => !normalizedQuery || asset.displayName.toLocaleLowerCase().includes(normalizedQuery))
        .filter((asset) => matchesSmartView(asset, smartView, input.context.provider))
        .sort((left, right) => {
          const byDate = right.createdAt.localeCompare(left.createdAt);
          return byDate || right.id.localeCompare(left.id);
        });
  const total = filtered.length;
  const offset = (page - 1) * pageSize;
  return {
    catalogState:
      referenceViewBlocked || inventory.providerAvailable === false
        ? "uncertain"
        : catalog.catalogState,
    warning: referenceViewBlocked
      ? smartView === "used"
        ? "لا يمكن إنشاء قائمة مكتملة للملفات المستخدمة قبل اكتمال فحص مواضع الاستخدام. يظل استعراض الملفات وعرض استخدام ملف محدد متاحًا."
        : "لا يمكن تأكيد أن الملفات غير مستخدمة بعد. يظل استعراض الملفات وعرض استخدام ملف محدد متاحًا."
      : catalog.warning ?? inventory.warning ?? null,
    assets: filtered.slice(offset, offset + pageSize),
    folders,
    page,
    pageSize,
    total,
    totalPages: total ? Math.ceil(total / pageSize) : 0,
    summary,
    readiness,
  };
}

export async function listMediaCatalogSnapshot(): Promise<MediaCatalogSnapshot> {
  const supabase = getSupabaseAdmin();
  const assets: MediaCatalogAsset[] = [];
  const pageSize = 1000;
  const foldersResult = await supabase.from("admin_media_folders_catalog").select("*").order("normalized_path");
  if (isMediaCatalogMissingError(foldersResult.error)) {
    return {
      catalogState: "unavailable",
      warning: "بيانات إدارة الملفات الكاملة غير متاحة؛ يظل الاستعراض متاحًا، بينما أوقفت العمليات الحساسة حفاظًا على الملفات.",
      assets: [],
      folders: [],
    };
  }
  if (foldersResult.error) throw new Error(foldersResult.error.message);

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("admin_media_assets_catalog")
      .select("*")
      .neq("status", "deleted")
      .order("id")
      .range(offset, offset + pageSize - 1);
    if (isMediaCatalogMissingError(error)) {
      return {
        catalogState: "unavailable",
        warning: "بيانات إدارة الملفات الكاملة غير متاحة؛ يظل الاستعراض متاحًا، بينما أوقفت العمليات الحساسة حفاظًا على الملفات.",
        assets: [],
        folders: [],
      };
    }
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    assets.push(...rows.map(mapCatalogAsset));
    if (rows.length < pageSize) break;
  }

  return {
    catalogState: "available",
    warning: null,
    assets,
    folders: (foldersResult.data ?? []).map((row) => mapCatalogFolder(row as Record<string, unknown>)),
  };
}

export async function ensureCatalogFolderHierarchy(folderPath: string, actorId?: number | null) {
  const segments = folderPath.split("/").filter(Boolean);
  const supabase = getSupabaseAdmin();
  let parentPath: string | null = null;

  for (let index = 0; index < segments.length; index += 1) {
    const normalizedPath = segments.slice(0, index + 1).join("/");
    const { error } = await supabase.from("media_folders").upsert(
      {
        normalized_path: normalizedPath,
        parent_path: parentPath,
        display_name:
          normalizedPath === "images" ? "الصور" : normalizedPath === "files" ? "المستندات" : segments[index],
        created_by: actorId ?? null,
        reconciliation_state: "synced",
      },
      { onConflict: "normalized_path", ignoreDuplicates: true },
    );
    if (isMediaCatalogMissingError(error)) throw new MediaCatalogUnavailableError();
    if (error) throw new Error(error.message);
    parentPath = normalizedPath;
  }
}

export async function registerCatalogUpload(
  result: MediaUploadResult,
  file: Pick<File, "name" | "type" | "size" | "arrayBuffer">,
  actorId?: number | null,
) {
  if (result.provider !== "supabase" || !result.bucket || !result.objectKey) return null;
  const folderPath = getFolderPathFromObjectKey(result.objectKey);
  await ensureCatalogFolderHierarchy(folderPath, actorId);

  const extension = path.posix.extname(result.objectKey).toLowerCase();
  const kind = result.kind ?? "image";
  const binaryMetadata = await readUploadBinaryMetadata(file, kind);
  const { data, error } = await getSupabaseAdmin()
    .from("media_assets")
    .upsert(
      {
        provider: result.provider,
        bucket: result.bucket,
        object_key: result.objectKey,
        public_url: result.path,
        original_filename: file.name,
        display_name: file.name,
        media_kind: kind,
        mime_type: result.contentType ?? file.type ?? null,
        extension,
        byte_size: result.sizeBytes ?? file.size,
        width: binaryMetadata.width,
        height: binaryMetadata.height,
        checksum: binaryMetadata.checksum,
        folder_path: folderPath,
        status: "active",
        uploaded_by: actorId ?? null,
        reconciliation_state: "synced",
        missing_object: false,
      },
      { onConflict: "provider,bucket,object_key" },
    )
    .select("*")
    .single();

  if (isMediaCatalogMissingError(error)) throw new MediaCatalogUnavailableError();
  if (error) throw new Error(error.message);
  return mapCatalogAsset({ ...(data as Record<string, unknown>), reference_count: 0 });
}

export async function getCatalogAssetByIdentity(identity: CanonicalMediaIdentity) {
  const { data, error } = await getSupabaseAdmin()
    .from("admin_media_assets_catalog")
    .select("*")
    .eq("provider", identity.provider)
    .eq("bucket", identity.bucket)
    .eq("object_key", identity.objectKey)
    .maybeSingle();
  if (isMediaCatalogMissingError(error)) throw new MediaCatalogUnavailableError();
  if (error) throw new Error(error.message);
  return data ? mapCatalogAsset(data as Record<string, unknown>) : null;
}

export async function getCatalogAssetById(assetId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("admin_media_assets_catalog")
    .select("*")
    .eq("id", assetId)
    .maybeSingle();
  if (isMediaCatalogMissingError(error)) throw new MediaCatalogUnavailableError();
  if (error) throw new Error(error.message);
  return data ? mapCatalogAsset(data as Record<string, unknown>) : null;
}

export async function getCatalogAssetByPublicValue(value: string) {
  const managed = parseManagedStorageAsset(value);
  if (!managed) return null;
  return getCatalogAssetByIdentity({ provider: "supabase", bucket: managed.bucket, objectKey: managed.objectPath });
}

export async function listCatalogReferences(assetId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("media_references")
    .select("*")
    .eq("asset_id", assetId)
    .order("domain_key")
    .order("entity_type")
    .order("entity_identity");
  if (isMediaCatalogMissingError(error)) throw new MediaCatalogUnavailableError();
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapReference(row as Record<string, unknown>));
}

export async function updateCatalogAssetMetadata(
  assetId: string,
  input: { displayName?: string; defaultAltText?: string | null; defaultTitle?: string | null; defaultCaption?: string | null },
) {
  const payload: Record<string, unknown> = {};
  if (input.displayName !== undefined) payload.display_name = input.displayName.trim();
  if (input.defaultAltText !== undefined) payload.default_alt_text = input.defaultAltText?.trim() || null;
  if (input.defaultTitle !== undefined) payload.default_title = input.defaultTitle?.trim() || null;
  if (input.defaultCaption !== undefined) payload.default_caption = input.defaultCaption?.trim() || null;
  if (!Object.keys(payload).length) throw new Error("لا توجد بيانات وسائط صالحة للتحديث.");

  const { data, error } = await getSupabaseAdmin()
    .from("media_assets")
    .update(payload)
    .eq("id", assetId)
    .select("*")
    .single();
  if (isMediaCatalogMissingError(error)) throw new MediaCatalogUnavailableError();
  if (error) throw new Error(error.message);
  return mapCatalogAsset({ ...(data as Record<string, unknown>), reference_count: 0 });
}

export async function markCatalogAssetState(
  assetId: string,
  input: { status?: MediaCatalogAsset["status"]; reconciliationState?: MediaCatalogAsset["reconciliationState"]; missingObject?: boolean },
) {
  const { error } = await getSupabaseAdmin()
    .from("media_assets")
    .update({
      ...(input.status ? { status: input.status } : {}),
      ...(input.reconciliationState ? { reconciliation_state: input.reconciliationState } : {}),
      ...(input.missingObject !== undefined ? { missing_object: input.missingObject } : {}),
    })
    .eq("id", assetId);
  if (isMediaCatalogMissingError(error)) throw new MediaCatalogUnavailableError();
  if (error) throw new Error(error.message);
}

export async function createCatalogFolder(folderPath: string, actorId?: number | null, displayName?: string) {
  await ensureCatalogFolderHierarchy(folderPath, actorId);
  const normalizedDisplayName = displayName?.trim().slice(0, 120);
  if (normalizedDisplayName) {
    const { error: updateError } = await getSupabaseAdmin()
      .from("media_folders")
      .update({ display_name: normalizedDisplayName })
      .eq("normalized_path", folderPath);
    if (isMediaCatalogMissingError(updateError)) throw new MediaCatalogUnavailableError();
    if (updateError) throw new Error(updateError.message);
  }
  const { data, error } = await getSupabaseAdmin()
    .from("admin_media_folders_catalog")
    .select("*")
    .eq("normalized_path", folderPath)
    .single();
  if (isMediaCatalogMissingError(error)) throw new MediaCatalogUnavailableError();
  if (error) throw new Error(error.message);
  return mapCatalogFolder(data as Record<string, unknown>);
}

export async function getAllCatalogAssetIdentityMap() {
  const result = new Map<string, MediaCatalogAsset>();
  const supabase = getSupabaseAdmin();
  const pageSize = 500;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("admin_media_assets_catalog")
      .select("*")
      .neq("status", "deleted")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (isMediaCatalogMissingError(error)) throw new MediaCatalogUnavailableError();
    if (error) throw new Error(error.message);
    const rows = (data ?? []).map((row) => mapCatalogAsset(row as Record<string, unknown>));
    for (const asset of rows) {
      result.set(getCanonicalMediaIdentityKey(asset), asset);
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return result;
}

export async function getMediaCatalogRuntimeState(): Promise<MediaCatalogRuntimeState> {
  const { data, error } = await getSupabaseAdmin()
    .from("site_settings")
    .select("value")
    .eq("key", "media.catalog_state")
    .maybeSingle();
  if (isMediaCatalogMissingError(error)) throw new MediaCatalogUnavailableError();
  if (error) throw new Error(error.message);
  const value = (data?.value ?? {}) as Record<string, unknown>;
  return {
    state: value.state === "synced" ? "synced" : "uncertain",
    provider: value.provider === "supabase" || value.provider === "filesystem" ? value.provider : null,
    environment:
      value.environment === "local" || value.environment === "preview" || value.environment === "production"
        ? value.environment
        : null,
    environmentKey: nullableText(value.environmentKey),
    providerRegistryVersion: nullableText(value.providerRegistryVersion),
    lastScanAt: nullableText(value.lastScanAt),
    lastCatalogSync: nullableText(value.lastCatalogSync),
    lastDryRun: nullableText(value.lastDryRun),
    storageAssetCount: numberOrNull(value.storageAssetCount),
    catalogAssetCount: numberOrNull(value.catalogAssetCount),
    warnings: Array.isArray(value.warnings) ? value.warnings.map(text).filter(Boolean) : [],
  };
}

export async function setMediaCatalogRuntimeState(state: MediaCatalogRuntimeState) {
  const { error } = await getSupabaseAdmin().from("site_settings").upsert(
    {
      key: "media.catalog_state",
      value: state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (isMediaCatalogMissingError(error)) throw new MediaCatalogUnavailableError();
  if (error) throw new Error(error.message);
}
