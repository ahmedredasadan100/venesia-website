import "server-only";

import { verifyManagedStorageAssetExists } from "../../storage/upload-cms-asset";
import { deletePublicMediaAsset, isManagedPublicMediaAsset } from "../media-library";
import {
  getCatalogAssetByPublicValue,
  getMediaCatalogRuntimeState,
  listMediaCatalogSnapshot,
  listCatalogReferences,
  markCatalogAssetState,
} from "./catalog";
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

  const persistedReferences = await listCatalogReferences(asset.id);
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

export async function safelyDeleteMediaAsset(publicValue: string) {
  const eligibility = await getMediaDeleteEligibility(publicValue);
  if (eligibility.state !== "safe_to_delete") return { deleted: false as const, eligibility };

  await markCatalogAssetState(eligibility.asset.id, { status: "deleting" });
  try {
    const deleted = await deletePublicMediaAsset(publicValue);
    await markCatalogAssetState(eligibility.asset.id, {
      status: "deleted",
      reconciliationState: "synced",
      missingObject: false,
    });
    return { deleted: true as const, eligibility, ...deleted };
  } catch (error) {
    await markCatalogAssetState(eligibility.asset.id, {
      status: "active",
      reconciliationState: "uncertain",
    }).catch(() => undefined);
    throw error;
  }
}
