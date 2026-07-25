import "server-only";

import path from "path";

import { parseManagedStorageAsset } from "../../storage/upload-cms-asset";
import { getSupabaseAdmin } from "../../supabase-admin";
import type { MediaUploadResult } from "../media-storage-adapter";
import type { MediaAssetItem, PublicMediaFolderListing } from "../media-library-paths";
import { getFolderPathFromObjectKey, isMediaCatalogMissingError } from "./identity";
import { getCanonicalMediaIdentityKey } from "./identity";
import type {
  CanonicalMediaIdentity,
  MediaCatalogAsset,
  MediaCatalogFolder,
  MediaCatalogPage,
  MediaReferenceRecord,
  MediaSmartView,
} from "./types";
import { readUploadBinaryMetadata } from "./binary-metadata";
import { MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION } from "./reference-providers";

export class MediaCatalogUnavailableError extends Error {
  readonly code = "media_catalog_unavailable";

  constructor(message = "كتالوج الوسائط غير متاح. تم منع العمليات الحساسة حتى اكتمال الترحيل.") {
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

export async function listMediaCatalogPage(input: {
  folder?: string | null;
  query?: string;
  kind?: "all" | "image" | "document";
  smartView?: MediaSmartView;
  page?: number;
  pageSize?: number;
} = {}): Promise<MediaCatalogPage> {
  const page = Math.max(1, Math.trunc(input.page ?? 1));
  const pageSize = Math.min(96, Math.max(12, Math.trunc(input.pageSize ?? 24)));
  const smartView = input.smartView ?? "all";
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("admin_media_assets_catalog")
    .select("*", { count: "exact" })
    .neq("status", "deleted");

  if (input.folder) query = query.eq("folder_path", input.folder);
  if (input.kind && input.kind !== "all") query = query.eq("media_kind", input.kind);

  const safeSearch = input.query?.trim().replace(/[,%_()]/g, " ").slice(0, 120);
  if (safeSearch) query = query.ilike("display_name", `%${safeSearch}%`);

  if (smartView === "used") query = query.gt("reference_count", 0);
  if (smartView === "unused") {
    query = query
      .eq("reference_count", 0)
      .eq("reconciliation_state", "synced")
      .eq("missing_object", false);
  }
  if (smartView === "missing_alt") query = query.eq("media_kind", "image").is("default_alt_text", null);
  if (smartView === "missing") query = query.eq("missing_object", true);
  if (smartView === "drift") query = query.neq("reconciliation_state", "synced");
  if (smartView === "large") {
    query = query.order("byte_size", { ascending: false, nullsFirst: false });
  } else {
    query = query.order("created_at", { ascending: false }).order("id", { ascending: false });
  }

  const from = (page - 1) * pageSize;
  const [{ data, error, count }, foldersResult] = await Promise.all([
    query.range(from, from + pageSize - 1),
    supabase.from("admin_media_folders_catalog").select("*").order("normalized_path"),
  ]);

  if (isMediaCatalogMissingError(error) || isMediaCatalogMissingError(foldersResult.error)) {
    return {
      catalogState: "unavailable",
      warning: "Migration كتالوج الوسائط غير مطبقة في البيئة المتصلة؛ الحذف والاستبدال والنقل محجوبة.",
      assets: [],
      folders: [],
      page,
      pageSize,
      total: 0,
      totalPages: 0,
    };
  }
  if (error) throw new Error(error.message);
  if (foldersResult.error) throw new Error(foldersResult.error.message);

  if (smartView === "unused") {
    const runtimeState = await getMediaCatalogRuntimeState();
    if (
      runtimeState.state !== "synced" ||
      runtimeState.providerRegistryVersion !== MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION
    ) {
      return {
        catalogState: "uncertain",
        warning: "لا يمكن إعلان أي أصل كغير مستخدم قبل اكتمال reconciliation بنفس إصدار Provider Registry.",
        assets: [],
        folders: (foldersResult.data ?? []).map((row) => mapCatalogFolder(row as Record<string, unknown>)),
        page,
        pageSize,
        total: 0,
        totalPages: 0,
      };
    }
  }

  const total = count ?? 0;
  return {
    catalogState: "available",
    warning: null,
    assets: (data ?? []).map((row) => mapCatalogAsset(row as Record<string, unknown>)),
    folders: (foldersResult.data ?? []).map((row) => mapCatalogFolder(row as Record<string, unknown>)),
    page,
    pageSize,
    total,
    totalPages: total ? Math.ceil(total / pageSize) : 0,
  };
}

function fallbackAsset(item: MediaAssetItem): MediaCatalogAsset {
  return {
    id: `unmanaged:${item.path}`,
    provider: item.provider,
    bucket: item.provider === "filesystem" ? "public" : "unknown",
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
    createdAt: item.uploadedAt ?? "",
    updatedAt: item.uploadedAt ?? "",
    referenceCount: 0,
  };
}

export function mergeCatalogFallback(page: MediaCatalogPage, listing: PublicMediaFolderListing): MediaCatalogPage {
  if (page.catalogState !== "unavailable") return page;
  return {
    ...page,
    assets: listing.items.map(fallbackAsset),
    total: listing.items.length,
    totalPages: listing.items.length ? 1 : 0,
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

export type MediaCatalogRuntimeState = {
  state: "synced" | "uncertain";
  providerRegistryVersion: string | null;
  lastCatalogSync: string | null;
  lastDryRun: string | null;
  warnings: string[];
};

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
    providerRegistryVersion: nullableText(value.providerRegistryVersion),
    lastCatalogSync: nullableText(value.lastCatalogSync),
    lastDryRun: nullableText(value.lastDryRun),
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
