import path from "path";

import { MediaStorageError, type MediaStorageProvider } from "./media-storage-adapter";

const MEDIA_ROOT_FOLDERS = new Set(["images", "files"]);

export type MediaAssetItem = {
  path: string;
  filename: string;
  extension: string;
  kind: "image" | "document";
  sizeBytes: number | null;
  contentType: string | null;
  uploadedAt: string | null;
  managed: boolean;
  provider: MediaStorageProvider;
  storagePath: string | null;
};

export type PublicMediaFolderListing = {
  folder: string;
  parentFolder: string | null;
  subfolders: string[];
  images: string[];
  documents: string[];
  items: MediaAssetItem[];
};

export function normalizeMediaFolder(folder: string) {
  const cleaned = folder.replace(/^\/+/, "").replace(/\\/g, "/").trim();
  const segments = cleaned.split("/");
  const root = segments[0];
  const hasInvalidSegment = segments.some(
    (segment) => !segment || segment === "." || segment === ".." || !/^[a-z0-9._-]+$/i.test(segment),
  );

  if (!cleaned || (root !== "images" && root !== "files") || hasInvalidSegment) {
    throw new MediaStorageError("invalid_media_folder", "مسار مجلد الوسائط غير صالح.", 400);
  }
  return cleaned;
}

export function resolvePublicFolder(folder: string) {
  const normalized = normalizeMediaFolder(folder);
  const publicRoot = path.join(process.cwd(), "public");
  const target = path.resolve(publicRoot, normalized);
  const relative = path.relative(publicRoot, target);

  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new MediaStorageError("invalid_media_folder", "مسار مجلد الوسائط غير صالح.", 400);
  }

  return { normalized, publicRoot, target };
}

export function getMediaParentFolder(normalized: string) {
  return MEDIA_ROOT_FOLDERS.has(normalized) ? null : path.posix.dirname(normalized);
}
