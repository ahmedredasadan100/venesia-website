"use server";

import { adminActionSuccess } from "../../../../../lib/admin/admin-action-result";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { revalidatePageBlocksPath, revalidateCommittedPageBlockAction } from "../../../../../lib/page-blocks/admin-revalidate";
import { verifyPublicPagePublicationDependencies } from "../../../../../lib/pages/public-page-publication-dependencies";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import type { PageMutationResult } from "./types";

export async function togglePageStatus(
  pageId: number,
  expectedStatus: string,
  expectedUpdatedAt: string | null,
): Promise<PageMutationResult & { status?: string }> {
  await requireAdminSession();
  if (!Number.isInteger(pageId) || pageId <= 0) {
    return { ok: false, code: "invalid_page", message: "الصفحة غير موجودة." };
  }
  const { data: page, error: loadError } = await getSupabaseAdmin()
    .from("pages").select("id,slug,path,status,updated_at").eq("id", pageId).maybeSingle();
  if (loadError || !page) return { ok: false, code: "page_not_found", message: loadError?.message ?? "الصفحة غير موجودة." };
  if (
    page.status !== expectedStatus ||
    !expectedUpdatedAt ||
    page.updated_at !== expectedUpdatedAt
  ) {
    return {
      ok: false,
      code: "revision_conflict",
      message: "تغيّرت حالة الصفحة منذ آخر تحميل. حدّث القائمة ثم أعد المحاولة.",
    };
  }

  const nextStatus = page.status === "published" ? "unpublished" : "published";
  const dependency = await verifyPublicPagePublicationDependencies(page, nextStatus);
  if (!dependency.ok) return dependency;

  const updatedAt = new Date().toISOString();
  const { data: updatedPage, error } = await getSupabaseAdmin().from("pages")
    .update({ status: nextStatus, updated_at: updatedAt })
    .eq("id", pageId)
    .eq("status", page.status)
    .eq("updated_at", page.updated_at)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, code: "status_update_failed", message: error.message };
  if (!updatedPage) {
    return {
      ok: false,
      code: "revision_conflict",
      message: "تغيّرت حالة الصفحة أثناء الحفظ. لم يُعتمد هذا التغيير؛ حدّث القائمة ثم أعد المحاولة.",
    };
  }

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("page", nextStatus === "published" ? "publish" : "unpublish"),
    entityType: "page", entityId: pageId, metadata: {
      status: nextStatus,
      previous_status: page.status,
      previous_updated_at: page.updated_at,
      updated_at: updatedAt,
      public_dependency: dependency.dependency,
    },
  });
  const settled = await revalidateCommittedPageBlockAction(
    adminActionSuccess("تم حفظ حالة الصفحة", nextStatus === "published" ? "تم نشر الصفحة." : "أصبحت الصفحة غير منشورة.", { entityId: pageId, completion: "committed", code: nextStatus === "published" ? "published" : "unpublished" }),
    () => revalidatePageBlocksPath(pageId),
  );
  return { ok: true, status: nextStatus, message: settled.message, feedbackStatus: settled.feedbackStatus === "warning" ? "warning" : "success" };
}
