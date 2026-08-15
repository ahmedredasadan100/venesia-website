import "server-only";

import { randomUUID } from "crypto";
import path from "path";

import {
  CMS_IMAGE_EXTENSION_SET,
  CMS_PDF_EXTENSION_SET,
  sanitizeCmsUploadFilename,
  validateCmsUploadFile,
} from "../admin/media-intelligence/cms-upload-policy";
import {
  MediaStorageError,
  type MediaStorageAdapter,
  type MediaUploadOptions,
} from "../admin/media-storage-adapter";
import {
  normalizeMediaFolder,
  type MediaAssetItem,
  type PublicMediaFolderListing,
  type PublicMediaInventory,
} from "../admin/media-library-paths";
import { getSupabaseStorageAdmin } from "../supabase-admin";

const IMAGE_EXTENSIONS = CMS_IMAGE_EXTENSION_SET;
const PDF_EXTENSIONS = CMS_PDF_EXTENSION_SET;

export const CMS_IMAGES_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET_IMAGES?.trim() || "cms-images";
export const CMS_DOCUMENTS_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET_DOCUMENTS?.trim() || "cms-documents";

type SupabaseAdminClient = ReturnType<typeof getSupabaseStorageAdmin>;

type StorageListEntry = {
  id?: string | null;
  name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type DiscoveredManagedStorageAsset = {
  provider: "supabase";
  bucket: string;
  objectKey: string;
  publicUrl: string;
  filename: string;
  folderPath: string;
  kind: "image" | "document";
  sizeBytes: number | null;
  contentType: string | null;
  uploadedAt: string | null;
};

export type ManagedStorageAsset = {
  bucket: string;
  objectPath: string;
  kind: "image" | "document";
};

function bucketForFolder(folder: string) {
  const normalized = normalizeMediaFolder(folder);
  return normalized === "files" || normalized.startsWith("files/")
    ? CMS_DOCUMENTS_BUCKET
    : CMS_IMAGES_BUCKET;
}

function getMediaParentFolder(normalized: string) {
  return normalized === "images" || normalized === "files"
    ? null
    : path.posix.dirname(normalized);
}

function isImageFile(filename: string) {
  return IMAGE_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

function isPdfFile(filename: string) {
  return PDF_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

function numberMetadata(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringMetadata(metadata: Record<string, unknown> | null | undefined, keys: string[]) {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function buildAssetItem(
  publicPath: string,
  bucket: string,
  storagePath: string,
  entry: StorageListEntry,
  kind: "image" | "document",
): MediaAssetItem {
  const filename = entry.name ?? path.posix.basename(storagePath);
  return {
    path: publicPath,
    filename,
    extension: path.extname(filename).toLowerCase(),
    kind,
    sizeBytes:
      numberMetadata(entry.metadata, "size") ??
      numberMetadata(entry.metadata, "contentLength"),
    contentType: stringMetadata(entry.metadata, ["mimetype", "contentType"]),
    uploadedAt: entry.created_at ?? entry.updated_at ?? null,
    managed: true,
    provider: "supabase",
    bucket,
    storagePath,
  };
}

function publicUrlForObject(
  supabase: SupabaseAdminClient,
  bucket: string,
  objectPath: string,
) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  if (!data.publicUrl) {
    throw new MediaStorageError(
      "media_public_url_failed",
      "تعذر إنشاء رابط عام ثابت للملف.",
      503,
    );
  }
  return data.publicUrl;
}

function hasSafeObjectPath(objectPath: string, expectedRoot: "images" | "files") {
  const segments = objectPath.split("/");
  return (
    segments[0] === expectedRoot &&
    segments.length >= 2 &&
    segments.every(
      (segment) =>
        Boolean(segment) &&
        segment !== "." &&
        segment !== ".." &&
        !segment.includes("\\") &&
        !segment.includes("\0"),
    )
  );
}

function publicUrlPrefix(
  supabase: SupabaseAdminClient,
  bucket: string,
) {
  const probe = "__media_storage_probe__";
  const probeUrl = new URL(publicUrlForObject(supabase, bucket, probe));
  return {
    origin: probeUrl.origin,
    pathname: probeUrl.pathname.slice(0, -probe.length),
  };
}

export function parseManagedStorageAsset(
  value: string,
  supabase: SupabaseAdminClient = getSupabaseStorageAdmin(),
): ManagedStorageAsset | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let candidate: URL;
  try {
    candidate = new URL(trimmed);
  } catch {
    return null;
  }

  for (const [bucket, kind, root] of [
    [CMS_IMAGES_BUCKET, "image", "images"],
    [CMS_DOCUMENTS_BUCKET, "document", "files"],
  ] as const) {
    const prefix = publicUrlPrefix(supabase, bucket);
    if (candidate.origin !== prefix.origin || !candidate.pathname.startsWith(prefix.pathname)) {
      continue;
    }

    const encodedPath = candidate.pathname.slice(prefix.pathname.length);
    let objectPath: string;
    try {
      objectPath = decodeURIComponent(encodedPath);
    } catch {
      return null;
    }

    if (!hasSafeObjectPath(objectPath, root)) return null;
    return { bucket, objectPath, kind };
  }

  return null;
}

function uniqueStorageFilename(
  file: File,
  allowedExtensions: Set<string>,
  fallbackStem: string,
) {
  const sanitized = sanitizeCmsUploadFilename(file.name, allowedExtensions, fallbackStem);
  const extension = path.extname(sanitized);
  const stem = sanitized.slice(0, -extension.length);
  return `${stem}-${randomUUID().slice(0, 12)}${extension}`;
}

async function uploadCmsAssetToStorage(
  supabase: SupabaseAdminClient,
  folder: string,
  file: File,
  kind: "image" | "pdf",
  options?: MediaUploadOptions,
) {
  const validation = validateCmsUploadFile(file, kind);
  if (!validation.ok) {
    throw new MediaStorageError("invalid_media_upload", validation.message, 400);
  }

  const normalized = normalizeMediaFolder(folder);
  const expectedRoot = kind === "pdf" ? "files" : "images";
  if (normalized !== expectedRoot && !normalized.startsWith(`${expectedRoot}/`)) {
    throw new MediaStorageError(
      "invalid_media_folder",
      "نوع الملف لا يطابق مجلد الوسائط المحدد.",
      400,
    );
  }

  const bucket = bucketForFolder(normalized);
  const allowedExtensions = kind === "pdf" ? PDF_EXTENSIONS : IMAGE_EXTENSIONS;
  // Replacement always creates a new canonical object. The Media capability
  // coordinates reference rebinds and decides when the old object is deletable.
  void options?.replacePath;
  const objectPath = `${normalized}/${uniqueStorageFilename(
    file,
    allowedExtensions,
    kind === "pdf" ? "document" : "image",
  )}`;

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
    contentType: file.type || (kind === "pdf" ? "application/pdf" : "application/octet-stream"),
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    console.error("Supabase CMS media upload failed", {
      bucket,
      code: "statusCode" in error ? error.statusCode : "storage_error",
      message: error.message,
    });
    throw new MediaStorageError(
      "media_upload_failed",
      "تعذر رفع الملف إلى التخزين الدائم. تحقق من إعداد Supabase Storage وحاول مجددًا.",
      503,
    );
  }

  return {
    path: publicUrlForObject(supabase, bucket, objectPath),
    filename: path.posix.basename(objectPath),
    storagePath: objectPath,
    provider: "supabase" as const,
    bucket,
    objectKey: objectPath,
    kind: kind === "pdf" ? ("document" as const) : ("image" as const),
    contentType: file.type || null,
    sizeBytes: file.size,
  };
}

export async function verifyManagedStorageAssetExists(
  value: string,
  supabase: SupabaseAdminClient = getSupabaseStorageAdmin(),
) {
  const managed = parseManagedStorageAsset(value, supabase);
  if (!managed) return { managed: false as const, exists: false as const };
  const folder = path.posix.dirname(managed.objectPath);
  const filename = path.posix.basename(managed.objectPath);
  const { data, error } = await supabase.storage.from(managed.bucket).list(folder, {
    limit: 100,
    search: filename,
  });
  if (error) {
    throw new MediaStorageError(
      "media_storage_verification_failed",
      "تعذر التحقق من وجود الملف في التخزين الدائم.",
      503,
    );
  }
  return {
    managed: true as const,
    exists: (data ?? []).some((entry) => entry.name === filename),
    bucket: managed.bucket,
    objectPath: managed.objectPath,
  };
}

async function listPublicImagePathsFromStorageClient(
  supabase: SupabaseAdminClient,
  folder = "images",
  limit = 240,
) {
  const normalized = normalizeMediaFolder(folder);
  if (normalized !== "images" && !normalized.startsWith("images/")) {
    throw new MediaStorageError("invalid_media_folder", "مسار مجلد الصور غير صالح.", 400);
  }
  const bucket = bucketForFolder(normalized);
  const results: string[] = [];

  async function walk(prefix: string) {
    if (results.length >= limit) return;

    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      throw new MediaStorageError(
        "media_list_failed",
        "تعذر تحميل مكتبة الوسائط من التخزين الدائم.",
        503,
      );
    }

    for (const rawEntry of data ?? []) {
      if (results.length >= limit) break;
      const entry = rawEntry as StorageListEntry;
      if (!entry.name) continue;

      const entryPath = `${prefix}/${entry.name}`;
      const isFolder = entry.id == null && !entry.metadata;
      if (isFolder) {
        await walk(entryPath);
      } else if (isImageFile(entry.name)) {
        results.push(publicUrlForObject(supabase, bucket, entryPath));
      }
    }
  }

  await walk(normalized);
  return results.slice(0, limit).sort((a, b) => a.localeCompare(b));
}

async function listCmsFolderFromStorageClient(
  supabase: SupabaseAdminClient,
  folder = "images",
): Promise<PublicMediaFolderListing> {
  const normalized = normalizeMediaFolder(folder);
  const bucket = bucketForFolder(normalized);
  const { data, error } = await supabase.storage.from(bucket).list(normalized, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) {
    throw new MediaStorageError(
      "media_list_failed",
      "تعذر تحميل مكتبة الوسائط من التخزين الدائم.",
      503,
    );
  }

  const subfolders: string[] = [];
  const images: string[] = [];
  const documents: string[] = [];
  const items: MediaAssetItem[] = [];

  for (const rawEntry of data ?? []) {
    const entry = rawEntry as StorageListEntry;
    if (!entry.name) continue;

    const entryPath = `${normalized}/${entry.name}`;
    const isFolder = entry.id == null && !entry.metadata;
    if (isFolder) {
      subfolders.push(entry.name);
      continue;
    }

    const publicPath = publicUrlForObject(supabase, bucket, entryPath);
    if (isImageFile(entry.name)) {
      images.push(publicPath);
      items.push(buildAssetItem(publicPath, bucket, entryPath, entry, "image"));
    } else if (isPdfFile(entry.name)) {
      documents.push(publicPath);
      items.push(buildAssetItem(publicPath, bucket, entryPath, entry, "document"));
    }
  }

  return {
    folder: normalized,
    parentFolder: getMediaParentFolder(normalized),
    subfolders: subfolders.sort((a, b) => a.localeCompare(b)),
    images: images.sort((a, b) => a.localeCompare(b)),
    documents: documents.sort((a, b) => a.localeCompare(b)),
    items: items.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

export function createSupabaseCmsMediaStorageAdapter(
  supabase: SupabaseAdminClient = getSupabaseStorageAdmin(),
): MediaStorageAdapter {
  return {
    provider: "supabase",
    listFolder(folder = "images") {
      return listCmsFolderFromStorageClient(supabase, folder);
    },
    async listInventory(): Promise<PublicMediaInventory> {
      const inventory = await listAllSupabaseManagedStorageAssets(supabase);
      return {
        provider: "supabase",
        folders: inventory.folders,
        items: inventory.assets.map((asset) => ({
          path: asset.publicUrl,
          filename: asset.filename,
          extension: path.posix.extname(asset.filename).toLowerCase(),
          kind: asset.kind,
          sizeBytes: asset.sizeBytes,
          contentType: asset.contentType,
          uploadedAt: asset.uploadedAt,
          managed: true,
          provider: "supabase",
          bucket: asset.bucket,
          storagePath: asset.objectKey,
        })),
      };
    },
    listImagePaths(folder = "images", limit = 240) {
      return listPublicImagePathsFromStorageClient(supabase, folder, limit);
    },
    uploadImage(folder, file, options) {
      return uploadCmsAssetToStorage(supabase, folder, file, "image", options);
    },
    uploadDocument(folder, file, options) {
      return uploadCmsAssetToStorage(supabase, folder, file, "pdf", options);
    },
    isManagedAsset(value) {
      return parseManagedStorageAsset(value, supabase) !== null;
    },
    async deleteAsset(value) {
      const managed = parseManagedStorageAsset(value, supabase);
      if (!managed) {
        throw new MediaStorageError(
          "unmanaged_media_asset",
          "لا يمكن حذف هذا الملف لأنه ليس أصلًا مُدارًا داخل التخزين الدائم.",
          400,
        );
      }

      const { error } = await supabase.storage
        .from(managed.bucket)
        .remove([managed.objectPath]);
      if (error) {
        throw new MediaStorageError(
          "media_delete_failed",
          "تعذر حذف الملف من التخزين الدائم.",
          503,
        );
      }

      return { path: value, storagePath: managed.objectPath };
    },
  };
}

async function listStoragePrefixFully(
  supabase: SupabaseAdminClient,
  bucket: string,
  prefix: string,
) {
  const entries: StorageListEntry[] = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) {
      throw new MediaStorageError(
        "media_inventory_list_failed",
        "تعذر إكمال سرد أصول التخزين.",
        503,
      );
    }
    const page = (data ?? []) as StorageListEntry[];
    entries.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return entries;
}

export async function listAllSupabaseManagedStorageAssets(
  supabase: SupabaseAdminClient = getSupabaseStorageAdmin(),
) {
  const folders = new Set<string>(["images", "files"]);
  const assets: DiscoveredManagedStorageAsset[] = [];
  const queue: Array<{ bucket: string; prefix: string; kind: "image" | "document" }> = [
    { bucket: CMS_IMAGES_BUCKET, prefix: "images", kind: "image" },
    { bucket: CMS_DOCUMENTS_BUCKET, prefix: "files", kind: "document" },
  ];

  while (queue.length) {
    const batch = queue.splice(0, 6);
    const results = await Promise.all(
      batch.map(async (item) => ({ item, entries: await listStoragePrefixFully(supabase, item.bucket, item.prefix) })),
    );

    for (const { item, entries } of results) {
      for (const entry of entries) {
        if (!entry.name) continue;
        const objectKey = `${item.prefix}/${entry.name}`;
        const isFolder = entry.id == null && !entry.metadata;
        if (isFolder) {
          folders.add(objectKey);
          queue.push({ ...item, prefix: objectKey });
          continue;
        }
        const supported = item.kind === "image" ? isImageFile(entry.name) : isPdfFile(entry.name);
        if (!supported) continue;
        assets.push({
          provider: "supabase",
          bucket: item.bucket,
          objectKey,
          publicUrl: publicUrlForObject(supabase, item.bucket, objectKey),
          filename: entry.name,
          folderPath: item.prefix,
          kind: item.kind,
          sizeBytes:
            numberMetadata(entry.metadata, "size") ?? numberMetadata(entry.metadata, "contentLength"),
          contentType: stringMetadata(entry.metadata, ["mimetype", "contentType"]),
          uploadedAt: entry.created_at ?? entry.updated_at ?? null,
        });
      }
    }
  }

  return {
    folders: [...folders].sort((a, b) => a.localeCompare(b)),
    assets: assets.sort((a, b) => a.objectKey.localeCompare(b.objectKey)),
  };
}

export async function moveManagedStorageAsset(
  publicValue: string,
  targetObjectKey: string,
  supabase: SupabaseAdminClient = getSupabaseStorageAdmin(),
) {
  const managed = parseManagedStorageAsset(publicValue, supabase);
  if (!managed) {
    throw new MediaStorageError("media_move_unmanaged", "لا يمكن نقل أصل غير مُدار.", 400);
  }
  const normalizedTarget = targetObjectKey.replace(/\\/g, "/").replace(/^\/+/, "").trim();
  const expectedRoot = managed.kind === "document" ? "files" : "images";
  if (!hasSafeObjectPath(normalizedTarget, expectedRoot)) {
    throw new MediaStorageError("media_move_invalid_target", "مسار النقل أو إعادة التسمية غير صالح.", 400);
  }
  if (normalizedTarget === managed.objectPath) {
    throw new MediaStorageError("media_move_same_path", "المسار الجديد مطابق للمسار الحالي.", 400);
  }
  const targetBucket = bucketForFolder(path.posix.dirname(normalizedTarget));
  if (targetBucket !== managed.bucket) {
    throw new MediaStorageError("media_move_cross_bucket", "النقل بين حاويات مختلفة غير مدعوم في هذه العملية.", 400);
  }
  const targetFolder = path.posix.dirname(normalizedTarget);
  const targetFilename = path.posix.basename(normalizedTarget);
  const { data: targetEntries, error: targetCheckError } = await supabase.storage.from(managed.bucket).list(targetFolder, {
    search: targetFilename,
    limit: 100,
  });
  if (targetCheckError) {
    throw new MediaStorageError("media_move_target_check_failed", "تعذر إثبات خلو مسار الوجهة.", 503);
  }
  if ((targetEntries ?? []).some((entry) => entry.name === targetFilename)) {
    throw new MediaStorageError("media_move_collision", "يوجد أصل فعلي في مسار الوجهة.", 409);
  }
  const { error } = await supabase.storage.from(managed.bucket).move(managed.objectPath, normalizedTarget);
  if (error) {
    throw new MediaStorageError("media_move_failed", "تعذر نقل الأصل داخل التخزين؛ لم يتم إعلان نجاح.", 503);
  }
  return {
    provider: "supabase" as const,
    bucket: managed.bucket,
    objectKey: normalizedTarget,
    publicUrl: publicUrlForObject(supabase, managed.bucket, normalizedTarget),
  };
}
