import "server-only";

import path from "path";

import { moveManagedStorageAsset } from "../../storage/upload-cms-asset";
import { getSupabaseAdmin } from "../../supabase-admin";
import {
  ensureCatalogFolderHierarchy,
  getCatalogAssetByIdentity,
  getMediaCatalogRuntimeState,
  listCatalogReferences,
  markCatalogAssetState,
} from "./catalog";
import { getCanonicalMediaIdentityKey, getFolderPathFromObjectKey, normalizeManagedObjectKey } from "./identity";
import {
  getMediaReferenceProvider,
  MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION,
  scanAllMediaReferenceProviders,
} from "./reference-providers";
import { rebindAllSupportedMediaReferences } from "./synchronization";
import type { MediaCatalogAsset } from "./types";

async function updateIdentity(assetId: string, input: { objectKey: string; publicUrl: string; folderPath: string }) {
  const { error } = await getSupabaseAdmin()
    .from("media_assets")
    .update({ object_key: input.objectKey, public_url: input.publicUrl, folder_path: input.folderPath })
    .eq("id", assetId);
  if (error) throw new Error(`media_catalog_identity_update_failed:${error.code ?? "unknown"}`);
}

export async function moveCatalogMediaAsset(
  asset: MediaCatalogAsset,
  input: { targetFolder: string; targetFilename?: string },
  actorId?: number | null,
) {
  if (asset.provider !== "supabase" || asset.status !== "active" || asset.missingObject) {
    throw new Error("media_physical_move_asset_unavailable");
  }
  const runtimeState = await getMediaCatalogRuntimeState();
  if (
    runtimeState.state !== "synced" ||
    runtimeState.providerRegistryVersion !== MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION
  ) {
    throw new Error("media_physical_move_catalog_uncertain");
  }
  const targetFilename = (input.targetFilename?.trim() || path.posix.basename(asset.objectKey))
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!targetFilename || path.posix.extname(targetFilename).toLowerCase() !== asset.extension.toLowerCase()) {
    throw new Error("media_physical_move_extension_mismatch");
  }
  const targetObjectKey = normalizeManagedObjectKey(`${input.targetFolder}/${targetFilename}`);
  const collision = await getCatalogAssetByIdentity({
    provider: "supabase",
    bucket: asset.bucket,
    objectKey: targetObjectKey,
  });
  if (collision && collision.id !== asset.id) throw new Error("media_physical_move_collision");

  const references = await listCatalogReferences(asset.id);
  const live = await scanAllMediaReferenceProviders();
  if (live.uncertainties.length) throw new Error(`media_physical_move_provider_uncertain:${live.uncertainties[0]}`);
  const identityKey = getCanonicalMediaIdentityKey(asset);
  const liveReferences = live.references.filter(
    (reference) => getCanonicalMediaIdentityKey(reference.identity) === identityKey,
  );
  const persistedKeys = new Set(references.map((reference) => `${reference.domainKey}:${reference.entityIdentity}:${reference.fieldKey}`));
  const liveKeys = new Set(liveReferences.map((reference) => `${reference.domainKey}:${reference.entityIdentity}:${reference.fieldKey}`));
  if (
    persistedKeys.size !== liveKeys.size ||
    [...persistedKeys].some((key) => !liveKeys.has(key))
  ) {
    throw new Error("media_physical_move_reference_drift");
  }
  const unsupported = references.filter((reference) => !getMediaReferenceProvider(reference.domainKey)?.supportsRebind);
  if (unsupported.length) throw new Error("media_physical_move_unsupported_references");

  const targetFolder = getFolderPathFromObjectKey(targetObjectKey);
  await ensureCatalogFolderHierarchy(targetFolder, actorId);
  const moved = await moveManagedStorageAsset(asset.publicUrl, targetObjectKey);
  let catalogMoved = false;
  try {
    await updateIdentity(asset.id, { objectKey: moved.objectKey, publicUrl: moved.publicUrl, folderPath: targetFolder });
    catalogMoved = true;
    const nextAsset: MediaCatalogAsset = {
      ...asset,
      objectKey: moved.objectKey,
      publicUrl: moved.publicUrl,
      folderPath: targetFolder,
    };
    const rebind = await rebindAllSupportedMediaReferences(asset, nextAsset);
    if (!rebind.ok) throw new Error(rebind.code);
    return { asset: nextAsset, rebind, previousObjectRetired: true };
  } catch (error) {
    const rollbackFailures: string[] = [];
    if (catalogMoved) {
      await updateIdentity(asset.id, {
        objectKey: asset.objectKey,
        publicUrl: asset.publicUrl,
        folderPath: asset.folderPath,
      }).catch(() => rollbackFailures.push("catalog_identity_rollback_failed"));
    }
    await moveManagedStorageAsset(moved.publicUrl, asset.objectKey).catch(() => rollbackFailures.push("storage_move_rollback_failed"));
    if (rollbackFailures.length) {
      await markCatalogAssetState(asset.id, { reconciliationState: "uncertain" }).catch(() => undefined);
      throw new Error(`media_physical_move_compensation_failed:${rollbackFailures.join(",")}`);
    }
    throw error;
  }
}
