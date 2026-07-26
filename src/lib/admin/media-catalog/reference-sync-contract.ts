export type MediaReferenceSynchronizationResult = {
  status: "synced" | "saved_with_media_sync_warning";
  code: "media_reference_sync_succeeded" | "media_reference_sync_failed";
  domainKey: string;
  entityIdentity: string;
  failureReason: string | null;
  requiresReconciliation: boolean;
  mediaSynchronizationState: "synced" | "uncertain";
  referenceCount?: number;
  explicitEmpty?: boolean;
  uncertainties: string[];
};

export function buildMediaReferenceSynchronizationWarning(input: {
  domainKey: string;
  entityIdentity: string;
  failureReason: string;
  uncertainties: string[];
}): MediaReferenceSynchronizationResult {
  return {
    status: "saved_with_media_sync_warning",
    code: "media_reference_sync_failed",
    domainKey: input.domainKey,
    entityIdentity: input.entityIdentity,
    failureReason: input.failureReason,
    requiresReconciliation: true,
    mediaSynchronizationState: "uncertain",
    uncertainties: [...new Set(input.uncertainties)],
  };
}
