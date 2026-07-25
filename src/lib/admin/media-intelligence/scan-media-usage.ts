import "server-only";

import {
  getCatalogAssetByPublicValue,
  getMediaCatalogRuntimeState,
  listCatalogReferences,
  listMediaCatalogSnapshot,
} from "../media-catalog/catalog";
import { buildMediaCatalogReadiness } from "../media-catalog/readiness";
import { MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION } from "../media-catalog/reference-providers";
import {
  listPublicMediaInventory,
  resolveMediaStorageRuntimeContext,
} from "../media-library";

export type MediaUsageHit = {
  entityType: string;
  entityLabel: string;
  field: string;
  editHref: string | null;
  referenceState: string;
};

/**
 * Compatibility facade for existing usage consumers.
 * Persisted media_references is authoritative; textual filename scanning is intentionally removed.
 */
export async function scanMediaAssetUsage(assetUrl: string): Promise<MediaUsageHit[]> {
  const context = resolveMediaStorageRuntimeContext();
  const [runtimeState, catalog, inventory] = await Promise.all([
    getMediaCatalogRuntimeState(),
    listMediaCatalogSnapshot(),
    listPublicMediaInventory(),
  ]);
  const readiness = buildMediaCatalogReadiness(
    catalog,
    inventory,
    runtimeState,
    context,
    MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION,
  );
  if (!readiness.usageResultsAuthoritative) {
    throw new Error("media_reference_truth_uncertain");
  }

  const asset = await getCatalogAssetByPublicValue(assetUrl);
  if (
    !asset ||
    !asset.catalogRegistered ||
    asset.provider !== context.provider ||
    asset.reconciliationState !== "synced" ||
    asset.missingObject
  ) {
    throw new Error("media_asset_missing_from_catalog");
  }
  const references = await listCatalogReferences(asset.id);
  return references.map((reference) => ({
    entityType: reference.entityType,
    entityLabel: reference.entityLabel ?? `${reference.entityType} #${reference.entityIdentity}`,
    field: reference.fieldKey,
    editHref: reference.editHref,
    referenceState: reference.referenceState,
  }));
}
