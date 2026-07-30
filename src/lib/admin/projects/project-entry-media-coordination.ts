import "server-only";

import {
  coordinateMediaReferenceDomainMutation,
  type CoordinatedMediaDomainMutationResult,
} from "../media-catalog/domain-write-coordination";
import { buildMediaReferenceWriteScope } from "../media-catalog/reference-providers";
import { synchronizeMediaReferenceWriteScopesAfterDomainMutation } from "../media-catalog/synchronization";
import { getSupabaseAdmin } from "../../supabase-admin";
import type { ProjectEntryPayload } from "./project-entry-contract";

type SavedProjectIdentity = {
  id: number;
  slug: string;
  updatedAt: string;
};

type MediaChildDomainKey =
  | "project_floor_plans"
  | "project_media"
  | "project_videos";

type ExistingMediaChild = {
  domainKey: MediaChildDomainKey;
  id: number;
  clientKey: string;
};

type IntendedMediaChild = {
  domainKey: MediaChildDomainKey;
  clientKey: string;
  leaseEntityIdentity: string;
  row: Record<string, unknown>;
};

async function loadExistingMediaChildren(projectId: number | null) {
  if (!projectId) return [] satisfies ExistingMediaChild[];
  const supabase = getSupabaseAdmin();
  const [plans, media, videos] = await Promise.all([
    supabase
      .from("project_floor_plans")
      .select("id,client_key")
      .eq("project_id", projectId),
    supabase
      .from("project_media")
      .select("id,client_key")
      .eq("project_id", projectId),
    supabase
      .from("project_videos")
      .select("id,client_key")
      .eq("project_id", projectId),
  ]);
  const error = plans.error ?? media.error ?? videos.error;
  if (error) throw new Error(`project_media_preflight_failed:${error.message}`);

  return [
    ...((plans.data ?? []) as { id: number; client_key: string }[]).map((row) => ({
      domainKey: "project_floor_plans" as const,
      id: row.id,
      clientKey: row.client_key,
    })),
    ...((media.data ?? []) as { id: number; client_key: string }[]).map((row) => ({
      domainKey: "project_media" as const,
      id: row.id,
      clientKey: row.client_key,
    })),
    ...((videos.data ?? []) as { id: number; client_key: string }[]).map((row) => ({
      domainKey: "project_videos" as const,
      id: row.id,
      clientKey: row.client_key,
    })),
  ];
}

function buildIntendedChildren(
  payload: ProjectEntryPayload,
  operationIdentity: string,
): IntendedMediaChild[] {
  return [
    ...payload.floor_plans.map((plan) => ({
      domainKey: "project_floor_plans" as const,
      clientKey: plan.client_key,
      leaseEntityIdentity: `project-plan:${operationIdentity}:${plan.client_key}`,
      row: {
        architectural_image: plan.architectural_image,
        furnishing_image: plan.furnishing_image,
      },
    })),
    ...payload.media.map((item) => ({
      domainKey: "project_media" as const,
      clientKey: item.client_key,
      leaseEntityIdentity: `project-media:${operationIdentity}:${item.client_key}`,
      row: { image: item.image },
    })),
    ...payload.videos.map((video) => ({
      domainKey: "project_videos" as const,
      clientKey: video.client_key,
      leaseEntityIdentity: `project-video:${operationIdentity}:${video.client_key}`,
      row: { poster_image: video.poster_image },
    })),
  ];
}

async function loadPersistedMediaChildren(projectId: number) {
  return loadExistingMediaChildren(projectId);
}

export async function coordinateProjectEntrySave(input: {
  actorId: number;
  projectId: number | null;
  payload: ProjectEntryPayload;
  mutate: () => Promise<SavedProjectIdentity>;
}): Promise<CoordinatedMediaDomainMutationResult<SavedProjectIdentity>> {
  const operationIdentity = crypto.randomUUID();
  const rootLeaseIdentity = input.projectId
    ? String(input.projectId)
    : `project-create:${operationIdentity}`;
  const existingChildren = await loadExistingMediaChildren(input.projectId);
  const intendedChildren = buildIntendedChildren(input.payload, operationIdentity);
  const scopes = [
    buildMediaReferenceWriteScope("projects", rootLeaseIdentity, {
      image: input.payload.project.image,
      hero_image: input.payload.project.hero_image,
      small_box_image: input.payload.project.small_box_image,
      overview_main_image: input.payload.project.overview_main_image,
      og_image: input.payload.project.og_image,
    }),
    ...intendedChildren.map((child) =>
      buildMediaReferenceWriteScope(
        child.domainKey,
        child.leaseEntityIdentity,
        child.row,
      ),
    ),
  ];

  return coordinateMediaReferenceDomainMutation({
    scopes,
    actorId: input.actorId,
    requestIdentity: `project-entry:${operationIdentity}`,
    mutate: input.mutate,
    resolveEntityIdentity: (saved) => String(saved.id),
    synchronize: async ({ value, leaseToken }) => {
      const persistedChildren = await loadPersistedMediaChildren(value.id);
      const persistedByKey = new Map(
        persistedChildren.map((child) => [
          `${child.domainKey}:${child.clientKey}`,
          child,
        ]),
      );
      const targets = [
        {
          domainKey: "projects",
          entityIdentity: String(value.id),
          leaseEntityIdentity: rootLeaseIdentity,
        },
        ...intendedChildren.map((child) => {
          const persisted = persistedByKey.get(
            `${child.domainKey}:${child.clientKey}`,
          );
          if (!persisted) {
            throw new Error(
              `project_media_identity_mapping_incomplete:${child.domainKey}:${child.clientKey}`,
            );
          }
          return {
            domainKey: child.domainKey,
            entityIdentity: String(persisted.id),
            leaseEntityIdentity: child.leaseEntityIdentity,
          };
        }),
      ];
      const explicitlyDeleted = new Set([
        ...input.payload.deleted.floor_plan_ids.map((id) => `project_floor_plans:${id}`),
        ...input.payload.deleted.media_ids.map((id) => `project_media:${id}`),
        ...input.payload.deleted.video_ids.map((id) => `project_videos:${id}`),
      ]);
      const cleanupTargets = existingChildren
        .filter(
          (child) => explicitlyDeleted.has(`${child.domainKey}:${child.id}`),
        )
        .map((child) => ({
          domainKey: child.domainKey,
          entityIdentity: String(child.id),
        }));

      return synchronizeMediaReferenceWriteScopesAfterDomainMutation(
        targets,
        leaseToken,
        cleanupTargets,
      );
    },
  });
}
