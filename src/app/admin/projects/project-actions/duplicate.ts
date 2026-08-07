"use server";

import { z } from "zod";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { buildMediaReferenceSynchronizationWarning } from "../../../../lib/admin/media-catalog/reference-sync-contract";
import { synchronizeMediaReferenceWriteScopesAfterDomainMutation } from "../../../../lib/admin/media-catalog/synchronization";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { withProjectMediaSynchronization } from "./helpers";
import { revalidateProjectPaths } from "./revalidate";

const projectIdSchema = z.number().int().positive();

const duplicateResultSchema = z.object({
  project_id: z.coerce.number().int().positive(),
  project_type: z.enum(["residential", "commercial"]),
  project_slug: z.string().min(1),
  featured: z.boolean(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});

async function synchronizeDuplicatedProjectMedia(projectId: number) {
  const supabase = getSupabaseAdmin();
  const [plans, media, videos] = await Promise.all([
    supabase.from("project_floor_plans").select("id").eq("project_id", projectId),
    supabase.from("project_media").select("id").eq("project_id", projectId),
    supabase.from("project_videos").select("id").eq("project_id", projectId),
  ]);
  const lookupError = plans.error ?? media.error ?? videos.error;
  if (lookupError) {
    return buildMediaReferenceSynchronizationWarning({
      domainKey: "projects",
      entityIdentity: String(projectId),
      failureReason: "project_duplicate_media_identity_lookup_failed",
      uncertainties: [lookupError.message],
    });
  }

  const targets = [
    { domainKey: "projects", entityIdentity: projectId },
    ...(plans.data ?? []).map((row) => ({
      domainKey: "project_floor_plans",
      entityIdentity: Number(row.id),
    })),
    ...(media.data ?? []).map((row) => ({
      domainKey: "project_media",
      entityIdentity: Number(row.id),
    })),
    ...(videos.data ?? []).map((row) => ({
      domainKey: "project_videos",
      entityIdentity: Number(row.id),
    })),
  ].map((target) => ({
    ...target,
    leaseEntityIdentity: String(target.entityIdentity),
  }));

  return synchronizeMediaReferenceWriteScopesAfterDomainMutation(
    targets,
    null,
  );
}

export async function duplicateProjectAjax(id: number) {
  const actor = await requireAdminSession();
  const projectId = projectIdSchema.safeParse(id);
  if (!projectId.success) {
    return {
      ok: false as const,
      code: "invalid_project_id",
      message: "معرّف المشروع غير صالح.",
    };
  }

  const { data, error } = await getSupabaseAdmin().rpc(
    "duplicate_project_admin_entry",
    { p_project_id: projectId.data },
  );
  if (error) {
    return {
      ok: false as const,
      code: error.code === "P0002" ? "project_not_found" : "project_duplicate_failed",
      message:
        error.code === "P0002"
          ? "المشروع غير موجود."
          : "تعذر نسخ Project Aggregate. لم تُحفظ نسخة جزئية.",
    };
  }

  const parsed = duplicateResultSchema.safeParse(Array.isArray(data) ? data[0] : data);
  if (!parsed.success) {
    return {
      ok: false as const,
      code: "project_duplicate_result_invalid",
      message: "اكتملت استجابة النسخ دون هوية موثوقة. حدّث القائمة قبل المحاولة مرة أخرى.",
    };
  }

  const duplicated = parsed.data;
  const { data: publication, error: publicationError } = await getSupabaseAdmin()
    .from("projects")
    .select("publication_status,published_at,published_by,featured")
    .eq("id", duplicated.project_id)
    .maybeSingle<{
      publication_status: "published" | "unpublished";
      published_at: string | null;
      published_by: number | null;
      featured: boolean;
    }>();
  if (
    publicationError ||
    !publication ||
    publication.publication_status !== "unpublished" ||
    publication.published_at !== null ||
    publication.published_by !== null ||
    publication.featured !== false
  ) {
    return {
      ok: false as const,
      code: "project_duplicate_publication_result_invalid",
      message:
        "أُنشئت النسخة دون إثبات عقد غير المنشور النهائي. حدّث القائمة قبل أي إجراء آخر.",
    };
  }
  const mediaSynchronization = await synchronizeDuplicatedProjectMedia(
    duplicated.project_id,
  );

  await recordCmsAdminAudit(
    {
      action: buildCmsAuditAction("project", "duplicate"),
      entityType: "project",
      entityId: duplicated.project_id,
      metadata: {
        sourceProjectId: projectId.data,
        slug: duplicated.project_slug,
        type: duplicated.project_type,
        aggregateContract: "project_admin_entry_v2",
        mediaSynchronization: mediaSynchronization.status,
        publicationStatus: publication.publication_status,
      },
    },
    actor,
  );

  try {
    revalidateProjectPaths(
      duplicated.project_type,
      duplicated.project_id,
      duplicated.project_slug,
    );
  } catch (revalidationError) {
    console.error("Project duplicate cache revalidation failed", {
      projectId: duplicated.project_id,
      error: revalidationError,
    });
  }

  return withProjectMediaSynchronization(
    {
      ok: true as const,
      message: "تم نسخ المشروع وكل عناصره التابعة ذريًا. النسخة الجديدة غير مميزة حتى اعتمادها.",
      projectId: duplicated.project_id,
      projectType: duplicated.project_type,
      slug: duplicated.project_slug,
      featured: duplicated.featured,
      publicationStatus: publication.publication_status,
      publishedAt: publication.published_at,
      publishedBy: publication.published_by,
      createdAt: duplicated.created_at,
      updatedAt: duplicated.updated_at,
    },
    mediaSynchronization,
  );
}
