"use server";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import type { ProjectCategory } from "../../../../lib/projects/public-types";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { synchronizeMediaReferenceWriteScopesAfterDomainMutation } from "../../../../lib/admin/media-catalog/synchronization";
import { withProjectMediaSynchronization } from "./helpers";
import { revalidateProjectPaths } from "./revalidate";

function isProjectCategory(value: string): value is ProjectCategory {
  return value === "residential" || value === "commercial";
}

export async function deleteProjectAjax(id: number, confirmPermanent = false) {
  await requireAdminSession();
  if (!confirmPermanent) {
    return {
      ok: false as const,
      code: "confirm_required",
      message: "الحذف النهائي يتطلب تأكيدًا صريحًا — استخدم إلغاء النشر لإخفاء المشروع عن الموقع العام.",
    };
  }

  const { data: existing, error: lookupError } = await getSupabaseAdmin()
    .from("projects")
    .select("type, slug")
    .eq("id", id)
    .maybeSingle();

  if (lookupError || !existing || !isProjectCategory(existing.type)) {
    return {
      ok: false as const,
      code: lookupError ? "lookup_failed" : "project_not_found",
      message: lookupError?.message ?? "المشروع غير موجود.",
    };
  }

  const [floorPlans, projectMedia, projectVideos] = await Promise.all([
    getSupabaseAdmin()
      .from("project_floor_plans")
      .select("id")
      .eq("project_id", id),
    getSupabaseAdmin()
      .from("project_media")
      .select("id")
      .eq("project_id", id),
    getSupabaseAdmin()
      .from("project_videos")
      .select("id")
      .eq("project_id", id),
  ]);
  if (floorPlans.error || projectMedia.error || projectVideos.error) {
    return {
      ok: false as const,
      code: "child_lookup_failed",
      message:
        floorPlans.error?.message ??
        projectMedia.error?.message ??
        projectVideos.error?.message ??
        "تعذر إثبات وسائط المشروع قبل الحذف.",
    };
  }

  const { error } = await getSupabaseAdmin().rpc(
    "delete_project_admin_entry",
    { p_project_id: id },
  );
  if (error) {
    return { ok: false as const, code: "delete_failed", message: error.message };
  }
  const mediaSynchronization =
    await synchronizeMediaReferenceWriteScopesAfterDomainMutation(
      [],
      null,
      [
        { domainKey: "projects", entityIdentity: id },
        ...(floorPlans.data ?? []).map((row) => ({
          domainKey: "project_floor_plans",
          entityIdentity: String(row.id),
        })),
        ...(projectMedia.data ?? []).map((row) => ({
          domainKey: "project_media",
          entityIdentity: String(row.id),
        })),
        ...(projectVideos.data ?? []).map((row) => ({
          domainKey: "project_videos",
          entityIdentity: String(row.id),
        })),
      ],
    );
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("project", "delete"),
    entityType: "project",
    entityId: id,
    metadata: { permanent: true, slug: existing.slug },
  });
  revalidateProjectPaths(existing.type, undefined, existing.slug);
  return withProjectMediaSynchronization(
    { ok: true as const, message: "تم الحذف النهائي وإزالة المشروع من القائمة." },
    mediaSynchronization,
  );
}
