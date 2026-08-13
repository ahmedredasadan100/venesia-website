import path from "path";

import { MediaStorageError } from "../media-storage-adapter";
import type { CanonicalMediaIdentity } from "./types";

export const LEGACY_PUBLIC_MEDIA_BUCKET = "public";

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
  if (input.provider !== "supabase" && input.provider !== "filesystem") {
    throw new MediaStorageError("invalid_media_provider", "مزود ملف الوسائط غير صالح.", 400);
  }
  if (input.provider === "filesystem" && bucket !== LEGACY_PUBLIC_MEDIA_BUCKET) {
    throw new MediaStorageError("invalid_media_bucket", "حاوية ملف الوسائط غير صالحة.", 400);
  }
  const objectKey = normalizeManagedObjectKey(input.objectKey);
  if (/^images\/projects\//i.test(objectKey) && objectKey !== objectKey.toLowerCase()) {
    throw new MediaStorageError(
      "invalid_project_media_path_case",
      "Project media paths must be lowercase.",
      400,
    );
  }
  return {
    provider: input.provider,
    bucket,
    objectKey,
  };
}

export function parseLegacyPublicMediaAsset(value: string): CanonicalMediaIdentity | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let pathname: string;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      pathname = new URL(trimmed).pathname;
    } catch {
      return null;
    }
  } else {
    pathname = trimmed.split(/[?#]/, 1)[0];
  }

  const match = pathname.match(/^\/(images|files)\/(.+)$/i);
  if (!match) return null;

  let decodedPath = `${match[1].toLowerCase()}/${match[2]}`;
  try {
    decodedPath = decodeURIComponent(decodedPath);
  } catch {
    // Keep the original path when it contains a literal percent character.
  }

  try {
    return createCanonicalMediaIdentity({
      provider: "filesystem",
      bucket: LEGACY_PUBLIC_MEDIA_BUCKET,
      objectKey: decodedPath,
    });
  } catch {
    return null;
  }
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
