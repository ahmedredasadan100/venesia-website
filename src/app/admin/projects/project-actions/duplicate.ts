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
import { runBoundedPublicCacheRevalidation } from "../../../../lib/cache/revalidate-public-cache-tags";
import {
  buildProjectDuplicateSeoProof,
  projectDuplicateSlug,
  PROJECT_DUPLICATE_MAX_COPY_NUMBER,
  PROJECT_DUPLICATE_SEO_MAX_ATTEMPTS,
} from "../../../../lib/admin/projects/project-duplicate-seo";
import { loadProjectPostMutationReadback } from "../../../../lib/admin/projects/project-entry-data";
import { persistedEntitySeoScoreMatches } from "../../../../lib/seo/entity-seo-types";

const projectIdSchema = z.number().int().positive();

const duplicateResultSchema = z.object({
  project_id: z.number().int().positive(),
  project_type: z.enum(["residential", "commercial"]),
  project_slug: z.string().min(1),
  featured: z.boolean(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});

async function duplicateProjectWithSeo(projectId: number) {
  const supabase = getSupabaseAdmin();
  for (let attempt = 0; attempt < PROJECT_DUPLICATE_SEO_MAX_ATTEMPTS; attempt += 1) {
    const source = await supabase.from("projects")
      .select("updated_at,arabic_name,general_description,overview_body,slug,hero_image,hero_image_alt,og_image,og_image_alt,seo_title,seo_description,seo_keywords,focus_keyword")
      .eq("id", projectId)
      .maybeSingle();
    if (source.error) return { data: null, error: source.error, expectedSeoScore: null };
    if (!source.data) return { data: null, error: { code: "P0002" }, expectedSeoScore: null };
    const sourceRow = source.data;

    // Bounded batches avoid reading unrelated Projects or relying on a capped
    // prefix query. The existing SQL allocator remains the uniqueness owner.
    let copyNumber = 0;
    for (let first = 1; first <= PROJECT_DUPLICATE_MAX_COPY_NUMBER; first += 100) {
      const candidates = Array.from({ length: 100 }, (_, index) =>
        projectDuplicateSlug(sourceRow.slug, first + index));
      const occupied = await supabase.from("projects").select("slug").in("slug", candidates);
      if (occupied.error) return { data: null, error: occupied.error, expectedSeoScore: null };
      const slugs = new Set((occupied.data ?? []).map((row) => row.slug));
      const available = candidates.findIndex((slug) => !slugs.has(slug));
      if (available !== -1) {
        copyNumber = first + available;
        break;
      }
    }
    if (!copyNumber) return { data: null, error: { code: "54000" }, expectedSeoScore: null };

    const proof = buildProjectDuplicateSeoProof(sourceRow, copyNumber);
    const result = await supabase.rpc("duplicate_project_admin_entry", {
      p_project_id: projectId,
      p_seo_proof: proof,
    });
    // This code is raised only before commit by our atomic proof checks. An
    // ambiguous transport/result error must never repeat a committed duplicate.
    if (result.error?.code !== "VSE01") {
      return { ...result, expectedSeoScore: proof.score };
    }
  }
  return { data: null, error: { code: "VSE01" }, expectedSeoScore: null };
}

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

  const { data, error, expectedSeoScore } = await duplicateProjectWithSeo(projectId.data);
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

  const parsed = duplicateResultSchema.safeParse(data?.[0]);
  if (!parsed.success) {
    return {
      ok: true as const,
      feedbackStatus: "warning" as const,
      code: "project_duplicate_result_invalid",
      message: "اكتملت استجابة النسخ دون هوية موثوقة. حدّث القائمة قبل المحاولة مرة أخرى.",
    };
  }

  const duplicated = parsed.data;
  const publication = await loadProjectPostMutationReadback(duplicated.project_id)
    .catch(() => null);
  const publicationUnproven = Boolean(
    !publication ||
    publication.publication_status !== "unpublished" ||
    publication.published_at !== null ||
    publication.published_by !== null ||
    publication.featured !== false
  );
  const seoScoreUnproven = !expectedSeoScore
    || !persistedEntitySeoScoreMatches(expectedSeoScore, publication);
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
        publicationStatus: publication?.publication_status ?? null,
        publicationResultVerified: !publicationUnproven,
        seoScoreReadbackVerified: !seoScoreUnproven,
      },
    },
    actor,
  );

  const cache = await runBoundedPublicCacheRevalidation(async () => {
    await revalidateProjectPaths(
      duplicated.project_type,
      duplicated.project_id,
      duplicated.project_slug,
    );
  });

  const result = withProjectMediaSynchronization(
    {
      ok: true as const,
      message: "تم نسخ المشروع وكل عناصره التابعة ذريًا. النسخة الجديدة غير مميزة حتى اعتمادها.",
      projectId: duplicated.project_id,
      projectType: duplicated.project_type,
      slug: duplicated.project_slug,
      featured: duplicated.featured,
      publicationStatus: publication?.publication_status ?? null,
      publishedAt: publication?.published_at ?? null,
      publishedBy: publication?.published_by ?? null,
      createdAt: duplicated.created_at,
      updatedAt: duplicated.updated_at,
    },
    mediaSynchronization,
  );
  if (publicationUnproven || seoScoreUnproven) return {
    ...result,
    feedbackStatus: "warning" as const,
    code: publicationUnproven
      ? "project_duplicate_publication_result_invalid" as const
      : "project_duplicate_seo_result_invalid" as const,
    message: [publicationUnproven
      ? "أُنشئت النسخة، لكن تعذر التحقق من حالة نشرها. حدّث القائمة للتحقق ولا تعِد النسخ."
      : "أُنشئت النسخة، لكن تعذرت مطابقة درجة SEO المحفوظة مع نتيجة الحساب الموثوقة. حدّث القائمة للتحقق ولا تعِد النسخ.", ...(result.feedbackStatus === "warning" ? [result.message] : []), ...(!cache.ok ? ["تعذر تحديث العرض فورًا."] : [])].join(" "),
  };
  return cache.ok ? result : {
    ...result,
    feedbackStatus: "warning" as const,
    code: result.feedbackStatus === "warning" ? "saved_with_media_sync_warning" as const : "committed_cache_revalidation_pending" as const,
    message: `${result.message} تعذر تحديث العرض فورًا. حدّث الصفحة لعرض أحدث البيانات. لا تعِد نسخ المشروع.`,
  };
}
