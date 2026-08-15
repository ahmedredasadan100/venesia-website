import "server-only";

import path from "path";

import {
  moveManagedStorageAsset,
  verifyManagedStorageAssetExists,
} from "../../storage/upload-cms-asset";
import { getSupabaseAdmin } from "../../supabase-admin";
import { resolveMediaStorageRuntimeContext } from "../media-storage-adapter";
import {
  ensureCatalogFolderHierarchy,
  getCatalogAssetByIdentity,
  getMediaCatalogRuntimeState,
  listCatalogReferences,
  markCatalogAssetState,
} from "./catalog";
import {
  getCanonicalMediaIdentityKey,
  getFolderPathFromObjectKey,
  normalizeManagedObjectKey,
} from "./identity";
import {
  getMediaReferenceProvider,
  MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION,
  scanAllMediaReferenceProviders,
  type DiscoveredMediaReference,
} from "./reference-providers";
import { rebindAllSupportedMediaReferences } from "./synchronization";
import type { MediaCatalogAsset } from "./types";
import {
  acquireMediaReferenceWriteLease,
  completeMediaReferenceWriteLease,
  failMediaReferenceWriteLease,
  type MediaReferenceWriteScope,
} from "./write-lease";

const PHYSICAL_MOVE_COORDINATION_DOMAIN = "media_catalog_physical_move";
const PHYSICAL_MOVE_COORDINATION_ENTITY = "media_asset";

type CatalogIdentitySnapshot = {
  provider: string;
  bucket: string;
  objectKey: string;
  publicUrl: string;
  reconciliationState: string;
  missingObject: boolean;
};

function rpcReason(error: { code?: string | null; message?: string | null } | null, fallback: string) {
  return error?.message || error?.code || fallback;
}

function buildMovedPublicUrl(asset: MediaCatalogAsset, targetObjectKey: string) {
  const url = new URL(asset.publicUrl);
  const marker = `/storage/v1/object/public/${asset.bucket}/`;
  const decodedPath = decodeURIComponent(url.pathname);
  const markerIndex = decodedPath.indexOf(marker);
  if (markerIndex < 0) throw new Error("media_physical_move_public_url_unproven");
  const encodedObjectKey = targetObjectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  url.pathname = `${decodedPath.slice(0, markerIndex)}${marker}${encodedObjectKey}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function readCatalogIdentity(assetId: string): Promise<CatalogIdentitySnapshot | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("media_assets")
    .select("provider,bucket,object_key,public_url,reconciliation_state,missing_object")
    .eq("id", assetId)
    .maybeSingle();
  if (error) throw new Error(`media_physical_move_catalog_read_failed:${error.code ?? "unknown"}`);
  if (!data) return null;
  return {
    provider: data.provider,
    bucket: data.bucket,
    objectKey: data.object_key,
    publicUrl: data.public_url,
    reconciliationState: data.reconciliation_state,
    missingObject: data.missing_object,
  };
}

function identityMatches(
  observed: CatalogIdentitySnapshot | null,
  expected: Pick<MediaCatalogAsset, "provider" | "bucket" | "objectKey" | "publicUrl">,
) {
  return Boolean(
    observed &&
      observed.provider === expected.provider &&
      observed.bucket === expected.bucket &&
      observed.objectKey === expected.objectKey &&
      observed.publicUrl === expected.publicUrl,
  );
}

function physicalMoveFailureMetadata(input: {
  previous: MediaCatalogAsset;
  next: Pick<MediaCatalogAsset, "provider" | "bucket" | "objectKey" | "publicUrl">;
  storageState: "previous" | "next" | "unknown";
  catalogState: "previous" | "next" | "unknown";
}) {
  return {
    operation: "physical_move",
    previousIdentity: {
      provider: input.previous.provider,
      bucket: input.previous.bucket,
      objectKey: input.previous.objectKey,
      publicUrl: input.previous.publicUrl,
    },
    nextIdentity: input.next,
    storageState: input.storageState,
    catalogState: input.catalogState,
  };
}

function buildPhysicalMoveCoordination(
  asset: MediaCatalogAsset,
  persisted: Awaited<ReturnType<typeof listCatalogReferences>>,
  liveReferences: readonly DiscoveredMediaReference[],
) {
  const entityGroups = new Map<string, DiscoveredMediaReference[]>();
  for (const reference of liveReferences) {
    const key = `${reference.domainKey}\u0000${reference.entityType}\u0000${reference.entityIdentity}`;
    entityGroups.set(key, [...(entityGroups.get(key) ?? []), reference]);
  }
  const affectedEntityKeys = new Set(
    persisted.map(
      (reference) =>
        `${reference.domainKey}\u0000${reference.entityType}\u0000${reference.entityIdentity}`,
    ),
  );
  const scopes: MediaReferenceWriteScope[] = [...affectedEntityKeys].map((key) => {
    const [domainKey, entityType, entityIdentity] = key.split("\u0000");
    return {
      domainKey,
      entityType,
      entityIdentity,
      values: (entityGroups.get(key) ?? []).map((reference) => reference.publicValue),
    };
  });
  const synchronizationTargets = scopes.map((scope) => ({
    domainKey: scope.domainKey,
    entityIdentity: scope.entityIdentity,
    leaseEntityIdentity: scope.entityIdentity,
  }));
  scopes.push({
    domainKey: PHYSICAL_MOVE_COORDINATION_DOMAIN,
    entityType: PHYSICAL_MOVE_COORDINATION_ENTITY,
    entityIdentity: asset.id,
    values: [asset.publicUrl],
  });
  return { scopes, synchronizationTargets };
}

async function proveStorageMoveState(previousPublicUrl: string, nextPublicUrl: string) {
  const [previous, next] = await Promise.all([
    verifyManagedStorageAssetExists(previousPublicUrl),
    verifyManagedStorageAssetExists(nextPublicUrl),
  ]);
  if (!previous.managed || !next.managed) return "unknown" as const;
  if (previous.exists && !next.exists) return "previous" as const;
  if (!previous.exists && next.exists) return "next" as const;
  return "unknown" as const;
}

async function transitionCatalogIdentity(input: {
  previous: MediaCatalogAsset;
  next: Pick<MediaCatalogAsset, "provider" | "bucket" | "objectKey" | "publicUrl" | "folderPath">;
  leaseToken: string;
}) {
  const { error } = await getSupabaseAdmin().rpc("transition_media_asset_identity_for_move", {
    p_asset_id: input.previous.id,
    p_lease_token: input.leaseToken,
    p_expected_provider: input.previous.provider,
    p_expected_bucket: input.previous.bucket,
    p_expected_object_key: input.previous.objectKey,
    p_expected_public_url: input.previous.publicUrl,
    p_next_bucket: input.next.bucket,
    p_next_object_key: input.next.objectKey,
    p_next_public_url: input.next.publicUrl,
    p_next_folder_path: input.next.folderPath,
  });
  if (!error) return { state: "next" as const, reason: null };

  try {
    const observed = await readCatalogIdentity(input.previous.id);
    if (identityMatches(observed, input.next)) {
      return { state: "next" as const, reason: rpcReason(error, "media_physical_move_transition_response_lost") };
    }
    if (identityMatches(observed, input.previous)) {
      return { state: "previous" as const, reason: rpcReason(error, "media_physical_move_transition_failed") };
    }
  } catch {}
  return { state: "unknown" as const, reason: rpcReason(error, "media_physical_move_transition_unproven") };
}

async function rollbackCatalogIdentity(input: {
  previous: MediaCatalogAsset;
  next: Pick<MediaCatalogAsset, "provider" | "bucket" | "objectKey" | "publicUrl">;
  leaseToken: string;
}) {
  const { error } = await getSupabaseAdmin().rpc("rollback_media_asset_identity_move", {
    p_asset_id: input.previous.id,
    p_lease_token: input.leaseToken,
    p_expected_provider: input.next.provider,
    p_expected_bucket: input.next.bucket,
    p_expected_object_key: input.next.objectKey,
    p_expected_public_url: input.next.publicUrl,
    p_restore_bucket: input.previous.bucket,
    p_restore_object_key: input.previous.objectKey,
    p_restore_public_url: input.previous.publicUrl,
    p_restore_folder_path: input.previous.folderPath,
    p_restore_reconciliation_state: input.previous.reconciliationState,
    p_restore_missing_object: input.previous.missingObject,
  });
  if (!error) return true;
  try {
    return identityMatches(await readCatalogIdentity(input.previous.id), input.previous);
  } catch {
    return false;
  }
}

async function finalizeCatalogIdentity(input: {
  assetId: string;
  next: Pick<MediaCatalogAsset, "provider" | "bucket" | "objectKey" | "publicUrl">;
  leaseToken: string;
}) {
  const { error } = await getSupabaseAdmin().rpc("finalize_media_asset_identity_move", {
    p_asset_id: input.assetId,
    p_lease_token: input.leaseToken,
    p_expected_provider: input.next.provider,
    p_expected_bucket: input.next.bucket,
    p_expected_object_key: input.next.objectKey,
    p_expected_public_url: input.next.publicUrl,
  });
  if (!error) return true;
  try {
    const observed = await readCatalogIdentity(input.assetId);
    return identityMatches(observed, input.next) && observed?.reconciliationState === "synced";
  } catch {
    return false;
  }
}

export async function moveCatalogMediaAsset(
  asset: MediaCatalogAsset,
  input: { targetFolder: string; targetFilename?: string },
  actorId?: number | null,
) {
  if (
    asset.provider !== "supabase" ||
    asset.status !== "active" ||
    asset.missingObject ||
    asset.reconciliationState !== "synced"
  ) {
    throw new Error("media_physical_move_asset_unavailable");
  }
  const runtimeState = await getMediaCatalogRuntimeState();
  const context = resolveMediaStorageRuntimeContext();
  if (
    runtimeState.state !== "synced" ||
    runtimeState.providerRegistryVersion !== MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION ||
    !context.identity ||
    runtimeState.environmentKey !== context.identity ||
    runtimeState.provider !== context.provider ||
    runtimeState.environment !== context.environment
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
  const expectedNext = {
    provider: "supabase" as const,
    bucket: asset.bucket,
    objectKey: targetObjectKey,
    publicUrl: buildMovedPublicUrl(asset, targetObjectKey),
    folderPath: targetFolder,
  };
  const coordination = buildPhysicalMoveCoordination(asset, references, live.references);
  await ensureCatalogFolderHierarchy(targetFolder, actorId);
  const moveLease = await acquireMediaReferenceWriteLease({
    scopes: coordination.scopes,
    actorId,
    requestIdentity: `media-physical-move:${asset.id}`,
  });
  if (!moveLease) throw new Error("media_physical_move_write_lease_missing");

  let storageState: "previous" | "next" | "unknown" = "previous";
  let catalogState: "previous" | "next" | "unknown" = "previous";
  let moveLeaseSettled = false;
  let retainMovedIdentity = false;
  let moved = expectedNext;
  try {
    try {
      const storageMove = await moveManagedStorageAsset(asset.publicUrl, targetObjectKey);
      moved = { ...storageMove, folderPath: targetFolder };
      storageState = "next";
    } catch (storageError) {
      storageState = await proveStorageMoveState(asset.publicUrl, expectedNext.publicUrl).catch(() => "unknown" as const);
      if (storageState === "next") {
        moved = expectedNext;
      } else if (storageState === "unknown") {
        retainMovedIdentity = true;
        throw new Error(`media_physical_move_storage_state_unproven:${storageError instanceof Error ? storageError.message : "unknown"}`);
      } else {
        throw storageError;
      }
    }

    const transition = await transitionCatalogIdentity({
      previous: asset,
      next: moved,
      leaseToken: moveLease.token,
    });
    catalogState = transition.state;
    if (catalogState === "unknown") {
      retainMovedIdentity = true;
      throw new Error(`media_physical_move_catalog_state_unproven:${transition.reason}`);
    }
    if (catalogState === "previous") {
      throw new Error(`media_physical_move_catalog_transition_failed:${transition.reason}`);
    }

    const nextAsset: MediaCatalogAsset = {
      ...asset,
      objectKey: moved.objectKey,
      publicUrl: moved.publicUrl,
      folderPath: targetFolder,
      reconciliationState: "uncertain",
    };
    const rebind = await rebindAllSupportedMediaReferences(asset, nextAsset, {
      actorId,
      requestIdentity: `media-physical-move:${asset.id}`,
      externalLease: moveLease,
      synchronizationTargets: coordination.synchronizationTargets,
    });
    if (!rebind.ok) {
      retainMovedIdentity = rebind.nextAssetRequired;
      if (retainMovedIdentity) {
        throw new Error(`media_physical_move_rebind_recovery_required:${rebind.code}`);
      }
      throw new Error(rebind.code);
    }

    retainMovedIdentity = true;
    const catalogFinalized = await finalizeCatalogIdentity({
      assetId: asset.id,
      next: moved,
      leaseToken: moveLease.token,
    });
    if (!catalogFinalized) throw new Error("media_physical_move_catalog_finalization_unproven");
    await completeMediaReferenceWriteLease(moveLease, asset.id);
    moveLeaseSettled = true;

    return {
      asset: { ...nextAsset, reconciliationState: "synced" as const },
      rebind,
      previousObjectRetired: true,
    };
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : "media_physical_move_failed";
    const recoveryFailures: string[] = [];

    if (retainMovedIdentity) {
      if (!moveLeaseSettled) {
        await failMediaReferenceWriteLease({
          lease: moveLease,
          entityIdentity: asset.id,
          failureCode: "media_physical_move_recovery_required",
          reasons: [failureReason],
          domainWriteCommitted: true,
          metadata: physicalMoveFailureMetadata({
            previous: asset,
            next: moved,
            storageState,
            catalogState,
          }),
        }).catch((leaseError) => {
          recoveryFailures.push(`media_physical_move_lease_failure_record_failed:${leaseError instanceof Error ? leaseError.message : "unknown"}`);
        });
      }
      await markCatalogAssetState(asset.id, { reconciliationState: "uncertain" }).catch(() => {
        recoveryFailures.push("media_physical_move_uncertain_state_record_failed");
      });
      throw new Error(
        recoveryFailures.length
          ? `media_physical_move_recovery_record_failed:${[failureReason, ...recoveryFailures].join(",")}`
          : failureReason,
      );
    }

    const rollbackFailures: string[] = [];
    if (storageState === "next") {
      try {
        await moveManagedStorageAsset(moved.publicUrl, asset.objectKey);
        storageState = "previous";
      } catch {
        storageState = await proveStorageMoveState(asset.publicUrl, moved.publicUrl).catch(() => "unknown" as const);
        if (storageState !== "previous") rollbackFailures.push("storage_move_rollback_failed");
      }
    }

    if (catalogState === "next" && storageState === "previous") {
      const catalogRolledBack = await rollbackCatalogIdentity({
        previous: asset,
        next: moved,
        leaseToken: moveLease.token,
      });
      if (catalogRolledBack) catalogState = "previous";
      else rollbackFailures.push("catalog_identity_rollback_failed");
    }

    await failMediaReferenceWriteLease({
      lease: moveLease,
      entityIdentity: asset.id,
      failureCode: "media_physical_move_failed",
      reasons: [failureReason, ...rollbackFailures],
      domainWriteCommitted: rollbackFailures.length > 0,
      metadata: physicalMoveFailureMetadata({
        previous: asset,
        next: moved,
        storageState,
        catalogState,
      }),
    }).catch((leaseError) => {
      rollbackFailures.push(`media_physical_move_lease_failure_record_failed:${leaseError instanceof Error ? leaseError.message : "unknown"}`);
    });

    if (rollbackFailures.length) {
      await markCatalogAssetState(asset.id, { reconciliationState: "uncertain" }).catch(() => undefined);
      throw new Error(`media_physical_move_compensation_failed:${rollbackFailures.join(",")}`);
    }
    throw error;
  }
}
