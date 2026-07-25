import "server-only";

import {
  getCatalogAssetByPublicValue,
  getMediaCatalogRuntimeState,
  listCatalogReferences,
} from "../media-catalog/catalog";
import { MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION } from "../media-catalog/reference-providers";

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
  const runtimeState = await getMediaCatalogRuntimeState();
  if (
    runtimeState.state !== "synced" ||
    runtimeState.providerRegistryVersion !== MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION
  ) {
    throw new Error("media_reference_truth_uncertain");
  }

  const asset = await getCatalogAssetByPublicValue(assetUrl);
  if (!asset) throw new Error("media_asset_missing_from_catalog");
  const references = await listCatalogReferences(asset.id);
  return references.map((reference) => ({
    entityType: reference.entityType,
    entityLabel: reference.entityLabel ?? `${reference.entityType} #${reference.entityIdentity}`,
    field: reference.fieldKey,
    editHref: reference.editHref,
    referenceState: reference.referenceState,
  }));
}
