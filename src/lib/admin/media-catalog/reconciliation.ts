import "server-only";

import path from "path";

import { listAllSupabaseManagedStorageAssets } from "../../storage/upload-cms-asset";
import { getSupabaseAdmin } from "../../supabase-admin";
import { ensureCatalogFolderHierarchy, getAllCatalogAssetIdentityMap } from "./catalog";
import { getCanonicalMediaIdentityKey } from "./identity";
import { reconcileAllMediaReferences } from "./synchronization";

export async function reconcileMediaCatalog(options: {
  dryRun?: boolean;
  actorId?: number | null;
} = {}) {
  const storage = await listAllSupabaseManagedStorageAssets();
  if (options.dryRun) {
    const referenceResult = await reconcileAllMediaReferences({ dryRun: true });
    return {
      storageAssetCount: storage.assets.length,
      folderCount: storage.folders.length,
      ...referenceResult,
    };
  }

  for (const folder of storage.folders) {
    await ensureCatalogFolderHierarchy(folder, options.actorId);
  }

  const supabase = getSupabaseAdmin();
  for (const asset of storage.assets) {
    const { error } = await supabase.from("media_assets").upsert(
      {
        provider: asset.provider,
        bucket: asset.bucket,
        object_key: asset.objectKey,
        public_url: asset.publicUrl,
        original_filename: asset.filename,
        display_name: asset.filename,
        media_kind: asset.kind,
        mime_type: asset.contentType,
        extension: path.posix.extname(asset.filename).toLowerCase(),
        byte_size: asset.sizeBytes,
        folder_path: asset.folderPath,
        status: "active",
        reconciliation_state: "synced",
        missing_object: false,
        created_at: asset.uploadedAt ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider,bucket,object_key" },
    );
    if (error) throw new Error(`media_catalog_asset_upsert_failed:${error.code ?? "unknown"}`);
  }

  const catalogMap = await getAllCatalogAssetIdentityMap();
  const storageKeys = new Set(
    storage.assets.map((asset) => getCanonicalMediaIdentityKey(asset)),
  );
  let missingObjectCount = 0;
  for (const asset of catalogMap.values()) {
    if (storageKeys.has(getCanonicalMediaIdentityKey(asset))) continue;
    missingObjectCount += 1;
    const { error } = await supabase
      .from("media_assets")
      .update({
        status: "missing",
        missing_object: true,
        reconciliation_state: "missing_object",
      })
      .eq("id", asset.id);
    if (error) throw new Error(`media_catalog_missing_mark_failed:${error.code ?? "unknown"}`);
  }

  const referenceResult = await reconcileAllMediaReferences();
  return {
    storageAssetCount: storage.assets.length,
    folderCount: storage.folders.length,
    missingObjectCount,
    ...referenceResult,
  };
}
