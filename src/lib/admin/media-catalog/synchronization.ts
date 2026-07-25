import "server-only";

import { getSupabaseAdmin } from "../../supabase-admin";
import {
  getAllCatalogAssetIdentityMap,
  getMediaCatalogRuntimeState,
  listCatalogReferences,
  setMediaCatalogRuntimeState,
  type MediaCatalogRuntimeState,
} from "./catalog";
import { getCanonicalMediaIdentityKey } from "./identity";
import {
  getMediaReferenceProvider,
  MEDIA_REFERENCE_PROVIDER_REGISTRY,
  MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION,
  scanAllMediaReferenceProviders,
  validateMediaReferenceProviderRegistry,
  type DiscoveredMediaReference,
} from "./reference-providers";
import type { MediaCatalogAsset } from "./types";

export class MediaReferenceSynchronizationError extends Error {
  readonly code = "media_reference_sync_failed";
  readonly uncertainties: string[];

  constructor(message: string, uncertainties: string[]) {
    super(message);
    this.name = "MediaReferenceSynchronizationError";
    this.uncertainties = uncertainties;
  }
}

function serializedReference(reference: DiscoveredMediaReference, assetId: string) {
  return {
    assetId,
    entityType: reference.entityType,
    entityIdentity: reference.entityIdentity,
    entityLabel: reference.entityLabel,
    fieldKey: reference.fieldKey,
    editHref: reference.editHref,
    publicHref: reference.publicHref,
    referenceState: reference.referenceState,
    restorable: reference.restorable,
    metadata: {},
  };
}

async function markRuntimeUncertain(warnings: string[]) {
  let current: MediaCatalogRuntimeState;
  try {
    current = await getMediaCatalogRuntimeState();
  } catch {
    return;
  }
  await setMediaCatalogRuntimeState({
    ...current,
    state: "uncertain",
    providerRegistryVersion: MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION,
    warnings: [...new Set([...current.warnings, ...warnings])].slice(-30),
  });
}

export async function syncMediaReferencesForEntity(domainKey: string, entityIdentity: string) {
  const provider = getMediaReferenceProvider(domainKey);
  if (!provider) {
    const warning = `missing_media_reference_provider:${domainKey}`;
    await markRuntimeUncertain([warning]);
    throw new MediaReferenceSynchronizationError("مالك مراجع الوسائط المطلوب غير مسجل.", [warning]);
  }

  const [references, assetMap] = await Promise.all([
    provider.scanEntity(entityIdentity),
    getAllCatalogAssetIdentityMap(),
  ]);
  const missing = references
    .filter((reference) => !assetMap.has(getCanonicalMediaIdentityKey(reference.identity)))
    .map((reference) => `catalog_asset_missing:${provider.domainKey}:${reference.entityIdentity}:${reference.fieldKey}`);
  if (missing.length) {
    await markRuntimeUncertain(missing);
    throw new MediaReferenceSynchronizationError(
      "تم حفظ بيانات النطاق، لكن تعذر إثبات اتساق مراجع الوسائط. الحذف محجوب حتى reconciliation.",
      missing,
    );
  }

  const payload = references.map((reference) =>
    serializedReference(reference, assetMap.get(getCanonicalMediaIdentityKey(reference.identity))!.id),
  );
  const { error } = await getSupabaseAdmin().rpc("replace_media_references_for_entity", {
    p_domain_key: provider.domainKey,
    p_entity_type: provider.entityType,
    p_entity_identity: entityIdentity,
    p_references: payload,
  });
  if (error) {
    const warning = `media_reference_sync_rpc_failed:${provider.domainKey}:${error.code ?? "unknown"}`;
    await markRuntimeUncertain([warning]);
    throw new MediaReferenceSynchronizationError(
      "تعذر مزامنة مراجع الوسائط. تم منع الحذف حتى reconciliation.",
      [warning],
    );
  }

  return { domainKey, entityIdentity, referenceCount: payload.length };
}

export async function syncMediaReferencesForProvider(domainKey: string) {
  const provider = getMediaReferenceProvider(domainKey);
  if (!provider) {
    const warning = `missing_media_reference_provider:${domainKey}`;
    await markRuntimeUncertain([warning]);
    throw new MediaReferenceSynchronizationError("مالك مراجع الوسائط المطلوب غير مسجل.", [warning]);
  }
  const [references, assetMap] = await Promise.all([
    provider.scanAll(),
    getAllCatalogAssetIdentityMap(),
  ]);
  const missing = references
    .filter((reference) => !assetMap.has(getCanonicalMediaIdentityKey(reference.identity)))
    .map((reference) => `catalog_asset_missing:${provider.domainKey}:${reference.entityIdentity}:${reference.fieldKey}`);
  if (missing.length) {
    await markRuntimeUncertain(missing);
    throw new MediaReferenceSynchronizationError("تعذر إثبات اتساق مراجع الوسائط للنطاق.", missing);
  }
  const payload = references.map((reference) =>
    serializedReference(reference, assetMap.get(getCanonicalMediaIdentityKey(reference.identity))!.id),
  );
  const { error } = await getSupabaseAdmin().rpc("replace_media_references_for_provider", {
    p_domain_key: provider.domainKey,
    p_references: payload,
  });
  if (error) {
    const warning = `media_reference_provider_sync_failed:${provider.domainKey}:${error.code ?? "unknown"}`;
    await markRuntimeUncertain([warning]);
    throw new MediaReferenceSynchronizationError("تعذرت مزامنة provider مراجع الوسائط.", [warning]);
  }
  return { domainKey, referenceCount: payload.length };
}

export async function synchronizeMediaReferencesAfterDomainMutation(
  domainKey: string,
  entityIdentity: string | number,
) {
  try {
    const result = await syncMediaReferencesForEntity(domainKey, String(entityIdentity));
    return { state: "synced" as const, ...result };
  } catch (error) {
    console.error("Media reference synchronization requires reconciliation", {
      domainKey,
      entityIdentity: String(entityIdentity),
      code: error instanceof Error && "code" in error ? error.code : "media_reference_sync_failed",
    });
    return {
      state: "uncertain" as const,
      domainKey,
      entityIdentity: String(entityIdentity),
      message: error instanceof Error ? error.message : "media_reference_sync_failed",
    };
  }
}

export async function synchronizeMediaReferenceProvidersAfterMutation(...domainKeys: string[]) {
  const results = await Promise.allSettled(domainKeys.map((domainKey) => syncMediaReferencesForProvider(domainKey)));
  const failures = results.flatMap((result, index) =>
    result.status === "rejected"
      ? [`${domainKeys[index]}:${result.reason instanceof Error ? result.reason.message : "media_reference_sync_failed"}`]
      : [],
  );
  if (failures.length) {
    console.error("Media reference providers require reconciliation", { domainKeys, failures });
    return { state: "uncertain" as const, failures };
  }
  return { state: "synced" as const, failures: [] };
}

export async function synchronizeProjectMediaReferencesAfterMutation(projectId: string | number) {
  return synchronizeProjectsMediaReferencesAfterMutation([projectId]);
}

export async function synchronizeProjectsMediaReferencesAfterMutation(projectIds: Array<string | number>) {
  const tasks = [
    ...projectIds.map((projectId) => syncMediaReferencesForEntity("projects", String(projectId))),
    syncMediaReferencesForProvider("project_media"),
    syncMediaReferencesForProvider("project_floor_plans"),
  ];
  const results = await Promise.allSettled(tasks);
  const failures = results.flatMap((result) =>
    result.status === "rejected"
      ? [result.reason instanceof Error ? result.reason.message : "project_media_reference_sync_failed"]
      : [],
  );
  if (failures.length) {
    console.error("Project media references require reconciliation", { projectIds: projectIds.map(String), failures });
    return { state: "uncertain" as const, failures };
  }
  return { state: "synced" as const, failures: [] };
}

export async function reconcileAllMediaReferences(options: { dryRun?: boolean } = {}) {
  validateMediaReferenceProviderRegistry();
  const assetMap = await getAllCatalogAssetIdentityMap();
  const uncertainties: string[] = [];
  let discoveredReferenceCount = 0;
  let synchronizedProviderCount = 0;

  for (const provider of MEDIA_REFERENCE_PROVIDER_REGISTRY) {
    try {
      const references = await provider.scanAll();
      discoveredReferenceCount += references.length;
      const missing = references
        .filter((reference) => !assetMap.has(getCanonicalMediaIdentityKey(reference.identity)))
        .map((reference) => `catalog_asset_missing:${provider.domainKey}:${reference.entityIdentity}:${reference.fieldKey}`);
      if (missing.length) {
        uncertainties.push(...missing);
        continue;
      }
      if (options.dryRun) continue;

      const payload = references.map((reference) =>
        serializedReference(reference, assetMap.get(getCanonicalMediaIdentityKey(reference.identity))!.id),
      );
      const { error } = await getSupabaseAdmin().rpc("replace_media_references_for_provider", {
        p_domain_key: provider.domainKey,
        p_references: payload,
      });
      if (error) {
        uncertainties.push(`provider_reconciliation_failed:${provider.domainKey}:${error.code ?? "unknown"}`);
        continue;
      }
      synchronizedProviderCount += 1;
    } catch (error) {
      uncertainties.push(
        error instanceof Error ? error.message : `provider_reconciliation_failed:${provider.domainKey}:unknown`,
      );
    }
  }

  if (!options.dryRun) {
    const state = uncertainties.length ? "uncertain" : "synced";
    const { error: assetStateError } = await getSupabaseAdmin()
      .from("media_assets")
      .update({ reconciliation_state: state })
      .neq("status", "deleted")
      .eq("missing_object", false);
    if (assetStateError) uncertainties.push(`asset_reconciliation_state_failed:${assetStateError.code ?? "unknown"}`);

    await setMediaCatalogRuntimeState({
      state: uncertainties.length ? "uncertain" : "synced",
      providerRegistryVersion: MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION,
      lastCatalogSync: new Date().toISOString(),
      lastDryRun: null,
      warnings: [...new Set(uncertainties)].slice(-30),
    });
  }

  return {
    dryRun: options.dryRun === true,
    providerCount: MEDIA_REFERENCE_PROVIDER_REGISTRY.length,
    synchronizedProviderCount,
    discoveredReferenceCount,
    assetCount: assetMap.size,
    uncertainties: [...new Set(uncertainties)],
    complete: uncertainties.length === 0,
  };
}

export async function rebindAllSupportedMediaReferences(
  previousAsset: MediaCatalogAsset,
  nextAsset: MediaCatalogAsset,
) {
  const persisted = await listCatalogReferences(previousAsset.id);
  const runtimeState = await getMediaCatalogRuntimeState();
  if (
    runtimeState.state !== "synced" ||
    runtimeState.providerRegistryVersion !== MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION
  ) {
    return {
      ok: false as const,
      code: "media_reference_rebind_catalog_uncertain",
      references: persisted,
      appliedCount: 0,
      compensationFailures: [],
    };
  }
  const live = await scanAllMediaReferenceProviders();
  if (live.uncertainties.length) {
    return {
      ok: false as const,
      code: "media_reference_rebind_provider_uncertain",
      references: persisted,
      appliedCount: 0,
      compensationFailures: live.uncertainties,
    };
  }
  const identityKey = getCanonicalMediaIdentityKey(previousAsset);
  const liveReferences = live.references.filter(
    (reference) => getCanonicalMediaIdentityKey(reference.identity) === identityKey,
  );
  const persistedKeys = new Set(persisted.map((reference) => `${reference.domainKey}:${reference.entityIdentity}:${reference.fieldKey}`));
  const liveKeys = new Set(liveReferences.map((reference) => `${reference.domainKey}:${reference.entityIdentity}:${reference.fieldKey}`));
  if (persistedKeys.size !== liveKeys.size || [...persistedKeys].some((key) => !liveKeys.has(key))) {
    return {
      ok: false as const,
      code: "media_reference_rebind_drift",
      references: persisted,
      appliedCount: 0,
      compensationFailures: [],
    };
  }
  const unsupported = persisted.filter((reference) => {
    const provider = getMediaReferenceProvider(reference.domainKey);
    return !provider || !provider.supportsRebind;
  });
  if (unsupported.length) {
    return {
      ok: false as const,
      code: "unsupported_media_references",
      references: unsupported,
      appliedCount: 0,
      compensationFailures: [],
    };
  }

  const applied: Array<{ reference: (typeof persisted)[number]; providerKey: string }> = [];
  const compensationFailures: string[] = [];
  try {
    for (const reference of persisted) {
      const provider = getMediaReferenceProvider(reference.domainKey)!;
      const discovered: DiscoveredMediaReference = {
        identity: previousAsset,
        publicValue: previousAsset.publicUrl,
        domainKey: reference.domainKey,
        entityType: reference.entityType,
        entityIdentity: reference.entityIdentity,
        entityLabel: reference.entityLabel,
        fieldKey: reference.fieldKey,
        editHref: reference.editHref,
        publicHref: reference.publicHref,
        referenceState: reference.referenceState,
        restorable: reference.restorable,
      };
      await provider.rebind(discovered, nextAsset.publicUrl);
      applied.push({ reference, providerKey: provider.domainKey });
    }

    const entities = new Set(applied.map(({ reference }) => `${reference.domainKey}:${reference.entityIdentity}`));
    for (const entity of entities) {
      const separator = entity.indexOf(":");
      await syncMediaReferencesForEntity(entity.slice(0, separator), entity.slice(separator + 1));
    }

    return {
      ok: true as const,
      appliedCount: applied.length,
      previousReferenceCount: persisted.length,
      previousAssetRetained: true,
    };
  } catch (error) {
    for (const appliedReference of [...applied].reverse()) {
      const provider = getMediaReferenceProvider(appliedReference.providerKey);
      if (!provider) {
        compensationFailures.push(`missing_provider:${appliedReference.providerKey}`);
        continue;
      }
      try {
        await provider.rebind(
          {
            identity: nextAsset,
            publicValue: nextAsset.publicUrl,
            domainKey: appliedReference.reference.domainKey,
            entityType: appliedReference.reference.entityType,
            entityIdentity: appliedReference.reference.entityIdentity,
            entityLabel: appliedReference.reference.entityLabel,
            fieldKey: appliedReference.reference.fieldKey,
            editHref: appliedReference.reference.editHref,
            publicHref: appliedReference.reference.publicHref,
            referenceState: appliedReference.reference.referenceState,
            restorable: appliedReference.reference.restorable,
          },
          previousAsset.publicUrl,
        );
      } catch {
        compensationFailures.push(
          `compensation_failed:${appliedReference.reference.domainKey}:${appliedReference.reference.entityIdentity}`,
        );
      }
    }
    const warning = error instanceof Error ? error.message : "media_reference_rebind_failed";
    await markRuntimeUncertain([warning, ...compensationFailures]);
    return {
      ok: false as const,
      code: "media_reference_rebind_failed",
      references: persisted,
      appliedCount: applied.length,
      compensationFailures,
    };
  }
}
