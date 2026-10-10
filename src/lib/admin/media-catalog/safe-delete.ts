import "server-only";

import { recordCmsAdminAudit } from "../audit-log";
import { failMediaReferenceWriteLease, resolveMediaReferenceWriteLease } from "./write-lease";
import { runBoundedMediaDeletes } from "./delete-saga";
import { randomUUID } from "node:crypto";

import { verifyManagedStorageAssetExists } from "../../storage/upload-cms-asset";
import { getSupabaseAdmin } from "../../supabase-admin";
import { deletePublicMediaAsset, isManagedPublicMediaAsset } from "../media-library";
import {
  getCatalogAssetByPublicValue,
  getMediaCatalogRuntimeState,
  listMediaCatalogSnapshot,
  listCatalogReferences,
} from "./catalog";
import {
  cancelCatalogAssetDeletion,
  finalizeCatalogAssetDeletion,
  markCatalogAssetDeleteRecovery,
  MediaDeleteReservationError,
  reserveCatalogAssetDeletion,
} from "./delete-reservation";
import { runMediaDeleteSaga } from "./delete-saga";
import { buildMediaCatalogReadiness } from "./readiness";
import { reconcileMediaCatalog, refreshMediaCatalogAfterMutation } from "./reconciliation";
import { getCanonicalMediaIdentityKey } from "./identity";
import {
  MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION,
  scanAllMediaReferenceProviders,
} from "./reference-providers";
import { normalizeMediaFolder } from "../media-library-paths";
import { MediaStorageError } from "../media-storage-adapter";
import type { MediaDeleteEligibility } from "./types";
import {
  listPublicMediaInventory,
  resolveMediaStorageRuntimeContext,
} from "../media-library";

async function readDeleteLeases() {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await getSupabaseAdmin().from("media_reference_write_leases")
      .select("lease_token,asset_id,status,expires_at,completed_at,write_targets")
      .or("status.eq.active,and(status.in.(failed,expired),resolved_at.is.null)")
      .order("id").range(offset, offset + 499);
    if (error) throw new Error(`media_write_lease_state_unavailable:${error.code ?? "unknown"}`);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 500) return rows;
  }
}

async function readDeleteContext() {
  const [runtimeState, catalog, inventory, live, leases] = await Promise.all([
    getMediaCatalogRuntimeState(), listMediaCatalogSnapshot(), listPublicMediaInventory(), scanAllMediaReferenceProviders(), readDeleteLeases(),
  ]);
  return { runtimeState, catalog, inventory, live, leases };
}

type DeleteContext = Awaited<ReturnType<typeof readDeleteContext>>;

async function settleStaleDeleteLeases(snapshot: DeleteContext, assetIds: Set<string>) {
  const now = Date.now();
  const tokens = new Set(snapshot.leases.filter(lease => assetIds.has(lease.asset_id)
    && (lease.status !== "active" || Date.parse(lease.expires_at) <= now)).map(lease => lease.lease_token));
  if (!tokens.size) return snapshot;
  // A token owns a group: never resolve it while any member is still active.
  for (const token of tokens) if (snapshot.leases.some(lease => lease.lease_token === token
    && lease.status === "active" && Date.parse(lease.expires_at) > now)) tokens.delete(token);
  if (!tokens.size) return snapshot;
  for (const token of tokens) {
    const group = snapshot.leases.filter(lease => lease.lease_token === token);
    if (!group.every(lease => lease.status === "active")) continue;
    const target = (group[0].write_targets as { entityIdentity?: string }[])[0];
    try {
      await failMediaReferenceWriteLease({ lease: { token, assetCount: group.length,
        startedAt: "", expiresAt: group[0].expires_at, primaryEntityIdentity: target?.entityIdentity ?? "" },
        failureCode: "media_write_lease_expired_before_delete", reasons: ["write_window_expired"], domainWriteCommitted: true });
      await recordCmsAdminAudit({ action: "media_asset.update", entityType: "media_asset",
        entityLabel: "Media write lease recovery", metadata: { operation: "expire_write_lease", leaseToken: token } });
    } catch { tokens.delete(token); }
  }
  if (!tokens.size) return { ...snapshot, leases: await readDeleteLeases() };
  snapshot = { ...snapshot, leases: await readDeleteLeases() };
  const lastWrite = Math.max(...snapshot.leases.filter(lease => tokens.has(lease.lease_token)).map(lease =>
    Date.parse(lease.status === "active" ? lease.expires_at : lease.completed_at ?? lease.expires_at)));
  const runtime = snapshot.runtimeState;
  const context = resolveMediaStorageRuntimeContext();
  if (runtime.state !== "synced" || runtime.environmentKey !== context.identity
    || runtime.providerRegistryVersion !== MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION
    || !runtime.lastSuccessfulReconciliationStartedAt
    || Date.parse(runtime.lastSuccessfulReconciliationStartedAt) <= lastWrite
    || !runtime.lastSuccessfulReconciliationDomains?.length
    || snapshot.leases.filter(lease => tokens.has(lease.lease_token)).some(lease =>
      (lease.write_targets as { domainKey: string }[]).some(target => !runtime.lastSuccessfulReconciliationDomains?.includes(target.domainKey)))) {
    const reconciliation = await reconcileMediaCatalog();
    if (!reconciliation.complete) return { ...snapshot, live: { ...snapshot.live,
      uncertainties: [...snapshot.live.uncertainties, ...reconciliation.uncertainties] } };
    snapshot = await readDeleteContext();
  }
  for (const token of tokens) {
    try {
      await resolveMediaReferenceWriteLease({ leaseToken: token,
        reconciliationRunIdentity: snapshot.runtimeState.lastSuccessfulReconciliationRunIdentity!,
        resolutionCode: "media_write_lease_reconciled_before_delete" });
      await recordCmsAdminAudit({ action: "media_asset.update", entityType: "media_asset",
        entityLabel: "Media write lease recovery", metadata: { operation: "resolve_write_lease", leaseToken: token,
          reconciliationRunIdentity: snapshot.runtimeState.lastSuccessfulReconciliationRunIdentity } });
    } catch {
      // A racing writer or missing proof remains a real blocker. Re-read the
      // official state rather than turning recovery errors into permission.
    }
  }
  return { ...snapshot, leases: await readDeleteLeases() };
}

export async function previewMediaDeletion(input: { assets?: unknown; folder?: unknown }) {
  let snapshot = await readDeleteContext();
  let assets;
  let folder: string | null = null;
  if (typeof input.folder === "string") {
    folder = normalizeMediaFolder(input.folder);
    if (!folder.includes("/") || !snapshot.catalog.folders.some(item => item.path === folder))
      throw new MediaStorageError("invalid_delete_folder", "اختر مجلدًا فرعيًا موجودًا؛ جذور المكتبة محمية.", 400);
    assets = snapshot.catalog.assets.filter(asset => asset.folderPath === folder || asset.folderPath.startsWith(`${folder}/`));
  } else {
    if (!Array.isArray(input.assets) || input.assets.length === 0 || input.assets.some(value => typeof value !== "string"))
      throw new MediaStorageError("invalid_delete_targets", "اختر الملفات المطلوب حذفها.", 400);
    const values = new Set(input.assets as string[]);
    assets = snapshot.catalog.assets.filter(asset => values.has(asset.publicUrl));
    if (assets.length !== values.size) throw new MediaStorageError("invalid_delete_targets", "تعذر إثبات هوية أحد الملفات المحددة.", 400);
  }
  snapshot = await settleStaleDeleteLeases(snapshot, new Set(assets.map(asset => asset.id)));
  const checks: MediaDeleteEligibility[] = [];
  for (const asset of assets) checks.push(await getMediaDeleteEligibility(asset.publicUrl, snapshot));
  return { folder, assets, checks };
}

export async function getMediaDeleteEligibility(publicValue: string, snapshot?: Awaited<ReturnType<typeof readDeleteContext>>): Promise<MediaDeleteEligibility> {
  if (!(await isManagedPublicMediaAsset(publicValue))) {
    return { state: "unmanaged", asset: null };
  }

  let asset;
  try {
    asset = snapshot ? snapshot.catalog.assets.find(item => item.publicUrl === publicValue) : await getCatalogAssetByPublicValue(publicValue);
  } catch (error) {
    return {
      state: "uncertain",
      asset: null,
      reasons: [error instanceof Error ? error.message : "media_catalog_unavailable"],
    };
  }
  if (!asset) {
    return {
      state: "uncertain",
      asset: null,
      reasons: ["managed_asset_missing_from_catalog"],
    };
  }
  if (asset.missingObject || asset.status === "missing") {
    return { state: "already_missing", asset };
  }
  if (asset.reconciliationState !== "synced") {
    return {
      state: "catalog_storage_drift",
      asset,
      reasons: [`asset_reconciliation_state:${asset.reconciliationState}`],
    };
  }

  const context = resolveMediaStorageRuntimeContext();
  let read;
  try { read = snapshot ?? await readDeleteContext(); }
  catch (error) { return { state: "uncertain", asset, reasons: [error instanceof Error ? error.message : "media_catalog_state_unavailable"] }; }
  if (!snapshot) read = await settleStaleDeleteLeases(read, new Set([asset.id]));
  const { runtimeState, catalog, inventory, live, leases } = read;
  const readiness = buildMediaCatalogReadiness(
    catalog,
    inventory,
    runtimeState,
    context,
    MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION,
  );
  if (!readiness.safeDeleteReady || asset.provider !== context.provider) {
    return {
      state: "uncertain",
      asset,
      reasons: [
        ...readiness.reasons.map((reason) => `media_readiness:${reason}`),
        ...readiness.warnings,
        ...(asset.provider !== context.provider ? ["media_asset_provider_mismatch"] : []),
      ],
    };
  }

  const unresolved = leases.filter(lease => lease.asset_id === asset.id);
  if (unresolved.length) return { state: "uncertain", asset, reasons: [unresolved.some(lease =>
    lease.status === "active" && Date.parse(lease.expires_at) > Date.now())
      ? "media_delete_write_lease_active" : "media_delete_write_lease_unresolved"] };
  if (live.uncertainties.length) {
    return { state: "uncertain", asset, reasons: live.uncertainties };
  }
  const identityKey = getCanonicalMediaIdentityKey(asset);
  const driftReferences = live.references.filter(
    (reference) => getCanonicalMediaIdentityKey(reference.identity) === identityKey,
  );

  // The complete inventory above already proves this exact identity exists.
  // Storage is verified again after removal by the saga, never by redundant polling.
  if (driftReferences.length) return { state: "in_use", asset, references: driftReferences.map(reference => ({
    domainKey: reference.domainKey, entityType: reference.entityType, entityIdentity: reference.entityIdentity,
    entityLabel: reference.entityLabel ?? null, fieldKey: reference.fieldKey, editHref: reference.editHref ?? null,
    publicHref: reference.publicHref ?? null, referenceState: reference.referenceState, restorable: reference.restorable,
  })) };
  return { state: "safe_to_delete", asset, references: [] };
}

export async function safelyDeleteMediaAsset(
  publicValue: string,
  options: {
    snapshot?: DeleteContext;
    deferCatalogRefresh?: boolean;
    confirmReferenced?: boolean;
    actorId?: number | null;
    requestIdentity?: string;
    onTransition?: (event: {
      operation: "reserve" | "cancel" | "finalize" | "recovery";
      reservationId: string | null;
      assetId: string;
      failureCode?: string | null;
      storageState?: "exists" | "missing" | "uncertain" | null;
    }) => Promise<void>;
  } = {},
) {
  const eligibility = await getMediaDeleteEligibility(publicValue, options.snapshot);
  if (eligibility.state !== "safe_to_delete" && !(eligibility.state === "in_use" && options.confirmReferenced === true)) return { deleted: false as const, eligibility };

  try {
    const identityKey = getCanonicalMediaIdentityKey(eligibility.asset);
    const auditTransition = (event: Parameters<NonNullable<typeof options.onTransition>>[0]) =>
      options.onTransition?.(event) ?? Promise.resolve();
    const workflow = await runMediaDeleteSaga({
      confirmReferenced: options.confirmReferenced === true,
      reserve: async () => {
        await auditTransition({
          operation: "reserve",
          reservationId: null,
          assetId: eligibility.asset.id,
        });
        const reservation = await reserveCatalogAssetDeletion({
          assetId: eligibility.asset.id,
          expectedProvider: eligibility.asset.provider,
          expectedBucket: eligibility.asset.bucket,
          expectedObjectKey: eligibility.asset.objectKey,
          actorId: options.actorId,
          confirmReferenced: options.confirmReferenced === true,
          requestIdentity: options.requestIdentity?.trim() || randomUUID(),
        });
        return reservation;
      },
      scanAfterReservation: async () => {
        const [persistedReferences, live, runtimeState] = await Promise.all([
          listCatalogReferences(eligibility.asset.id),
          scanAllMediaReferenceProviders(),
          getMediaCatalogRuntimeState(),
        ]);
        const liveReferences = live.references.filter(
          (reference) => getCanonicalMediaIdentityKey(reference.identity) === identityKey,
        );
        const context = resolveMediaStorageRuntimeContext();
        const runtimeUncertainties =
          runtimeState.state !== "synced" ||
          runtimeState.providerRegistryVersion !== MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION ||
          runtimeState.environmentKey !== context.identity ||
          runtimeState.provider !== context.provider ||
          runtimeState.environment !== context.environment
            ? ["media_delete_runtime_state_changed_after_reservation"]
            : [];
        return {
          referenceReasons: [
            ...persistedReferences.map(
              (reference) =>
                `persisted_reference_after_reservation:${reference.domainKey}:${reference.entityIdentity}:${reference.fieldKey}`,
            ),
            ...liveReferences.map(
              (reference) =>
                `live_reference_after_reservation:${reference.domainKey}:${reference.entityIdentity}:${reference.fieldKey}`,
            ),
          ],
          uncertainties: [...live.uncertainties, ...runtimeUncertainties],
        };
      },
      deleteStorage: (reservation) => deletePublicMediaAsset(reservation.publicValue),
      verifyStorageState: async (reservation) => {
        const storage = await verifyManagedStorageAssetExists(reservation.publicValue);
        if (!storage.managed) return "uncertain" as const;
        return storage.exists ? ("exists" as const) : ("missing" as const);
      },
      cancelReservation: async (input) => {
        await auditTransition({
          operation: "cancel",
          reservationId: input.reservation.id,
          assetId: input.reservation.assetId,
          failureCode: input.failureCode,
          storageState: "exists",
        });
        await cancelCatalogAssetDeletion(input);
      },
      finalizeReservation: async (input) => {
        await auditTransition({
          operation: "finalize",
          reservationId: input.reservation.id,
          assetId: input.reservation.assetId,
          storageState: "missing",
        });
        await finalizeCatalogAssetDeletion(input);
      },
      markRecoveryRequired: async (input) => {
        await auditTransition({
          operation: "recovery",
          reservationId: input.reservation.id,
          assetId: input.reservation.assetId,
          failureCode: input.failureCode,
          storageState: input.storageState,
        });
        await markCatalogAssetDeleteRecovery(input);
      },
    });

    if (!workflow.deleted) {
      return {
        deleted: false as const,
        eligibility: {
          state: "uncertain" as const,
          asset: eligibility.asset,
          reasons: workflow.reasons,
        },
        workflow,
      };
    }

    const catalogWarnings = options.deferCatalogRefresh ? [] : await refreshMediaDeleteCatalog(options.actorId);
    return {
      deleted: true as const,
      catalogWarnings,
      eligibility,
      workflow,
      ...workflow.storageResult,
    };
  } catch (error) {
    if (error instanceof MediaDeleteReservationError) {
      return {
        deleted: false as const,
        eligibility: {
          state: "uncertain" as const,
          asset: eligibility.asset,
          reasons: [error.code],
        },
        reservationFailureCode: error.code,
      };
    }
    throw error;
  }
}

export const refreshMediaDeleteCatalog = refreshMediaCatalogAfterMutation;

export async function prepareMediaDeleteBatch(values: string[]) {
  const snapshot = await readDeleteContext();
  return settleStaleDeleteLeases(snapshot, new Set(snapshot.catalog.assets
    .filter(asset => values.includes(asset.publicUrl)).map(asset => asset.id)));
}

export { runBoundedMediaDeletes };
