import "server-only";

import { getSupabaseAdmin } from "../../supabase-admin";
import {
  CMS_IMAGE_EXTENSIONS,
  CMS_MAX_IMAGE_BYTES,
  CMS_MAX_PDF_BYTES,
  CMS_PDF_EXTENSIONS,
  type CmsUploadValidationPolicy,
} from "../media-intelligence/cms-upload-policy";

export type MediaSettings = {
  maxImageBytes: number;
  maxDocumentBytes: number;
  allowedKinds: Array<"image" | "document">;
  allowedImageExtensions: string[];
  allowedDocumentExtensions: string[];
  mimeVerification: boolean;
  collisionPolicy: "unique_name";
  safeDeletePolicy: "authoritative_zero_references";
};

export const DEFAULT_MEDIA_SETTINGS: MediaSettings = {
  maxImageBytes: CMS_MAX_IMAGE_BYTES,
  maxDocumentBytes: CMS_MAX_PDF_BYTES,
  allowedKinds: ["image", "document"],
  allowedImageExtensions: [...CMS_IMAGE_EXTENSIONS],
  allowedDocumentExtensions: [...CMS_PDF_EXTENSIONS],
  mimeVerification: true,
  collisionPolicy: "unique_name",
  safeDeletePolicy: "authoritative_zero_references",
};

function boundedInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1024 || parsed > max) return fallback;
  return parsed;
}

function allowedSubset(value: unknown, supported: readonly string[], fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const allowed = value.filter((item): item is string => typeof item === "string" && supported.includes(item));
  return allowed.length ? [...new Set(allowed)] : fallback;
}

export function parseMediaSettings(value: unknown): MediaSettings {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const requestedKinds = Array.isArray(input.allowedKinds)
    ? input.allowedKinds.filter((kind): kind is "image" | "document" => kind === "image" || kind === "document")
    : DEFAULT_MEDIA_SETTINGS.allowedKinds;
  return {
    maxImageBytes: boundedInteger(input.maxImageBytes, CMS_MAX_IMAGE_BYTES, CMS_MAX_IMAGE_BYTES),
    maxDocumentBytes: boundedInteger(input.maxDocumentBytes, CMS_MAX_PDF_BYTES, CMS_MAX_PDF_BYTES),
    allowedKinds: requestedKinds.length ? [...new Set(requestedKinds)] : DEFAULT_MEDIA_SETTINGS.allowedKinds,
    allowedImageExtensions: allowedSubset(
      input.allowedImageExtensions,
      CMS_IMAGE_EXTENSIONS,
      DEFAULT_MEDIA_SETTINGS.allowedImageExtensions,
    ),
    allowedDocumentExtensions: allowedSubset(
      input.allowedDocumentExtensions,
      CMS_PDF_EXTENSIONS,
      DEFAULT_MEDIA_SETTINGS.allowedDocumentExtensions,
    ),
    mimeVerification: input.mimeVerification !== false,
    collisionPolicy: "unique_name",
    safeDeletePolicy: "authoritative_zero_references",
  };
}

export async function loadMediaSettings() {
  const { data, error } = await getSupabaseAdmin()
    .from("site_settings")
    .select("value")
    .eq("key", "media.settings")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return parseMediaSettings(data?.value);
}

export async function saveMediaSettings(settings: MediaSettings) {
  const parsed = parseMediaSettings(settings);
  const { error } = await getSupabaseAdmin().from("site_settings").upsert(
    { key: "media.settings", value: parsed, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
  return parsed;
}

export function mediaSettingsToUploadPolicy(settings: MediaSettings): CmsUploadValidationPolicy {
  return {
    maxImageBytes: settings.maxImageBytes,
    maxPdfBytes: settings.maxDocumentBytes,
    allowedImageExtensions: settings.allowedImageExtensions,
    allowedPdfExtensions: settings.allowedDocumentExtensions,
    mimeVerification: settings.mimeVerification,
  };
}
