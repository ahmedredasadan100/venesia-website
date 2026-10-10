import "server-only";

import path from "path";

import {
  copyManagedStorageAsset,
  createSupabaseCmsMediaStorageAdapter,
  verifyManagedStorageAssetExists,
} from "../../storage/upload-cms-asset";
import { expirePublicCacheTags, PUBLIC_CACHE_TAG_GROUPS } from "../../cache/revalidate-public-cache-tags";
import { isCmsUploadFolderCompatible } from "../media-intelligence/cms-upload-policy";
import { normalizeMediaFolder } from "../media-library-paths";
import { MediaStorageError } from "../media-storage-adapter";
import { getSupabaseAdmin } from "../../supabase-admin";
import { resolveMediaStorageRuntimeContext } from "../media-storage-adapter";
import {
  listMediaCatalogSnapshot,
  getCatalogAssetByIdentity,
  getCatalogAssetById,
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
import type { Json } from "../../database.types";
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
  storageState: "previous" | "next" | "both" | "unknown";
  catalogState: "previous" | "next" | "both" | "unknown";
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
  if (previous.exists && next.exists) return "both" as const;
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
  const { targetFilename, targetObjectKey } = validateMediaRelocationTarget(asset, input);
  const catalog = await listMediaCatalogSnapshot();
  if (!catalog.folders.some(folder => folder.path === input.targetFolder)) {
    throw new MediaStorageError("media_move_folder_missing", "اختر مجلد صور موجودًا من المكتبة.", 400);
  }
  const collision = await getCatalogAssetByIdentity({
    provider: "supabase",
    bucket: asset.bucket,
    objectKey: targetObjectKey,
  });
  if (collision && collision.id !== asset.id) throw new MediaStorageError("media_physical_move_collision", "يوجد أصل مسجل بنفس اسم ومسار الوجهة.", 409);

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
  if (unsupported.length) throw new MediaStorageError("UNSUPPORTED_REFERENCE_OWNER", "لا يملك أحد مواضع الاستخدام تحديثًا آمنًا للمراجع؛ لم يتم النقل.", 409);

  const targetFolder = getFolderPathFromObjectKey(targetObjectKey);
  const expectedNext = {
    provider: "supabase" as const,
    bucket: asset.bucket,
    objectKey: targetObjectKey,
    publicUrl: buildMovedPublicUrl(asset, targetObjectKey),
    folderPath: targetFolder,
  };
  const coordination = buildPhysicalMoveCoordination(asset, references, live.references);

  const moveLease = await acquireMediaReferenceWriteLease({
    scopes: coordination.scopes,
    actorId,
    requestIdentity: `media-physical-move:${asset.id}`,
    ttlSeconds: 600,
  });
  if (!moveLease) throw new Error("media_physical_move_write_lease_missing");

  let storageState: "previous" | "next" | "both" | "unknown" = "previous";
  let catalogState: "previous" | "next" | "unknown" = "previous";
  let moveLeaseSettled = false;
  let retainMovedIdentity = false;
  let moved = expectedNext;
  const plan = { copyConfirmed: false, operation: "physical_move", previousAsset: asset, nextIdentity: expectedNext, referenceKeys: references.map(ref => [ref.domainKey, ref.entityIdentity, ref.fieldKey]) };
  try {
    // Persist intent BEFORE touching Storage, using the existing recovery ledger.
    const journal = await getSupabaseAdmin().rpc("record_media_relocation_journal", { p_lease_token: moveLease.token, p_plan: plan });
    if (journal.error || Number(journal.data) !== moveLease.assetCount) throw new Error("media_physical_move_intent_unproven");
    try {
      const storageMove = await copyManagedStorageAsset(asset.publicUrl, targetObjectKey);
      moved = { ...storageMove, folderPath: targetFolder };
      storageState = "both";
      plan.copyConfirmed = true;
      const copiedJournal = await getSupabaseAdmin().rpc("record_media_relocation_journal", { p_lease_token: moveLease.token, p_plan: plan });
      if (copiedJournal.error || Number(copiedJournal.data) !== moveLease.assetCount) throw new Error("media_physical_move_copy_receipt_unproven");
    } catch (storageError) {
      storageState = await proveStorageMoveState(asset.publicUrl, expectedNext.publicUrl).catch(() => "unknown" as const);
      if (storageState === "both" || storageState === "unknown") {
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
    // Both locations remain readable until every owned reference and cache is current.
    const proof = await scanAllMediaReferenceProviders();
    if (proof.uncertainties.length || proof.references.some(ref => getCanonicalMediaIdentityKey(ref.identity) === identityKey)) {
      throw new Error("media_physical_move_old_references_remain");
    }
    await expirePublicCacheTags(Object.values(PUBLIC_CACHE_TAG_GROUPS).flat());
    await createSupabaseCmsMediaStorageAdapter().deleteAsset(asset.publicUrl);
    storageState = await proveStorageMoveState(asset.publicUrl, moved.publicUrl);
    if (storageState !== "next") throw new Error("media_physical_move_retirement_unproven");
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
      operation: targetFolder === asset.folderPath ? "rename" : targetFilename === path.posix.basename(asset.objectKey) ? "move" : "move+rename",
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
          metadata: { ...plan, ...physicalMoveFailureMetadata({
            previous: asset,
            next: moved,
            storageState,
            catalogState,
          }) },
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
    if (storageState === "both") {
      try {
        await createSupabaseCmsMediaStorageAdapter().deleteAsset(moved.publicUrl);
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
      metadata: { ...plan, ...physicalMoveFailureMetadata({
        previous: asset,
        next: moved,
        storageState,
        catalogState,
      }) },
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

export function validateMediaRelocationTarget(asset: MediaCatalogAsset, input: { targetFolder: string; targetFilename?: string }) {
  if (asset.kind !== "image") throw new MediaStorageError("media_move_image_required", "النقل وإعادة التسمية متاحان للصور فقط.", 400);
  const folder = normalizeMediaFolder(input.targetFolder);
  if (folder !== input.targetFolder || !isCmsUploadFolderCompatible(folder, "image")) throw new MediaStorageError("media_move_incompatible_folder", "مجلد الوجهة غير متوافق مع الصور.", 400);
  const targetFilename = input.targetFilename === undefined ? path.posix.basename(asset.objectKey) : input.targetFilename;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,179}$/.test(targetFilename) || targetFilename.includes("..")) throw new MediaStorageError("media_move_invalid_filename", "اسم الملف غير صالح؛ استخدم حروفًا وأرقامًا وشرطة مع الامتداد الحالي.", 400);
  if (path.posix.extname(targetFilename).toLowerCase() !== asset.extension.toLowerCase()) throw new MediaStorageError("media_move_extension_mismatch", "لا يمكن تغيير امتداد الصورة.", 400);
  const targetObjectKey = normalizeManagedObjectKey(folder + "/" + targetFilename);
  if (targetObjectKey === asset.objectKey) throw new MediaStorageError("media_move_same_path", "المسار الجديد مطابق للحالي.", 400);
  return { targetFilename, targetObjectKey };
}

function readRelocationIdentity(value: Json | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.provider !== "supabase" || typeof value.bucket !== "string" || typeof value.objectKey !== "string" || typeof value.publicUrl !== "string" || typeof value.folderPath !== "string" || !value.bucket || !value.objectKey || !value.publicUrl || value.folderPath !== getFolderPathFromObjectKey(value.objectKey)) throw new Error("media_relocation_recovery_identity_unproven");
  return { provider: "supabase" as const, bucket: value.bucket, objectKey: value.objectKey, publicUrl: value.publicUrl, folderPath: value.folderPath };
}

/** Recovery compensates a proven staged copy while the existing unresolved lease
 * fences all affected assets. Expired live workers are never reclaimed here. */
export async function repairFailedMediaRelocation(leaseToken: string) {
  const db = getSupabaseAdmin();
  const rows = await db.from("media_reference_write_leases").select("id,status,resolved_at,failure_metadata,updated_at,failure_code").eq("lease_token", leaseToken).order("id");
  if (rows.error || !rows.data?.length || rows.data.some(row => row.status !== "failed" || row.resolved_at)) throw new Error("media_relocation_recovery_not_ready");
  const first = rows.data[0];
  const plan = first.failure_metadata;
  if (!plan || typeof plan !== "object" || Array.isArray(plan) || plan.operation !== "physical_move" || first.failure_code === "media_relocation_repair_running") throw new Error("media_relocation_recovery_plan_unproven");
  const prior = plan.previousAsset;
  if (!prior || typeof prior !== "object" || Array.isArray(prior) || typeof prior.id !== "string") throw new Error("media_relocation_recovery_plan_unproven");
  const previousIdentity = readRelocationIdentity(prior), next = readRelocationIdentity(plan.nextIdentity);
  const referenceKeys = plan.referenceKeys;
  if (!Array.isArray(referenceKeys) || referenceKeys.some(key => !Array.isArray(key) || key.length !== 3 || key.some(value => typeof value !== "string"))) throw new Error("media_relocation_recovery_plan_unproven");
  const current = await getCatalogAssetById(prior.id);
  if (!current || current.provider !== "supabase" || current.status !== "active" || previousIdentity.bucket !== next.bucket) throw new Error("media_relocation_recovery_identity_unproven");
  const previous: MediaCatalogAsset = { ...current, ...previousIdentity, reconciliationState: "synced", missingObject: false };
  if (buildMovedPublicUrl(previous, next.objectKey) !== next.publicUrl) throw new Error("media_relocation_recovery_identity_unproven");
  const claim = await db.rpc("transition_media_relocation_repair", { p_lease_token: leaseToken, p_action: "claim", p_expected_updated_at: first.updated_at });
  if (claim.error || Number(claim.data) !== rows.data.length) throw new Error("media_relocation_recovery_conflict");
  try {
    const state = await proveStorageMoveState(previous.publicUrl, next.publicUrl);
    const observed = await readCatalogIdentity(previous.id);
    const scan = await scanAllMediaReferenceProviders();
    if (scan.uncertainties.length) throw new Error("media_relocation_recovery_reference_uncertain");
    const oldKey = getCanonicalMediaIdentityKey(previous), nextKey = getCanonicalMediaIdentityKey(next);
    const oldRefs = scan.references.filter(ref => getCanonicalMediaIdentityKey(ref.identity) === oldKey);
    const nextRefs = scan.references.filter(ref => getCanonicalMediaIdentityKey(ref.identity) === nextKey);
    if (plan.copyConfirmed && state === "next" && identityMatches(observed, next) && !oldRefs.length) {
      // Retirement finished; keep the final identity and let full reconciliation prove it.
      await markCatalogAssetState(previous.id, { reconciliationState: "synced" });
    } else if (state === "previous" || (state === "both" && plan.copyConfirmed)) {
      const allowed = new Set(referenceKeys.map(key => Array.isArray(key) ? key.join("\u0000") : ""));
      if (nextRefs.some(ref => !allowed.has([ref.domainKey, ref.entityIdentity, ref.fieldKey].join("\u0000")))) throw new Error("media_relocation_recovery_foreign_reference");
      for (const ref of nextRefs) {
        const provider = getMediaReferenceProvider(ref.domainKey);
        if (!provider?.supportsRebind) throw new Error("UNSUPPORTED_REFERENCE_OWNER");
        await provider.rebind(ref, previous.publicUrl);
      }
      if (identityMatches(observed, next)) {
        if (!await rollbackCatalogIdentity({ previous, next, leaseToken })) throw new Error("media_relocation_recovery_catalog_unproven");
      } else if (!identityMatches(observed, previous)) throw new Error("media_relocation_recovery_identity_unproven");
      const verified = await scanAllMediaReferenceProviders();
      if (verified.uncertainties.length || verified.references.some(ref => getCanonicalMediaIdentityKey(ref.identity) === nextKey)) throw new Error("media_relocation_recovery_rebind_unproven");
      await expirePublicCacheTags(Object.values(PUBLIC_CACHE_TAG_GROUPS).flat());
      if (state === "both") await createSupabaseCmsMediaStorageAdapter().deleteAsset(next.publicUrl);
      if (await proveStorageMoveState(previous.publicUrl, next.publicUrl) !== "previous") throw new Error("media_relocation_recovery_storage_unproven");
    } else throw new Error("media_relocation_recovery_storage_ownership_unproven");
    const completed = await db.rpc("transition_media_relocation_repair", { p_lease_token: leaseToken, p_action: "complete", p_expected_updated_at: first.updated_at });
    if (completed.error || Number(completed.data) !== rows.data.length) throw new Error("media_relocation_recovery_receipt_failed");
    return { repaired: true, reconciliationRequired: true };
  } catch (error) {
    await db.rpc("transition_media_relocation_repair", { p_lease_token: leaseToken, p_action: "fail", p_expected_updated_at: first.updated_at });
    throw error;
  }
}
