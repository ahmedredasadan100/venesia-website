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
  resolveMediaStorageProvider,
  type MediaStorageAdapter,
  type MediaUploadOptions,
} from "../admin/media-storage-adapter";
import {
  normalizeMediaFolder,
  type MediaAssetItem,
  type PublicMediaFolderListing,
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

type ManagedStorageAsset = {
  bucket: string;
  objectPath: string;
  kind: "image" | "document";
};

export function isSupabaseCmsStorageEnabled() {
  return resolveMediaStorageProvider() === "supabase";
}

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

export function storageObjectPathFromPublicValue(
  value: string,
  bucket: string,
  supabase: SupabaseAdminClient = getSupabaseStorageAdmin(),
) {
  const managed = parseManagedStorageAsset(value, supabase);
  return managed?.bucket === bucket ? managed.objectPath : null;
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
  const replacement = options?.replacePath
    ? parseManagedStorageAsset(options.replacePath, supabase)
    : null;
  const replacementExtension = replacement
    ? path.posix.extname(replacement.objectPath).toLowerCase()
    : "";
  const incomingExtension = path.extname(file.name).toLowerCase();
  const canReplaceInPlace = Boolean(
    replacement &&
      replacement.bucket === bucket &&
      replacement.objectPath.startsWith(`${normalized}/`) &&
      replacementExtension === incomingExtension,
  );
  const objectPath = canReplaceInPlace
    ? replacement!.objectPath
    : `${normalized}/${uniqueStorageFilename(
        file,
        allowedExtensions,
        kind === "pdf" ? "document" : "image",
      )}`;

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
    contentType: file.type || (kind === "pdf" ? "application/pdf" : "application/octet-stream"),
    cacheControl: "3600",
    upsert: canReplaceInPlace,
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
      items.push(buildAssetItem(publicPath, entryPath, entry, "image"));
    } else if (isPdfFile(entry.name)) {
      documents.push(publicPath);
      items.push(buildAssetItem(publicPath, entryPath, entry, "document"));
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

export function listPublicImagePathsFromStorage(folder = "images", limit = 240) {
  return createSupabaseCmsMediaStorageAdapter().listImagePaths(folder, limit);
}

export function listCmsFolderFromStorage(folder = "images") {
  return createSupabaseCmsMediaStorageAdapter().listFolder(folder);
}

export function uploadCmsImageToStorage(
  folder: string,
  file: File,
  options?: MediaUploadOptions,
) {
  return createSupabaseCmsMediaStorageAdapter().uploadImage(folder, file, options);
}

export function uploadCmsDocumentToStorage(
  folder: string,
  file: File,
  options?: MediaUploadOptions,
) {
  return createSupabaseCmsMediaStorageAdapter().uploadDocument(folder, file, options);
}
