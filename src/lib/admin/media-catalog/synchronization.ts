import "server-only";

import { getSupabaseAdmin } from "../../supabase-admin";
import { resolveMediaStorageRuntimeContext } from "../media-storage-adapter";
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
  MediaReferenceProviderRebindError,
  scanAllMediaReferenceProviders,
  validateMediaReferenceProviderRegistry,
  type DiscoveredMediaReference,
} from "./reference-providers";
import type { MediaCatalogAsset } from "./types";
import {
  buildMediaReferenceSynchronizationWarning,
  type MediaReferenceSynchronizationResult,
} from "./reference-sync-contract";
import {
  acquireMediaReferenceWriteLease,
  completeMediaReferenceWriteLease,
  failMediaReferenceWriteLease,
  MediaReferenceWriteLeaseError,
  type MediaReferenceWriteLease,
  type MediaReferenceWriteScope,
} from "./write-lease";

export type { MediaReferenceSynchronizationResult } from "./reference-sync-contract";

export class MediaReferenceSynchronizationError extends Error {
  readonly code: string;
  readonly uncertainties: string[];

  constructor(
    message: string,
    uncertainties: string[],
    code = "media_reference_sync_failed",
  ) {
    super(message);
    this.name = "MediaReferenceSynchronizationError";
    this.code = code;
    this.uncertainties = uncertainties;
  }
}

function synchronizationWarning(input: {
  domainKey: string;
  entityIdentity: string;
  error: unknown;
  uncertainties?: string[];
}): MediaReferenceSynchronizationResult {
  const failureReason = input.error instanceof Error
    ? input.error.message
    : "media_reference_sync_failed";
  const uncertainties = input.error instanceof MediaReferenceSynchronizationError
    ? input.error.uncertainties
    : input.uncertainties ?? [failureReason];
  return buildMediaReferenceSynchronizationWarning({
    domainKey: input.domainKey,
    entityIdentity: input.entityIdentity,
    failureReason,
    uncertainties: [...new Set(uncertainties)],
  });
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

async function getMediaReferenceProviderRevision(domainKey: string) {
  const { data, error } = await getSupabaseAdmin().rpc(
    "get_media_reference_provider_revision",
    { p_domain_key: domainKey },
  );
  if (error) {
    throw new Error(
      `media_reference_provider_revision_read_failed:${domainKey}:${error.code ?? "unknown"}`,
    );
  }
  const revision = typeof data === "number" ? data : Number(data);
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new Error(`media_reference_provider_revision_invalid:${domainKey}`);
  }
  return revision;
}

export async function markMediaCatalogRuntimeUncertain(warnings: string[]) {
  const context = resolveMediaStorageRuntimeContext();
  let current: MediaCatalogRuntimeState = {
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
  try {
    current = await getMediaCatalogRuntimeState();
  } catch {}
  await setMediaCatalogRuntimeState({
    ...current,
    state: "uncertain",
    provider: context.provider,
    environment: context.environment,
    environmentKey: context.identity,
    providerRegistryVersion: MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION,
    warnings: [...new Set([...current.warnings, ...warnings])].slice(-30),
  });
}

export async function syncMediaReferencesForEntity(
  domainKey: string,
  entityIdentity: string,
  options: { leaseToken?: string | null; leaseEntityIdentity?: string | null } = {},
) {
  const provider = getMediaReferenceProvider(domainKey);
  if (!provider) {
    const warning = `missing_media_reference_provider:${domainKey}`;
    await markMediaCatalogRuntimeUncertain([warning]);
    throw new MediaReferenceSynchronizationError("مالك مراجع الوسائط المطلوب غير مسجل.", [warning]);
  }

  let references: DiscoveredMediaReference[];
  let assetMap: Map<string, MediaCatalogAsset>;
  try {
    [references, assetMap] = await Promise.all([
      provider.scanEntity(entityIdentity),
      getAllCatalogAssetIdentityMap(),
    ]);
  } catch (error) {
    const warning = `media_reference_entity_scan_failed:${provider.domainKey}:${entityIdentity}`;
    await markMediaCatalogRuntimeUncertain([
      warning,
      error instanceof Error ? error.message : "media_reference_entity_scan_failed",
    ]);
    throw new MediaReferenceSynchronizationError(
      "تعذر إثبات حالة مراجع الوسائط بعد الحفظ. تم إيقاف الحذف الآمن حتى اكتمال الفحص.",
      [warning],
    );
  }
  const missing = references
    .filter((reference) => !assetMap.has(getCanonicalMediaIdentityKey(reference.identity)))
    .map((reference) => `catalog_asset_missing:${provider.domainKey}:${reference.entityIdentity}:${reference.fieldKey}`);
  if (missing.length) {
    await markMediaCatalogRuntimeUncertain(missing);
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
    p_lease_token: options.leaseToken ?? null,
    p_lease_entity_identity: options.leaseEntityIdentity ?? entityIdentity,
  });
  if (error) {
    const warning = `media_reference_sync_rpc_failed:${provider.domainKey}:${error.code ?? "unknown"}`;
    await markMediaCatalogRuntimeUncertain([warning]);
    throw new MediaReferenceSynchronizationError(
      "تعذر مزامنة مراجع الوسائط. تم منع الحذف حتى reconciliation.",
      [warning],
    );
  }

  return {
    domainKey,
    entityIdentity,
    referenceCount: payload.length,
    explicitEmpty: payload.length === 0,
  };
}

export async function synchronizeMediaReferencesAfterDomainMutation(
  domainKey: string,
  entityIdentity: string | number,
  options: { leaseToken?: string | null; leaseEntityIdentity?: string | null } = {},
) {
  try {
    const result = await syncMediaReferencesForEntity(domainKey, String(entityIdentity), options);
    return {
      status: "synced" as const,
      code: "media_reference_sync_succeeded" as const,
      domainKey: result.domainKey,
      entityIdentity: result.entityIdentity,
      failureReason: null,
      requiresReconciliation: false,
      mediaSynchronizationState: "synced" as const,
      referenceCount: result.referenceCount,
      explicitEmpty: result.explicitEmpty,
      uncertainties: [],
    } satisfies MediaReferenceSynchronizationResult;
  } catch (error) {
    const warning = synchronizationWarning({
      domainKey,
      entityIdentity: String(entityIdentity),
      error,
    });
    console.error("Media reference synchronization requires reconciliation", {
      domainKey: warning.domainKey,
      entityIdentity: warning.entityIdentity,
      code: error instanceof Error && "code" in error ? error.code : "media_reference_sync_failed",
      failureReason: warning.failureReason,
    });
    return warning;
  }
}

export async function synchronizeMediaReferenceWriteScopesAfterDomainMutation(
  targets: readonly {
    domainKey: string;
    entityIdentity: string | number;
    leaseEntityIdentity: string;
  }[],
  leaseToken: string | null,
  cleanupTargets: readonly {
    domainKey: string;
    entityIdentity: string | number;
  }[] = [],
) {
  const [writeResults, cleanupResults] = await Promise.all([
    Promise.all(
      targets.map((target) =>
        synchronizeMediaReferencesAfterDomainMutation(
          target.domainKey,
          target.entityIdentity,
          {
            leaseToken,
            leaseEntityIdentity: target.leaseEntityIdentity,
          },
        ),
      ),
    ),
    Promise.all(
      cleanupTargets.map((target) =>
        synchronizeMediaReferencesAfterDomainMutation(
          target.domainKey,
          target.entityIdentity,
        ),
      ),
    ),
  ]);
  const results = [...writeResults, ...cleanupResults];
  const allTargets = [...targets, ...cleanupTargets];
  const nonEmptyCleanupWarnings = cleanupResults.flatMap((result) =>
    result.status === "synced" && result.explicitEmpty !== true
      ? [`media_reference_cleanup_not_explicit_empty:${result.domainKey}:${result.entityIdentity}`]
      : [],
  );
  const failedCleanupWarnings = cleanupResults.flatMap((result) =>
    result.status === "saved_with_media_sync_warning"
      ? (result.uncertainties.length > 0
          ? result.uncertainties
          : [result.failureReason ?? result.code])
      : [],
  );
  const cleanupRuntimeWarnings = [
    ...nonEmptyCleanupWarnings,
    ...failedCleanupWarnings,
  ];
  let cleanupRuntimeMarkFailure: string | null = null;
  if (cleanupRuntimeWarnings.length > 0) {
    try {
      await markMediaCatalogRuntimeUncertain(cleanupRuntimeWarnings);
    } catch (error) {
      cleanupRuntimeMarkFailure = `media_catalog_runtime_uncertain_mark_failed:${error instanceof Error ? error.message : "unknown"}`;
      console.error("Media cleanup could not persist the uncertain runtime state", {
        warnings: cleanupRuntimeWarnings,
        failure: cleanupRuntimeMarkFailure,
      });
    }
  }
  const warning = results.find(
    (result) => result.status === "saved_with_media_sync_warning",
  );
  if (warning || nonEmptyCleanupWarnings.length > 0) {
    return buildMediaReferenceSynchronizationWarning({
      domainKey: allTargets.map((target) => target.domainKey).join(","),
      entityIdentity: allTargets.map((target) => String(target.entityIdentity)).join(","),
      failureReason: warning?.failureReason ?? "تعذر إثبات إزالة جميع مراجع الميديا بعد الحذف.",
      uncertainties: [
        ...results.flatMap((result) => result.uncertainties),
        ...nonEmptyCleanupWarnings,
        ...failedCleanupWarnings,
        ...(cleanupRuntimeMarkFailure ? [cleanupRuntimeMarkFailure] : []),
      ],
    });
  }
  return {
    status: "synced" as const,
    code: "media_reference_sync_succeeded" as const,
    domainKey: allTargets.map((target) => target.domainKey).join(","),
    entityIdentity: allTargets.map((target) => String(target.entityIdentity)).join(","),
    failureReason: null,
    requiresReconciliation: false,
    mediaSynchronizationState: "synced" as const,
    referenceCount: results.reduce((sum, result) => sum + (result.referenceCount ?? 0), 0),
    explicitEmpty: results.every((result) => result.explicitEmpty === true),
    uncertainties: [],
  } satisfies MediaReferenceSynchronizationResult;
}

export async function reconcileAllMediaReferences(options: {
  dryRun?: boolean;
  assetMap?: Map<string, MediaCatalogAsset>;
  runIdentity?: string;
} = {}) {
  validateMediaReferenceProviderRegistry();
  const assetMap = options.assetMap ?? await getAllCatalogAssetIdentityMap();
  const uncertainties: string[] = [];
  const runIdentity = options.runIdentity ?? crypto.randomUUID();
  let discoveredReferenceCount = 0;
  let scannedProviderCount = 0;
  let synchronizedProviderCount = 0;

  for (const provider of MEDIA_REFERENCE_PROVIDER_REGISTRY) {
    try {
      const expectedProviderRevision = await getMediaReferenceProviderRevision(
        provider.domainKey,
      );
      const references = await provider.scanAll();
      scannedProviderCount += 1;
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
        p_reconciliation_run_identity: runIdentity,
        p_expected_provider_revision: expectedProviderRevision,
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

  return {
    dryRun: options.dryRun === true,
    providerCount: MEDIA_REFERENCE_PROVIDER_REGISTRY.length,
    scannedProviderCount,
    synchronizedProviderCount,
    discoveredReferenceCount,
    assetCount: assetMap.size,
    uncertainties: [...new Set(uncertainties)],
    complete: uncertainties.length === 0,
    runIdentity,
  };
}

export async function rebindAllSupportedMediaReferences(
  previousAsset: MediaCatalogAsset,
  nextAsset: MediaCatalogAsset,
  options: {
    actorId?: number | null;
    requestIdentity?: string;
    externalLease?: MediaReferenceWriteLease;
    synchronizationTargets?: readonly {
      domainKey: string;
      entityIdentity: string;
      leaseEntityIdentity: string;
    }[];
  } = {},
) {
  const persisted = await listCatalogReferences(previousAsset.id);
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
    return {
      ok: false as const,
      code: "media_reference_rebind_catalog_uncertain",
      nextAssetRequired: false,
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
      nextAssetRequired: false,
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
      nextAssetRequired: false,
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
      nextAssetRequired: false,
      references: unsupported,
      appliedCount: 0,
      compensationFailures: [],
    };
  }

  const entityGroups = new Map<string, DiscoveredMediaReference[]>();
  for (const reference of live.references) {
    const key = `${reference.domainKey}\u0000${reference.entityType}\u0000${reference.entityIdentity}`;
    entityGroups.set(key, [...(entityGroups.get(key) ?? []), reference]);
  }
  const affectedEntityKeys = new Set(
    persisted.map(
      (reference) => `${reference.domainKey}\u0000${reference.entityType}\u0000${reference.entityIdentity}`,
    ),
  );
  const scopes: MediaReferenceWriteScope[] = [...affectedEntityKeys].map((key) => {
    const [domainKey, entityType, entityIdentity] = key.split("\u0000");
    const references = entityGroups.get(key) ?? [];
    return {
      domainKey,
      entityType,
      entityIdentity,
      values: references.map((reference) =>
        getCanonicalMediaIdentityKey(reference.identity) === identityKey
          ? nextAsset.publicUrl
          : reference.publicValue,
      ),
    };
  });

  const ownsLease = !options.externalLease;
  let lease = options.externalLease;
  if (!lease) {
    try {
      lease = await acquireMediaReferenceWriteLease({
        scopes,
        actorId: options.actorId,
        requestIdentity:
          options.requestIdentity?.trim() ||
          `media-rebind:${previousAsset.id}:${nextAsset.id}`,
      }) ?? undefined;
    } catch (error) {
      return {
        ok: false as const,
        code: "media_reference_rebind_write_lease_failed",
        nextAssetRequired: false,
        references: persisted,
        appliedCount: 0,
        compensationFailures: [
          error instanceof MediaReferenceWriteLeaseError
            ? error.code
            : error instanceof Error
              ? error.message
              : "media_reference_rebind_write_lease_failed",
        ],
      };
    }
  }

  const applied: Array<{ reference: (typeof persisted)[number]; providerKey: string }> = [];
  const domainCompensationFailures: string[] = [];
  const coordinationFailures: string[] = [];
  let attemptedReference: { reference: (typeof persisted)[number]; providerKey: string } | null = null;
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
      attemptedReference = { reference, providerKey: provider.domainKey };
      await provider.rebind(discovered, nextAsset.publicUrl);
      applied.push(attemptedReference);
      attemptedReference = null;
    }
  } catch (error) {
    if (
      attemptedReference &&
      error instanceof MediaReferenceProviderRebindError &&
      error.writeMayHaveCommitted
    ) {
      applied.push(attemptedReference);
    }
    for (const appliedReference of [...applied].reverse()) {
      const provider = getMediaReferenceProvider(appliedReference.providerKey);
      if (!provider) {
        domainCompensationFailures.push(`missing_provider:${appliedReference.providerKey}`);
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
      } catch (compensationError) {
        try {
          const observed = await provider.scanEntity(appliedReference.reference.entityIdentity);
          const stillUsesNext = observed.some(
            (reference) =>
              reference.fieldKey === appliedReference.reference.fieldKey &&
              getCanonicalMediaIdentityKey(reference.identity) ===
                getCanonicalMediaIdentityKey(nextAsset),
          );
          if (!stillUsesNext) continue;
        } catch {}
        domainCompensationFailures.push(
          `compensation_failed:${appliedReference.reference.domainKey}:${appliedReference.reference.entityIdentity}:${compensationError instanceof Error ? compensationError.message : "unknown"}`,
        );
      }
    }
    const warning = error instanceof Error ? error.message : "media_reference_rebind_failed";
    if (lease && ownsLease) {
      try {
        await failMediaReferenceWriteLease({
          lease,
          failureCode: "media_reference_rebind_failed",
          reasons: [warning, ...domainCompensationFailures],
          domainWriteCommitted: domainCompensationFailures.length > 0,
        });
      } catch (leaseFailure) {
        coordinationFailures.push(
          `media_rebind_lease_failure_record_failed:${leaseFailure instanceof Error ? leaseFailure.message : "unknown"}`,
        );
      }
    }
    if (domainCompensationFailures.length) {
      await markMediaCatalogRuntimeUncertain([warning, ...domainCompensationFailures, ...coordinationFailures]);
    }
    return {
      ok: false as const,
      code: "media_reference_rebind_failed",
      nextAssetRequired: domainCompensationFailures.length > 0,
      references: persisted,
      appliedCount: applied.length,
      compensationFailures: [...domainCompensationFailures, ...coordinationFailures],
    };
  }

  const synchronization = await synchronizeMediaReferenceWriteScopesAfterDomainMutation(
    options.synchronizationTargets ?? scopes.map((scope) => ({
        domainKey: scope.domainKey,
        entityIdentity: scope.entityIdentity,
        leaseEntityIdentity: scope.entityIdentity,
      })),
    lease?.token ?? null,
  );
  if (synchronization.status === "saved_with_media_sync_warning") {
    if (lease && ownsLease) {
      try {
        await failMediaReferenceWriteLease({
          lease,
          failureCode: synchronization.code,
          reasons: synchronization.uncertainties,
          domainWriteCommitted: true,
        });
      } catch (leaseFailure) {
        coordinationFailures.push(
          `media_rebind_lease_failure_record_failed:${leaseFailure instanceof Error ? leaseFailure.message : "unknown"}`,
        );
      }
    }
    return {
      ok: false as const,
      code: "media_reference_rebind_sync_failed",
      nextAssetRequired: true,
      references: persisted,
      appliedCount: applied.length,
      compensationFailures: [
        ...synchronization.uncertainties,
        ...coordinationFailures,
      ],
    };
  }

  if (lease && ownsLease) {
    try {
      await completeMediaReferenceWriteLease(lease);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "media_rebind_lease_completion_failed";
      await failMediaReferenceWriteLease({
        lease,
        failureCode: "media_rebind_lease_completion_failed",
        reasons: [reason],
        domainWriteCommitted: true,
      }).catch(() => undefined);
      await markMediaCatalogRuntimeUncertain([reason]);
      return {
        ok: false as const,
        code: "media_reference_rebind_lease_completion_failed",
        nextAssetRequired: true,
        references: persisted,
        appliedCount: applied.length,
        compensationFailures: [reason],
      };
    }
  }

  return {
    ok: true as const,
    nextAssetRequired: true,
    appliedCount: applied.length,
    previousReferenceCount: persisted.length,
    previousAssetRetained: true,
  };
}
