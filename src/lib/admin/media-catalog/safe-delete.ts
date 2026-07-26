import "server-only";

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
import { getCanonicalMediaIdentityKey } from "./identity";
import {
  MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION,
  scanAllMediaReferenceProviders,
} from "./reference-providers";
import type { MediaDeleteEligibility } from "./types";
import {
  listPublicMediaInventory,
  resolveMediaStorageRuntimeContext,
} from "../media-library";

export async function getMediaDeleteEligibility(publicValue: string): Promise<MediaDeleteEligibility> {
  if (!(await isManagedPublicMediaAsset(publicValue))) {
    return { state: "unmanaged", asset: null };
  }

  let asset;
  try {
    asset = await getCatalogAssetByPublicValue(publicValue);
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
  let runtimeState;
  let catalog;
  let inventory;
  try {
    [runtimeState, catalog, inventory] = await Promise.all([
      getMediaCatalogRuntimeState(),
      listMediaCatalogSnapshot(),
      listPublicMediaInventory(),
    ]);
  } catch (error) {
    return {
      state: "uncertain",
      asset,
      reasons: [error instanceof Error ? error.message : "media_catalog_state_unavailable"],
    };
  }
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

  const [persistedReferences, leaseResult] = await Promise.all([
    listCatalogReferences(asset.id),
    getSupabaseAdmin()
      .from("media_reference_write_leases")
      .select("id")
      .eq("asset_id", asset.id)
      .or("status.eq.active,and(status.in.(failed,expired),resolved_at.is.null)")
      .limit(1),
  ]);
  if (leaseResult.error) {
    return {
      state: "uncertain",
      asset,
      reasons: [`media_write_lease_state_unavailable:${leaseResult.error.code ?? "unknown"}`],
    };
  }
  const unresolvedLease = (leaseResult.data ?? []).length > 0;
  if (unresolvedLease) {
    return {
      state: "uncertain",
      asset,
      reasons: ["media_delete_write_lease_unresolved"],
    };
  }
  if (persistedReferences.length) {
    return { state: "in_use", asset, references: persistedReferences };
  }

  const live = await scanAllMediaReferenceProviders();
  if (live.uncertainties.length) {
    return { state: "uncertain", asset, reasons: live.uncertainties };
  }
  const identityKey = getCanonicalMediaIdentityKey(asset);
  const driftReferences = live.references.filter(
    (reference) => getCanonicalMediaIdentityKey(reference.identity) === identityKey,
  );
  if (driftReferences.length) {
    return {
      state: "uncertain",
      asset,
      reasons: driftReferences.map(
        (reference) =>
          `persisted_reference_drift:${reference.domainKey}:${reference.entityIdentity}:${reference.fieldKey}`,
      ),
    };
  }

  try {
    const storage = await verifyManagedStorageAssetExists(publicValue);
    if (!storage.managed) return { state: "unmanaged", asset: null };
    if (!storage.exists) return { state: "already_missing", asset };
  } catch (error) {
    return {
      state: "uncertain",
      asset,
      reasons: [error instanceof Error ? error.message : "media_storage_verification_failed"],
    };
  }

  return { state: "safe_to_delete", asset, references: [] };
}

export async function safelyDeleteMediaAsset(
  publicValue: string,
  options: {
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
  const eligibility = await getMediaDeleteEligibility(publicValue);
  if (eligibility.state !== "safe_to_delete") return { deleted: false as const, eligibility };

  try {
    const identityKey = getCanonicalMediaIdentityKey(eligibility.asset);
    const auditTransition = (event: Parameters<NonNullable<typeof options.onTransition>>[0]) =>
      options.onTransition?.(event) ?? Promise.resolve();
    const workflow = await runMediaDeleteSaga({
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

    return {
      deleted: true as const,
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
