"use server";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { getProjectPublishValidationError } from "../../../../lib/admin/projects/project-publish-validation";
import type { ProjectCategory } from "../../../../config/projects-data";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { synchronizeProjectMediaReferencesAfterMutation } from "../../../../lib/admin/media-catalog/synchronization";
import type { PublicationStatus } from "./types";
import { loadProjectPublishInput } from "./validation";
import { revalidateProjectPathsById } from "./revalidate";

export async function toggleProjectPublicationAjax(id: number, currentStatus: string | null) {
  await requireAdminSession();
  const nextStatus: PublicationStatus = currentStatus === "published" ? "unpublished" : "published";

  if (nextStatus === "published") {
    try {
      const input = await loadProjectPublishInput(id);
      if (!input) {
        return { ok: false as const, code: "project_not_found", message: "المشروع غير موجود." };
      }
      const validationError = getProjectPublishValidationError(input);
      if (validationError) {
        return { ok: false as const, code: "publish_validation", message: validationError };
      }
    } catch (error) {
      return {
        ok: false as const,
        code: "publish_validation_failed",
        message: error instanceof Error ? error.message : "تعذر التحقق من جاهزية النشر.",
      };
    }
  }

  const { data, error } = await getSupabaseAdmin()
    .from("projects")
    .update({ publication_status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("type")
    .maybeSingle<{ type: ProjectCategory }>();

  if (error || !data) {
    return {
      ok: false as const,
      code: error ? "status_update_failed" : "project_not_found",
      message: error?.message ?? "المشروع غير موجود.",
    };
  }

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("project", nextStatus === "published" ? "publish" : "unpublish"),
    entityType: "project",
    entityId: id,
    metadata: { publication_status: nextStatus },
  });
  await synchronizeProjectMediaReferencesAfterMutation(id);
  revalidateProjectPathsById(data.type, id);
  return {
    ok: true as const,
    publication_status: nextStatus,
    message:
      nextStatus === "published"
        ? "أصبح المشروع ظاهرًا للعامة."
        : "لم يعد المشروع ظاهرًا للعامة.",
  };
}

export async function archiveProjectAjax(id: number) {
  await requireAdminSession();
  const { data, error } = await getSupabaseAdmin()
    .from("projects")
    .update({ publication_status: "archived", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("type")
    .maybeSingle<{ type: ProjectCategory }>();

  if (error || !data) {
    return {
      ok: false as const,
      code: error ? "archive_failed" : "project_not_found",
      message: error?.message ?? "المشروع غير موجود.",
    };
  }
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("project", "archive"),
    entityType: "project",
    entityId: id,
    metadata: { publication_status: "archived" },
  });
  await synchronizeProjectMediaReferencesAfterMutation(id);
  revalidateProjectPathsById(data.type, id);
  return {
    ok: true as const,
    publication_status: "archived" as const,
    message: "أُزيل المشروع من القائمة النشطة.",
  };
}

export async function restoreProjectAjax(id: number) {
  await requireAdminSession();
  const { data, error } = await getSupabaseAdmin()
    .from("projects")
    .update({ publication_status: "draft", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("type")
    .maybeSingle<{ type: ProjectCategory }>();

  if (error || !data) {
    return {
      ok: false as const,
      code: error ? "restore_failed" : "project_not_found",
      message: error?.message ?? "المشروع غير موجود.",
    };
  }
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("project", "restore"),
    entityType: "project",
    entityId: id,
    metadata: { publication_status: "draft" },
  });
  await synchronizeProjectMediaReferencesAfterMutation(id);
  revalidateProjectPathsById(data.type, id);
  return {
    ok: true as const,
    publication_status: "draft" as const,
    message: "عاد المشروع إلى القائمة كمسودة.",
  };
}
