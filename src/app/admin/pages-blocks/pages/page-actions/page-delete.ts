"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { revalidatePublicPagesWithBlockAssignments } from "../../../../../lib/page-blocks/admin-revalidate";
import { runBoundedPublicCacheRevalidation } from "../../../../../lib/cache/revalidate-public-cache-tags";
import { normalizePath } from "../../../../../lib/seo/seo-utils";
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
  let result;
  try {
    result = await mutatePageComposition(null, "delete_pages", { page_ids: validIds }, actor);
  } catch (caught) {
    return { ok: false, code: "page_delete_failed", message: caught instanceof Error ? caught.message : "تعذر حذف الصفحة ذريًا." };
  }
  const deletedPages = result.deleted_pages as Array<{ id: number; path: string | null }>;
  const blockedIds = result.blocked_ids as number[];
  if (!deletedPages.length) {
    return blockedIds.length
      ? { ok: false, code: "pages_protected", blockedIds, blockedCount: blockedIds.length, message: "الصفحات المحددة محمية من الحذف." }
      : { ok: false, code: "page_not_found", message: "الصفحة غير موجودة." };
  }
  const deletedIds = deletedPages.map((page) => page.id);
  const cacheRevalidation = await runBoundedPublicCacheRevalidation(async () => {
    deletedPages.forEach((page) => revalidateDeletedPublicPath(page.path));
    revalidatePath("/admin/pages-blocks/pages", "layout");
    await revalidatePublicPagesWithBlockAssignments();
  });
  if (!cacheRevalidation.ok) console.error("Pages deleted; cache revalidation failed", cacheRevalidation.error);
  const blockedSuffix = blockedIds.length ? ` لم يُحذف ${blockedIds.length} صفحة محمية.` : "";
  return { ok: true, deletedIds, blockedIds, blockedCount: blockedIds.length,
    feedbackStatus: blockedIds.length || !cacheRevalidation.ok ? "warning" : "success",
    message: `تم حذف ${deletedIds.length} صفحة بنجاح.${blockedSuffix}${cacheRevalidation.ok ? "" : " تعذر تحديث الكاش بعد إعادة المحاولة؛ قد تتأخر القراءة العامة."}` };
}

export async function deletePage(pageId: number) { return deletePages([pageId]); }
export async function bulkDeletePagesAjax(ids: number[]) { return deletePages(ids); }
