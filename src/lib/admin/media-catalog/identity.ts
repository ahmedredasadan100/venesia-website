import path from "path";

import { MediaStorageError } from "../media-storage-adapter";
import type { CanonicalMediaIdentity } from "./types";

export function normalizeManagedObjectKey(value: string) {
  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "").trim();
  const segments = normalized.split("/");
  if (
    segments.length < 2 ||
    !["images", "files"].includes(segments[0]) ||
    segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("\0"))
  ) {
    throw new MediaStorageError("invalid_media_object_key", "مسار ملف الوسائط غير صالح.", 400);
  }
  return segments.join("/");
}

export function createCanonicalMediaIdentity(input: CanonicalMediaIdentity): CanonicalMediaIdentity {
  const bucket = input.bucket.trim();
  if (!bucket || bucket.includes("/") || bucket.includes("\\")) {
    throw new MediaStorageError("invalid_media_bucket", "حاوية ملف الوسائط غير صالحة.", 400);
  }
  return {
    provider: "supabase",
    bucket,
    objectKey: normalizeManagedObjectKey(input.objectKey),
  };
}

export function getCanonicalMediaIdentityKey(identity: CanonicalMediaIdentity) {
  const normalized = createCanonicalMediaIdentity(identity);
  return `${normalized.provider}:${normalized.bucket}:${normalized.objectKey}`;
}

export function getFolderPathFromObjectKey(objectKey: string) {
  const normalized = normalizeManagedObjectKey(objectKey);
  return path.posix.dirname(normalized);
}

export function isMediaCatalogMissingError(error: { code?: string | null; message?: string | null } | null) {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /media_(assets|folders|references)|admin_media_(assets|folders)_catalog/i.test(error.message ?? "")
  );
}
