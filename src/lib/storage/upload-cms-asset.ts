import "server-only";

import path from "path";

import { getSupabaseAdmin } from "../supabase-admin";
import { normalizeMediaFolder, type PublicMediaFolderListing } from "../admin/media-library-paths";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg"]);
const PDF_EXTENSIONS = new Set([".pdf"]);

export const CMS_IMAGES_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET_IMAGES?.trim() || "cms-images";
export const CMS_DOCUMENTS_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET_DOCUMENTS?.trim() || "cms-documents";

export function useSupabaseCmsStorage() {
  if (process.env.CMS_STORAGE_UPLOADS === "filesystem") return false;
  if (process.env.CMS_STORAGE_UPLOADS === "supabase") return true;
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

function bucketForFolder(folder: string) {
  const normalized = normalizeMediaFolder(folder);
  return normalized.startsWith("files/") ? CMS_DOCUMENTS_BUCKET : CMS_IMAGES_BUCKET;
}

function sanitizeUploadFilename(filename: string, allowedExtensions: Set<string>, fallbackStem: string) {
  const base = path.basename(filename);
  const ext = path.extname(base).toLowerCase();
  const stem = path
    .basename(base, ext)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!allowedExtensions.has(ext)) {
    throw new Error("Unsupported file type.");
  }

  return `${stem || fallbackStem}-${Date.now()}${ext}`;
}

function getMediaParentFolder(normalized: string) {
  const rootFolders = new Set(["images", "files"]);
  return rootFolders.has(normalized) ? null : path.posix.dirname(normalized);
}

function isImageFile(filename: string) {
  return IMAGE_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

function isPdfFile(filename: string) {
  return PDF_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

function publicUrlForObject(bucket: string, objectPath: string) {
  const supabase = getSupabaseAdmin();
  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return data.publicUrl;
}

export function storageObjectPathFromPublicValue(value: string, bucket: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const publicMarker = `/storage/v1/object/public/${bucket}/`;
  const markerIndex = trimmed.indexOf(publicMarker);
  if (markerIndex >= 0) {
    return decodeURIComponent(trimmed.slice(markerIndex + publicMarker.length).split("?")[0] ?? "");
  }

  if (trimmed.startsWith("/")) {
    return trimmed.replace(/^\/+/, "");
  }

  return null;
}

async function removeStorageObject(bucket: string, objectPath: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(bucket).remove([objectPath]);
  if (error) throw new Error(error.message);
}

export async function uploadCmsImageToStorage(
  folder: string,
  file: File,
  options?: { replacePath?: string | null },
) {
  const normalized = normalizeMediaFolder(folder);
  const bucket = bucketForFolder(normalized);
  const bytes = Buffer.from(await file.arrayBuffer());
  const replaceKey = options?.replacePath
    ? storageObjectPathFromPublicValue(options.replacePath, bucket)
    : null;

  let objectPath: string;
  if (replaceKey && replaceKey.startsWith(`${normalized}/`)) {
    objectPath = replaceKey;
  } else {
    objectPath = `${normalized}/${sanitizeUploadFilename(file.name, IMAGE_EXTENSIONS, "image")}`;
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: Boolean(replaceKey && objectPath === replaceKey),
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    path: publicUrlForObject(bucket, objectPath),
    filename: path.posix.basename(objectPath),
    storagePath: objectPath,
  };
}

export async function uploadCmsDocumentToStorage(
  folder: string,
  file: File,
  options?: { replacePath?: string | null },
) {
  const normalized = normalizeMediaFolder(folder);
  const bucket = bucketForFolder(normalized);
  const bytes = Buffer.from(await file.arrayBuffer());
  const replaceKey = options?.replacePath
    ? storageObjectPathFromPublicValue(options.replacePath, bucket)
    : null;

  let objectPath: string;
  if (replaceKey && replaceKey.startsWith(`${normalized}/`)) {
    objectPath = replaceKey;
  } else {
    objectPath = `${normalized}/${sanitizeUploadFilename(file.name, PDF_EXTENSIONS, "document")}`;
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
    contentType: file.type || "application/pdf",
    upsert: Boolean(replaceKey && objectPath === replaceKey),
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    path: publicUrlForObject(bucket, objectPath),
    filename: path.posix.basename(objectPath),
    storagePath: objectPath,
  };
}

export async function listCmsFolderFromStorage(folder = "images"): Promise<PublicMediaFolderListing> {
  const normalized = normalizeMediaFolder(folder);
  const bucket = bucketForFolder(normalized);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.storage.from(bucket).list(normalized, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) {
    throw new Error(error.message);
  }

  const subfolders: string[] = [];
  const images: string[] = [];
  const documents: string[] = [];

  for (const entry of data ?? []) {
    if (!entry.name) continue;

    const entryPath = `${normalized}/${entry.name}`;
    const isFolder = entry.id == null && !entry.metadata;

    if (isFolder) {
      subfolders.push(entry.name);
      continue;
    }

    const publicPath = publicUrlForObject(bucket, entryPath);
    if (isImageFile(entry.name)) {
      images.push(publicPath);
      continue;
    }
    if (isPdfFile(entry.name)) {
      documents.push(publicPath);
    }
  }

  return {
    folder: normalized,
    parentFolder: getMediaParentFolder(normalized),
    subfolders: subfolders.sort((a, b) => a.localeCompare(b)),
    images: images.sort((a, b) => a.localeCompare(b)),
    documents: documents.sort((a, b) => a.localeCompare(b)),
  };
}
