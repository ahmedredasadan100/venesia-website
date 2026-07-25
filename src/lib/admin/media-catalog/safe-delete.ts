import "server-only";

import { verifyManagedStorageAssetExists } from "../../storage/upload-cms-asset";
import { deletePublicMediaAsset, isManagedPublicMediaAsset } from "../media-library";
import {
  getCatalogAssetByPublicValue,
  getMediaCatalogRuntimeState,
  listCatalogReferences,
  markCatalogAssetState,
} from "./catalog";
import { getCanonicalMediaIdentityKey } from "./identity";
import {
  MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION,
  scanAllMediaReferenceProviders,
} from "./reference-providers";
import type { MediaDeleteEligibility } from "./types";

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

  let runtimeState;
  try {
    runtimeState = await getMediaCatalogRuntimeState();
  } catch (error) {
    return {
      state: "uncertain",
      asset,
      reasons: [error instanceof Error ? error.message : "media_catalog_state_unavailable"],
    };
  }
  if (
    runtimeState.state !== "synced" ||
    runtimeState.providerRegistryVersion !== MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION
  ) {
    return {
      state: "uncertain",
      asset,
      reasons: [
        runtimeState.state !== "synced" ? "media_catalog_not_reconciled" : "media_provider_registry_drift",
        ...runtimeState.warnings,
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
