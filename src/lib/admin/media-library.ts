import "server-only";

import { createSupabaseCmsMediaStorageAdapter } from "../storage/upload-cms-asset";
import {
  resolveMediaStorageProvider,
  shouldIncludeLocalFilesystemReadThrough,
  type MediaStorageAdapter,
  type MediaUploadOptions,
} from "./media-storage-adapter";
import type { MediaAssetItem, PublicMediaInventory } from "./media-library-paths";

export type { PublicMediaFolderListing } from "./media-library-paths";
export { normalizeMediaFolder } from "./media-library-paths";
export {
  getPublicMediaStorageError,
  MediaStorageError,
  resolveMediaStorageProvider,
  resolveMediaStorageRuntimeContext,
} from "./media-storage-adapter";

function mediaItemKey(item: MediaAssetItem) {
  return `${item.provider}:${item.bucket}:${item.storagePath ?? item.path}`;
}

function mergeMediaItems(...collections: MediaAssetItem[][]) {
  return [...new Map(collections.flat().map((item) => [mediaItemKey(item), item])).values()]
    .sort((left, right) => left.path.localeCompare(right.path));
}

export async function getManagedMediaStorageAdapter(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<MediaStorageAdapter> {
  if (resolveMediaStorageProvider(environment) !== "supabase") {
    throw new Error("managed_media_provider_must_be_supabase");
  }
  return createSupabaseCmsMediaStorageAdapter();
}

export async function listManagedMediaInventory(
  environment: NodeJS.ProcessEnv = process.env,
) {
  const inventory = await (await getManagedMediaStorageAdapter(environment)).listInventory();
  return {
    ...inventory,
    provider: "supabase" as const,
    providerAvailable: true,
    warning: null,
  } satisfies PublicMediaInventory;
}

export async function listPublicMediaInventory() {
  const environment = process.env;
  if (!shouldIncludeLocalFilesystemReadThrough(environment)) {
    return listManagedMediaInventory(environment);
  }

  const { createFilesystemMediaStorageAdapter } = await import("./media-library-fs");
  const local = await createFilesystemMediaStorageAdapter().listInventory();
  try {
    const managed = await listManagedMediaInventory(environment);
    return {
      provider: "supabase" as const,
      providerAvailable: true,
      warning: null,
      folders: [...new Set([...managed.folders, ...local.folders])].sort((left, right) => left.localeCompare(right)),
      items: mergeMediaItems(managed.items, local.items),
    } satisfies PublicMediaInventory;
  } catch {
    return {
      provider: "supabase" as const,
      providerAvailable: false,
      warning: "تعذر قراءة التخزين المُدار. الملفات المحلية ظاهرة للقراءة فقط، بينما أوقفت حالات الفهرسة والحذف حتى عودة الاتصال.",
      folders: local.folders,
      items: local.items,
    } satisfies PublicMediaInventory;
  }
}

export async function savePublicMediaUpload(
  folder: string,
  file: File,
  options?: MediaUploadOptions,
) {
  return (await getManagedMediaStorageAdapter()).uploadImage(folder, file, options);
}

export async function savePublicDocumentUpload(
  folder: string,
  file: File,
  options?: MediaUploadOptions,
) {
  return (await getManagedMediaStorageAdapter()).uploadDocument(folder, file, options);
}

export async function isManagedPublicMediaAsset(value: string) {
  return (await getManagedMediaStorageAdapter()).isManagedAsset(value);
}

export async function deletePublicMediaAsset(value: string) {
  return (await getManagedMediaStorageAdapter()).deleteAsset(value);
}
