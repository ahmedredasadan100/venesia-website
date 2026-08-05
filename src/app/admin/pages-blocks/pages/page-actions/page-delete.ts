"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { revalidatePublicPagesWithBlockAssignments } from "../../../../../lib/page-blocks/admin-revalidate";
import { getPageDeleteBlockReason } from "../../../../../lib/pages/page-admin-policy";
import { normalizePath } from "../../../../../lib/seo/seo-utils";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { mutatePageComposition } from "./helpers";
import type { PageDeleteResult } from "./types";

function revalidateDeletedPublicPath(path?: string | null) {
  if (!path) return;
  const normalized = normalizePath(path);
  revalidatePath(normalized, "page");
  revalidateTag(`page-seo:${normalized}`, "max");
}

export async function deletePages(ids: number[]): Promise<PageDeleteResult> {
  const actor = await requireAdminSession();
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
  try {
    for (const pageId of deletedIds) {
      await mutatePageComposition(pageId, "delete_page", {}, actor);
    }
  } catch (caught) {
    return { ok: false, code: "page_delete_failed", message: caught instanceof Error ? caught.message : "تعذر حذف الصفحة ذريًا." };
  }
  deletable.forEach((page) => revalidateDeletedPublicPath(page.path));
  await revalidatePublicPagesWithBlockAssignments();
  const blockedSuffix = blockedIds.length ? ` لم يُحذف ${blockedIds.length} صفحة محمية.` : "";
  return { ok: true, deletedIds, blockedIds, blockedCount: blockedIds.length,
    message: `تم حذف ${deletedIds.length} صفحة بنجاح.${blockedSuffix}` };
}

export async function deletePage(pageId: number) { return deletePages([pageId]); }
export async function bulkDeletePagesAjax(ids: number[]) { return deletePages(ids); }
