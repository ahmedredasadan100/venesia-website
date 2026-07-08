"use server";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { getProjectPublishValidationError } from "../../../../lib/admin/projects/project-publish-validation";
import type { ProjectCategory } from "../../../../config/projects-data";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import type { PublicationStatus } from "./types";
import { loadProjectPublishInput } from "./validation";
import { revalidateProjectPathsById } from "./revalidate";

export async function getProjectsTableRows(type: ProjectCategory) {
  await requireAdminSession();
  const { data, error } = await getSupabaseAdmin()
    .from("projects")
    .select("id, code, slug, arabic_name, location_label, map_area, featured, publication_status, updated_at")
    .eq("type", type)
    .order("homepage_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function toggleProjectPublicationAjax(id: number, currentStatus: string | null) {
  await requireAdminSession();
  const nextStatus: PublicationStatus = currentStatus === "published" ? "unpublished" : "published";

  if (nextStatus === "published") {
    const input = await loadProjectPublishInput(id);
    if (!input) return { ok: false as const, message: "المشروع غير موجود." };
    const validationError = getProjectPublishValidationError(input);
    if (validationError) return { ok: false as const, message: validationError };
  }

  const { data, error } = await getSupabaseAdmin()
    .from("projects")
    .update({ publication_status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("type")
    .maybeSingle<{ type: ProjectCategory }>();

  if (error || !data) return { ok: false as const, message: error?.message ?? "المشروع غير موجود." };

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("project", nextStatus === "published" ? "publish" : "unpublish"),
    entityType: "project",
    entityId: id,
    metadata: { publication_status: nextStatus },
  });
  revalidateProjectPathsById(data.type, id);
  return { ok: true as const, message: nextStatus === "published" ? "تم نشر المشروع." : "تم إخفاء المشروع." };
}

export async function archiveProjectAjax(id: number) {
  await requireAdminSession();
  const { data, error } = await getSupabaseAdmin()
    .from("projects")
    .update({ publication_status: "archived", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("type")
    .maybeSingle<{ type: ProjectCategory }>();

  if (error || !data) return { ok: false as const, message: error?.message ?? "المشروع غير موجود." };
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("project", "delete"),
    entityType: "project",
    entityId: id,
    metadata: { publication_status: "archived" },
  });
  revalidateProjectPathsById(data.type, id);
  return { ok: true as const, message: "تم أرشفة المشروع." };
}

export async function restoreProjectAjax(id: number) {
  await requireAdminSession();
  const { data, error } = await getSupabaseAdmin()
    .from("projects")
    .update({ publication_status: "draft", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("type")
    .maybeSingle<{ type: ProjectCategory }>();

  if (error || !data) return { ok: false as const, message: error?.message ?? "المشروع غير موجود." };
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("project", "restore"),
    entityType: "project",
    entityId: id,
    metadata: { publication_status: "draft" },
  });
  revalidateProjectPathsById(data.type, id);
  return { ok: true as const, message: "تم استعادة المشروع كمسودة." };
}
