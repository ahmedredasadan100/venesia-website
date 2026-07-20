"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { revalidatePublicPagesWithBlockAssignments } from "../../../../../lib/page-blocks/admin-revalidate";
import { getPageDeleteBlockReason } from "../../../../../lib/pages/page-admin-policy";
import { normalizePath } from "../../../../../lib/seo/seo-utils";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import type { PageDeleteResult } from "./types";

async function deleteHeroAssignments(pageIds: number[]) {
  const { error } = await getSupabaseAdmin().from("hero_assignments").delete()
    .eq("target_type", "page").in("target_id", pageIds);
  if (error) throw new Error(error.message);
}
function revalidateDeletedPublicPath(path?: string | null) {
  if (!path) return;
  const normalized = normalizePath(path);
  revalidatePath(normalized, "page");
  revalidateTag(`page-seo:${normalized}`, "max");
}

export async function deletePages(ids: number[]): Promise<PageDeleteResult> {
  await requireAdminSession();
  const validIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  if (!validIds.length) return { ok: false, code: "invalid_pages", message: "حدد صفحة واحدة على الأقل." };
  const { data: pages, error } = await getSupabaseAdmin().from("pages")
    .select("id,slug,path,title").in("id", validIds);
  if (error) return { ok: false, code: "page_load_failed", message: error.message };
  if (!pages?.length) {
    return { ok: false, code: "page_not_found", message: "الصفحة غير موجودة." };
  }
  const blockedIds: number[] = [];
  const deletable = (pages ?? []).filter((page) => {
    if (getPageDeleteBlockReason({ slug: page.slug, path: page.path })) { blockedIds.push(page.id); return false; }
    return true;
  });
  if (!deletable.length) return { ok: false, code: "pages_protected", blockedIds, blockedCount: blockedIds.length, message: "لا يمكن حذف الصفحات المحددة — الصفحة الرئيسية محمية." };
  const deletedIds = deletable.map((page) => page.id);
  try { await deleteHeroAssignments(deletedIds); } catch (caught) {
    return { ok: false, code: "hero_delete_failed", message: caught instanceof Error ? caught.message : "تعذر حذف ربط الهيرو." };
  }
  const deletion = await getSupabaseAdmin().from("pages").delete().in("id", deletedIds);
  if (deletion.error) return { ok: false, code: "page_delete_failed", message: deletion.error.message };
  await recordCmsAdminAudit({ action: buildCmsAuditAction("page", "delete"), entityType: "page",
    metadata: { page_ids: deletedIds, count: deletedIds.length } });
  deletable.forEach((page) => revalidateDeletedPublicPath(page.path));
  await revalidatePublicPagesWithBlockAssignments();
  const blockedSuffix = blockedIds.length ? ` لم يُحذف ${blockedIds.length} صفحة محمية.` : "";
  return { ok: true, deletedIds, blockedIds, blockedCount: blockedIds.length,
    message: `تم حذف ${deletedIds.length} صفحة بنجاح.${blockedSuffix}` };
}

export async function deletePage(pageId: number) { return deletePages([pageId]); }
export async function bulkDeletePagesAjax(ids: number[]) { return deletePages(ids); }
