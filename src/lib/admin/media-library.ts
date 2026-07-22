import "server-only";

import { createSupabaseCmsMediaStorageAdapter } from "../storage/upload-cms-asset";
import {
  resolveMediaStorageProvider,
  type MediaStorageAdapter,
  type MediaUploadOptions,
} from "./media-storage-adapter";

export type { PublicMediaFolderListing } from "./media-library-paths";
export { normalizeMediaFolder } from "./media-library-paths";
export {
  getPublicMediaStorageError,
  MediaStorageError,
  resolveMediaStorageProvider,
} from "./media-storage-adapter";

export async function getMediaStorageAdapter(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<MediaStorageAdapter> {
  if (resolveMediaStorageProvider(environment) === "supabase") {
    return createSupabaseCmsMediaStorageAdapter();
  }

  // Local development keeps read/write support for bundled legacy assets.
  // This module is never imported by the production provider branch.
  const { createFilesystemMediaStorageAdapter } = await import("./media-library-fs");
  return createFilesystemMediaStorageAdapter();
}

export async function listPublicMediaFolder(folder = "images") {
  return (await getMediaStorageAdapter()).listFolder(folder);
}

export async function listPublicImagePaths(folder = "images", limit = 240) {
  return (await getMediaStorageAdapter()).listImagePaths(folder, limit);
}

export async function savePublicMediaUpload(
  folder: string,
  file: File,
  options?: MediaUploadOptions,
) {
  return (await getMediaStorageAdapter()).uploadImage(folder, file, options);
}

export async function savePublicDocumentUpload(
  folder: string,
  file: File,
  options?: MediaUploadOptions,
) {
  return (await getMediaStorageAdapter()).uploadDocument(folder, file, options);
}

export async function isManagedPublicMediaAsset(value: string) {
  return (await getMediaStorageAdapter()).isManagedAsset(value);
}

export async function deletePublicMediaAsset(value: string) {
  return (await getMediaStorageAdapter()).deleteAsset(value);
}
