"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { revalidatePageBlocksPath } from "../../../../../lib/page-blocks/admin-revalidate";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import type { PageMutationResult } from "./types";

export async function togglePageStatus(pageId: number): Promise<PageMutationResult & { status?: string }> {
  await requireAdminSession();
  if (!Number.isInteger(pageId) || pageId <= 0) {
    return { ok: false, code: "invalid_page", message: "الصفحة غير موجودة." };
  }
  const { data: page, error: loadError } = await getSupabaseAdmin()
    .from("pages").select("status").eq("id", pageId).maybeSingle();
  if (loadError || !page) return { ok: false, code: "page_not_found", message: loadError?.message ?? "الصفحة غير موجودة." };

  const nextStatus = page.status === "published" ? "unpublished" : "published";
  const { error } = await getSupabaseAdmin().from("pages")
    .update({ status: nextStatus, updated_at: new Date().toISOString() }).eq("id", pageId);
  if (error) return { ok: false, code: "status_update_failed", message: error.message };

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("page", nextStatus === "published" ? "publish" : "unpublish"),
    entityType: "page", entityId: pageId, metadata: { status: nextStatus },
  });
  await revalidatePageBlocksPath(pageId);
  return { ok: true, status: nextStatus, message: nextStatus === "published" ? "تم نشر الصفحة." : "أصبحت الصفحة غير منشورة." };
}
