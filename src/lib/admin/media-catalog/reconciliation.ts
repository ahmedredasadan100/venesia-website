import "server-only";

import path from "path";

import { getSupabaseAdmin } from "../../supabase-admin";
import {
  listManagedMediaInventory,
  resolveMediaStorageRuntimeContext,
} from "../media-library";
import { MediaStorageError } from "../media-storage-adapter";
import type { MediaAssetItem } from "../media-library-paths";
import {
  ensureCatalogFolderHierarchy,
  getAllCatalogAssetIdentityMap,
  getMediaCatalogRuntimeState,
  setMediaCatalogRuntimeState,
} from "./catalog";
import { getCanonicalMediaIdentityKey } from "./identity";
import { MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION } from "./reference-providers";
import { reconcileAllMediaReferences } from "./synchronization";
import type { MediaCatalogAsset, MediaCatalogRuntimeState } from "./types";

function managedStorageIdentity(item: MediaAssetItem) {
  if (!item.storagePath) throw new Error("managed_storage_asset_identity_missing");
  return getCanonicalMediaIdentityKey({
    provider: "supabase",
    bucket: item.bucket,
    objectKey: item.storagePath,
  });
}

function simulatedCatalogAsset(item: MediaAssetItem): MediaCatalogAsset {
  const objectKey = item.storagePath!;
  const now = item.uploadedAt ?? "";
  return {
    id: `dry-run:${managedStorageIdentity(item)}`,
    provider: "supabase",
    bucket: item.bucket,
    objectKey,
    publicUrl: item.path,
    originalFilename: item.filename,
    displayName: item.filename,
    kind: item.kind,
    mimeType: item.contentType,
    extension: item.extension,
    sizeBytes: item.sizeBytes,
    width: null,
    height: null,
    checksum: null,
    folderPath: path.posix.dirname(objectKey),
    status: "active",
    uploadedBy: null,
    defaultAltText: null,
    defaultTitle: null,
    defaultCaption: null,
    reconciliationState: "synced",
    missingObject: false,
    catalogRegistered: true,
    source: "catalog_storage",
    createdAt: now,
    updatedAt: now,
    referenceCount: 0,
  };
}

function defaultRuntimeState(): MediaCatalogRuntimeState {
  const context = resolveMediaStorageRuntimeContext();
  return {
    state: "uncertain",
    provider: context.provider,
    environment: context.environment,
    environmentKey: context.identity,
    providerRegistryVersion: MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION,
    lastScanAt: null,
    lastCatalogSync: null,
    lastDryRun: null,
    lastSuccessfulReconciliationRunIdentity: null,
    lastSuccessfulReconciliationAt: null,
    storageAssetCount: null,
    catalogAssetCount: null,
    warnings: [],
  };
}

async function currentRuntimeState() {
  try {
    return await getMediaCatalogRuntimeState();
  } catch {
    return defaultRuntimeState();
  }
}

export async function reconcileMediaCatalog(options: {
  dryRun?: boolean;
  actorId?: number | null;
} = {}) {
  const context = resolveMediaStorageRuntimeContext();
  if (!context.identity) {
    throw new MediaStorageError(
      "media_storage_context_unproven",
      "تعذر إثبات هوية مشروع التخزين المتصل؛ تم إيقاف الفحص والمزامنة حفاظًا على دقة النتائج.",
      503,
    );
  }

  const storage = await listManagedMediaInventory();
  const storageAssets = storage.items.filter(
    (item) => item.managed && item.provider === context.provider && Boolean(item.storagePath),
  );
  const storageKeys = new Set(storageAssets.map(managedStorageIdentity));
  const catalogMapBefore = await getAllCatalogAssetIdentityMap();
  const currentProviderCatalogBefore = [...catalogMapBefore.values()].filter(
    (asset) => asset.provider === context.provider,
  );
  const toRegisterCount = storageAssets.filter(
    (item) => !catalogMapBefore.has(managedStorageIdentity(item)),
  ).length;
  const missingObjectCount = currentProviderCatalogBefore.filter(
    (asset) => !storageKeys.has(getCanonicalMediaIdentityKey(asset)),
  ).length;

  if (options.dryRun) {
    const simulatedMap = new Map(catalogMapBefore);
    for (const item of storageAssets) {
      const key = managedStorageIdentity(item);
      if (!simulatedMap.has(key)) simulatedMap.set(key, simulatedCatalogAsset(item));
    }
    const referenceResult = await reconcileAllMediaReferences({
      dryRun: true,
      assetMap: simulatedMap,
    });
    const previewReliable =
      referenceResult.scannedProviderCount === referenceResult.providerCount;
    return {
      ...referenceResult,
      dryRun: true as const,
      previewReliable,
      context,
      storageAssetCount: storageAssets.length,
      catalogAssetCount: currentProviderCatalogBefore.length,
      folderCount: storage.folders.length,
      toRegisterCount,
      missingObjectCount,
      complete:
        previewReliable &&
        referenceResult.complete &&
        missingObjectCount === 0,
      generatedAt: new Date().toISOString(),
    };
  }

  const previousState = await currentRuntimeState();
  const runIdentity = crypto.randomUUID();
  const scanStartedAt = new Date().toISOString();
  await setMediaCatalogRuntimeState({
    ...previousState,
    state: "uncertain",
    provider: context.provider,
    environment: context.environment,
    environmentKey: context.identity,
    providerRegistryVersion: MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION,
    lastScanAt: scanStartedAt,
    storageAssetCount: storageAssets.length,
    catalogAssetCount: currentProviderCatalogBefore.length,
    warnings: ["reconciliation_in_progress"],
  });

  try {
    for (const folder of storage.folders) {
      await ensureCatalogFolderHierarchy(folder, options.actorId);
    }

    const supabase = getSupabaseAdmin();
    const catalogBeforeByIdentity = new Map(
      currentProviderCatalogBefore.map((asset) => [getCanonicalMediaIdentityKey(asset), asset]),
    );
    for (const item of storageAssets) {
      const objectKey = item.storagePath!;
      const nextAsset = {
        provider: context.provider,
        bucket: item.bucket,
        object_key: objectKey,
        public_url: item.path,
        original_filename: item.filename,
        display_name: item.filename,
        media_kind: item.kind,
        mime_type: item.contentType,
        extension: item.extension,
        byte_size: item.sizeBytes,
        folder_path: path.posix.dirname(objectKey),
        reconciliation_state: "synced",
        missing_object: false,
        updated_at: new Date().toISOString(),
      };
      const existing = catalogBeforeByIdentity.get(
        getCanonicalMediaIdentityKey({
          provider: context.provider,
          bucket: item.bucket,
          objectKey,
        }),
      );
      const result = existing
        ? await supabase
            .from("media_assets")
            .update(nextAsset)
            .eq("id", existing.id)
            .eq("status", "active")
            .select("id")
            .maybeSingle()
        : await supabase
            .from("media_assets")
            .insert({
              ...nextAsset,
              status: "active",
              created_at: item.uploadedAt ?? new Date().toISOString(),
            })
            .select("id")
            .single();
      if (result.error || !result.data) {
        throw new Error(`media_catalog_asset_upsert_failed:${result.error?.code ?? "coordination_conflict"}`);
      }
    }

    for (const asset of currentProviderCatalogBefore) {
      if (storageKeys.has(getCanonicalMediaIdentityKey(asset))) continue;
      const { data, error } = await supabase
        .from("media_assets")
        .update({
          status: "missing",
          missing_object: true,
          reconciliation_state: "missing_object",
        })
        .eq("id", asset.id)
        .eq("status", "active")
        .select("id")
        .maybeSingle();
      if (error || !data) {
        throw new Error(`media_catalog_missing_mark_failed:${error?.code ?? "coordination_conflict"}`);
      }
    }

    const catalogMapAfter = await getAllCatalogAssetIdentityMap();
    const referenceResult = await reconcileAllMediaReferences({
      assetMap: catalogMapAfter,
      runIdentity,
    });
    const uncertainties = [...referenceResult.uncertainties];
    if (missingObjectCount) {
      uncertainties.push(`catalog_missing_objects:${missingObjectCount}`);
    }
    const finalState = uncertainties.length ? "uncertain" : "synced";
    const { error: assetStateError } = await supabase
      .from("media_assets")
      .update({ reconciliation_state: finalState })
      .eq("provider", context.provider)
      .neq("status", "deleted")
      .eq("missing_object", false);
    if (assetStateError) {
      uncertainties.push(
        `asset_reconciliation_state_failed:${assetStateError.code ?? "unknown"}`,
      );
    }

    const completed = uncertainties.length === 0;
    const completedAt = new Date().toISOString();
    const currentProviderCatalogAfter = [...catalogMapAfter.values()].filter(
      (asset) => asset.provider === context.provider,
    );
    await setMediaCatalogRuntimeState({
      state: completed ? "synced" : "uncertain",
      provider: context.provider,
      environment: context.environment,
      environmentKey: context.identity,
      providerRegistryVersion: MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION,
      lastScanAt: completedAt,
      lastCatalogSync: completed ? completedAt : previousState.lastCatalogSync,
      lastDryRun: previousState.lastDryRun,
      lastSuccessfulReconciliationRunIdentity: completed
        ? runIdentity
        : previousState.lastSuccessfulReconciliationRunIdentity,
      lastSuccessfulReconciliationAt: completed
        ? completedAt
        : previousState.lastSuccessfulReconciliationAt,
      storageAssetCount: storageAssets.length,
      catalogAssetCount: currentProviderCatalogAfter.length,
      warnings: [...new Set(uncertainties)].slice(-30),
    });

    return {
      ...referenceResult,
      dryRun: false as const,
      previewReliable: true,
      context,
      storageAssetCount: storageAssets.length,
      catalogAssetCount: currentProviderCatalogAfter.length,
      folderCount: storage.folders.length,
      toRegisterCount,
      missingObjectCount,
      uncertainties: [...new Set(uncertainties)],
      complete: completed,
      reconciliationRunIdentity: completed ? runIdentity : null,
      generatedAt: completedAt,
    };
  } catch (error) {
    const warning = error instanceof Error ? error.message : "media_reconciliation_failed";
    await setMediaCatalogRuntimeState({
      ...previousState,
      state: "uncertain",
      provider: context.provider,
      environment: context.environment,
      environmentKey: context.identity,
      providerRegistryVersion: MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION,
      lastScanAt: new Date().toISOString(),
      storageAssetCount: storageAssets.length,
      catalogAssetCount: currentProviderCatalogBefore.length,
      warnings: [warning],
    }).catch(() => undefined);
    throw error;
  }
}
