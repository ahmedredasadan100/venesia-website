import "server-only";

import { createSupabaseCmsMediaStorageAdapter } from "../storage/upload-cms-asset";
import {
  resolveMediaStorageProvider,
  shouldIncludeLocalFilesystemReadThrough,
  type MediaStorageAdapter,
  type MediaUploadOptions,
} from "./media-storage-adapter";
import type {
  MediaAssetItem,
  PublicMediaFolderListing,
  PublicMediaInventory,
} from "./media-library-paths";

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

function mergeFolderListings(
  managed: PublicMediaFolderListing,
  local: PublicMediaFolderListing,
): PublicMediaFolderListing {
  return {
    folder: managed.folder,
    parentFolder: managed.parentFolder,
    subfolders: [...new Set([...managed.subfolders, ...local.subfolders])].sort((left, right) => left.localeCompare(right)),
    images: [...new Set([...managed.images, ...local.images])].sort((left, right) => left.localeCompare(right)),
    documents: [...new Set([...managed.documents, ...local.documents])].sort((left, right) => left.localeCompare(right)),
    items: mergeMediaItems(managed.items, local.items),
  };
}

export async function getManagedMediaStorageAdapter(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<MediaStorageAdapter> {
  if (resolveMediaStorageProvider(environment) !== "supabase") {
    throw new Error("managed_media_provider_must_be_supabase");
  }
  return createSupabaseCmsMediaStorageAdapter();
}

export async function getMediaStorageAdapter(
  environment: NodeJS.ProcessEnv = process.env,
) {
  return getManagedMediaStorageAdapter(environment);
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

export async function listPublicMediaFolder(folder = "images") {
  const environment = process.env;
  const managedAdapter = await getManagedMediaStorageAdapter(environment);
  if (!shouldIncludeLocalFilesystemReadThrough(environment)) {
    return managedAdapter.listFolder(folder);
  }

  const { createFilesystemMediaStorageAdapter } = await import("./media-library-fs");
  const localAdapter = createFilesystemMediaStorageAdapter();
  const local = await localAdapter.listFolder(folder);
  try {
    return mergeFolderListings(await managedAdapter.listFolder(folder), local);
  } catch {
    return local;
  }
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

export async function listPublicImagePaths(folder = "images", limit = 240) {
  const environment = process.env;
  const managedAdapter = await getManagedMediaStorageAdapter(environment);
  if (!shouldIncludeLocalFilesystemReadThrough(environment)) {
    return managedAdapter.listImagePaths(folder, limit);
  }

  const { createFilesystemMediaStorageAdapter } = await import("./media-library-fs");
  const local = await createFilesystemMediaStorageAdapter().listImagePaths(folder, limit);
  try {
    const managed = await managedAdapter.listImagePaths(folder, limit);
    return [...new Set([...managed, ...local])].sort((left, right) => left.localeCompare(right)).slice(0, limit);
  } catch {
    return local;
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
