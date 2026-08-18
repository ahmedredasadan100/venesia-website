import "server-only";

import {
  coordinateMediaReferenceDomainMutation,
  type CoordinatedMediaDomainMutationResult,
} from "../media-catalog/domain-write-coordination";
import { buildMediaReferenceWriteScope } from "../media-catalog/reference-providers";
import { synchronizeMediaReferenceWriteScopesAfterDomainMutation } from "../media-catalog/synchronization";
import { getSupabaseAdmin } from "../../supabase-admin";
import type { TrackingMediaAdminRow } from "./tracking-contract";

export type IntendedTrackingMedia = Pick<
  TrackingMediaAdminRow,
  "client_key" | "media_kind" | "public_url" | "poster_url" | "title" | "sort_order"
>;

type SavedTrackingUpdate = {
  id: number;
  media: TrackingMediaAdminRow[];
};

type ExistingAssociation = { id: number; client_key: string };

async function loadExistingAssociations(updateId: number | null) {
  if (!updateId) return [] satisfies ExistingAssociation[];
  const { data, error } = await getSupabaseAdmin()
    .from("project_tracking_update_media")
    .select("id,client_key")
    .eq("update_id", updateId);
  if (error) throw new Error(`project_tracking_media_preflight_failed:${error.code ?? "query_failed"}`);
  return data ?? [];
}

export async function coordinateTrackingUpdateSave(input: {
  actorId: number;
  updateId: number | null;
  intendedMedia: IntendedTrackingMedia[];
  mutate: () => Promise<SavedTrackingUpdate>;
}): Promise<CoordinatedMediaDomainMutationResult<SavedTrackingUpdate>> {
  const operationId = crypto.randomUUID();
  const existing = await loadExistingAssociations(input.updateId);
  const intended = input.intendedMedia.map((media) => ({
    clientKey: media.client_key,
    leaseIdentity: `project-tracking-media:${operationId}:${media.client_key}`,
    row: { public_url: media.public_url, poster_url: media.poster_url },
  }));
  const scopes = intended.map((media) =>
    buildMediaReferenceWriteScope(
      "project_tracking_update_media",
      media.leaseIdentity,
      media.row,
    ),
  );

  return coordinateMediaReferenceDomainMutation({
    scopes,
    actorId: input.actorId,
    requestIdentity: `project-tracking-update:${operationId}`,
    mutate: input.mutate,
    resolveEntityIdentity: (saved) => String(saved.id),
    synchronize: ({ value, leaseToken }) => {
      const persistedByKey = new Map(value.media.map((media) => [media.client_key, media]));
      const targets = intended.map((media) => {
        const persisted = persistedByKey.get(media.clientKey);
        if (!persisted) throw new Error(`project_tracking_media_identity_mapping_incomplete:${media.clientKey}`);
        return {
          domainKey: "project_tracking_update_media",
          entityIdentity: String(persisted.id),
          leaseEntityIdentity: media.leaseIdentity,
        };
      });
      const intendedKeys = new Set(intended.map((media) => media.clientKey));
      const cleanupTargets = existing
        .filter((association) => !intendedKeys.has(association.client_key))
        .map((association) => ({
          domainKey: "project_tracking_update_media",
          entityIdentity: String(association.id),
        }));
      return synchronizeMediaReferenceWriteScopesAfterDomainMutation(
        targets,
        leaseToken,
        cleanupTargets,
      );
    },
  });
}

export async function cleanupDeletedTrackingUpdateMedia(
  associations: readonly ExistingAssociation[],
) {
  return synchronizeMediaReferenceWriteScopesAfterDomainMutation(
    [],
    null,
    associations.map((association) => ({
      domainKey: "project_tracking_update_media",
      entityIdentity: String(association.id),
    })),
  );
}
