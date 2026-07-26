import "server-only";

import {
  buildMediaReferenceSynchronizationWarning,
  type MediaReferenceSynchronizationResult,
} from "./reference-sync-contract";
import {
  acquireMediaReferenceWriteLease,
  completeMediaReferenceWriteLease,
  failMediaReferenceWriteLease,
  type MediaReferenceWriteLease,
  type MediaReferenceWriteScope,
} from "./write-lease";
import { buildMediaReferenceWriteScope } from "./reference-providers";
import {
  markMediaCatalogRuntimeUncertain,
  synchronizeMediaReferencesAfterDomainMutation,
} from "./synchronization";

function errorReason(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function markCoordinationRuntimeUncertain(reasons: string[]) {
  const normalizedReasons = [...new Set(reasons.map((reason) => reason.trim()).filter(Boolean))];
  if (normalizedReasons.length === 0) return null;
  try {
    await markMediaCatalogRuntimeUncertain(normalizedReasons);
    return null;
  } catch (error) {
    const failure = `media_catalog_runtime_uncertain_mark_failed:${errorReason(error, "unknown")}`;
    console.error("Media coordination could not persist the uncertain runtime state", {
      reasons: normalizedReasons,
      failure,
    });
    return failure;
  }
}

/**
 * Marks a composite mutation failure that happened after at least one domain
 * write committed. Recovery must retain the lease until reconciliation proves
 * the final domain/reference state.
 */
export class MediaDomainMutationError extends Error {
  readonly domainWriteCommitted: boolean;

  constructor(message: string, domainWriteCommitted: boolean, options?: ErrorOptions) {
    super(message, options);
    this.name = "MediaDomainMutationError";
    this.domainWriteCommitted = domainWriteCommitted;
  }
}

export type CoordinatedMediaDomainMutationResult<TResult> = {
  value: TResult;
  mediaSynchronization: MediaReferenceSynchronizationResult;
  lease: MediaReferenceWriteLease | null;
};

export async function coordinateMediaReferenceDomainMutation<TResult>(input: {
  scopes: readonly MediaReferenceWriteScope[];
  actorId?: number | null;
  requestIdentity: string;
  mutate: () => Promise<TResult>;
  resolveEntityIdentity?: (value: TResult) => string;
  synchronize: (input: {
    value: TResult;
    leaseToken: string | null;
  }) => Promise<MediaReferenceSynchronizationResult>;
}): Promise<CoordinatedMediaDomainMutationResult<TResult>> {
  const lease = await acquireMediaReferenceWriteLease({
    scopes: input.scopes,
    actorId: input.actorId,
    requestIdentity: input.requestIdentity,
  });

  let value: TResult;
  try {
    value = await input.mutate();
  } catch (error) {
    const domainWriteCommitted =
      error instanceof MediaDomainMutationError
        ? error.domainWriteCommitted
        : false;
    let leaseFailureReason: string | null = null;
    if (lease) {
      try {
        await failMediaReferenceWriteLease({
          lease,
          failureCode: "media_domain_write_failed",
          reasons: [errorReason(error, "media_domain_write_failed")],
          domainWriteCommitted,
        });
      } catch (leaseFailure) {
        leaseFailureReason = `media_write_lease_failure_record_failed:${errorReason(leaseFailure, "unknown")}`;
        console.error("Media write lease could not record the domain mutation failure", {
          code: errorReason(leaseFailure, "media_write_lease_failure_record_failed"),
        });
      }
    }
    const uncertaintyReasons = [
      ...(domainWriteCommitted
        ? [`media_domain_write_failed_after_commit:${errorReason(error, "media_domain_write_failed")}`]
        : []),
      ...(leaseFailureReason ? [leaseFailureReason] : []),
    ];
    const runtimeMarkFailure = uncertaintyReasons.length > 0
      ? await markCoordinationRuntimeUncertain(uncertaintyReasons)
      : null;
    if (runtimeMarkFailure) {
      throw new MediaDomainMutationError(
        `${errorReason(error, "media_domain_write_failed")}; ${runtimeMarkFailure}`,
        domainWriteCommitted,
        { cause: error },
      );
    }
    throw error;
  }

  const entityIdentity = input.resolveEntityIdentity?.(value) ?? lease?.primaryEntityIdentity ?? "unknown";
  let synchronization: MediaReferenceSynchronizationResult;
  try {
    synchronization = await input.synchronize({
      value,
      leaseToken: lease?.token ?? null,
    });
  } catch (error) {
    synchronization = buildMediaReferenceSynchronizationWarning({
      domainKey: input.scopes.map((scope) => scope.domainKey).join(","),
      entityIdentity,
      failureReason: errorReason(error, "media_reference_sync_failed"),
      uncertainties: [errorReason(error, "media_reference_sync_failed")],
    });
  }

  if (synchronization.status === "saved_with_media_sync_warning") {
    const runtimeMarkFailure = await markCoordinationRuntimeUncertain([
      synchronization.code,
      ...(synchronization.uncertainties.length
        ? synchronization.uncertainties
        : [synchronization.failureReason ?? "media_reference_sync_failed"]),
    ]);
    if (runtimeMarkFailure) {
      synchronization = buildMediaReferenceSynchronizationWarning({
        domainKey: synchronization.domainKey,
        entityIdentity,
        failureReason: synchronization.failureReason ?? "تعذر إثبات اكتمال مزامنة الميديا.",
        uncertainties: [...synchronization.uncertainties, runtimeMarkFailure],
      });
    }
    if (!lease) return { value, mediaSynchronization: synchronization, lease: null };

    try {
      await failMediaReferenceWriteLease({
        lease,
        entityIdentity: lease.primaryEntityIdentity,
        failureCode: synchronization.code,
        reasons: synchronization.uncertainties.length
          ? synchronization.uncertainties
          : [synchronization.failureReason ?? "media_reference_sync_failed"],
        domainWriteCommitted: true,
      });
    } catch (leaseFailure) {
      const leaseFailureReason = `media_write_lease_failure_record_failed:${errorReason(leaseFailure, "unknown")}`;
      const leaseFailureRuntimeMarkFailure = await markCoordinationRuntimeUncertain([
        leaseFailureReason,
      ]);
      synchronization = buildMediaReferenceSynchronizationWarning({
        domainKey: synchronization.domainKey,
        entityIdentity,
        failureReason: synchronization.failureReason ?? "تعذر إثبات اكتمال مزامنة الميديا.",
        uncertainties: [
          ...synchronization.uncertainties,
          leaseFailureReason,
          ...(leaseFailureRuntimeMarkFailure ? [leaseFailureRuntimeMarkFailure] : []),
        ],
      });
    }
    return { value, mediaSynchronization: synchronization, lease };
  }

  if (!lease) return { value, mediaSynchronization: synchronization, lease: null };

  try {
    await completeMediaReferenceWriteLease(lease, lease.primaryEntityIdentity);
    return { value, mediaSynchronization: synchronization, lease };
  } catch (completionError) {
    const reason = errorReason(completionError, "media_write_lease_completion_failed");
    const completionUncertainty = `media_write_lease_completion_failed:${reason}`;
    const runtimeMarkFailure = await markCoordinationRuntimeUncertain([
      completionUncertainty,
    ]);
    let leaseFailureReason: string | null = null;
    let leaseFailureRuntimeMarkFailure: string | null = null;
    try {
      await failMediaReferenceWriteLease({
        lease,
        entityIdentity: lease.primaryEntityIdentity,
        failureCode: "media_write_lease_completion_failed",
        reasons: [reason],
        domainWriteCommitted: true,
      });
    } catch (leaseFailure) {
      leaseFailureReason = `media_write_lease_failure_record_failed:${errorReason(leaseFailure, "unknown")}`;
      leaseFailureRuntimeMarkFailure = await markCoordinationRuntimeUncertain([
        leaseFailureReason,
      ]);
      console.error("Media write lease completion and failure recording both failed", {
        completion: reason,
        failure: errorReason(leaseFailure, "unknown"),
      });
    }
    return {
      value,
      lease,
      mediaSynchronization: buildMediaReferenceSynchronizationWarning({
        domainKey: synchronization.domainKey,
        entityIdentity,
        failureReason: "تم حفظ البيانات والمراجع، لكن تعذر إنهاء حجز الميديا. يلزم فحص قبل الحذف.",
        uncertainties: [
          completionUncertainty,
          ...(runtimeMarkFailure ? [runtimeMarkFailure] : []),
          ...(leaseFailureReason ? [leaseFailureReason] : []),
          ...(leaseFailureRuntimeMarkFailure ? [leaseFailureRuntimeMarkFailure] : []),
        ],
      }),
    };
  }
}

export async function coordinateMediaReferenceEntityMutation<TResult>(input: {
  domainKey: string;
  leaseEntityIdentity: string;
  intendedRow: Record<string, unknown>;
  actorId?: number | null;
  requestIdentity: string;
  mutate: () => Promise<TResult>;
  resolveEntityIdentity: (value: TResult) => string;
}) {
  const scope = buildMediaReferenceWriteScope(
    input.domainKey,
    input.leaseEntityIdentity,
    input.intendedRow,
  );
  return coordinateMediaReferenceDomainMutation({
    scopes: [scope],
    actorId: input.actorId,
    requestIdentity: input.requestIdentity,
    mutate: input.mutate,
    resolveEntityIdentity: input.resolveEntityIdentity,
    synchronize: ({ value, leaseToken }) =>
      synchronizeMediaReferencesAfterDomainMutation(
        input.domainKey,
        input.resolveEntityIdentity(value),
        {
          leaseToken,
          leaseEntityIdentity: input.leaseEntityIdentity,
        },
      ),
  });
}
