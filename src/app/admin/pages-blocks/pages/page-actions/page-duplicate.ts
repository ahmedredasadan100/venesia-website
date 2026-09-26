"use server";

import { adminActionSuccess } from "../../../../../lib/admin/admin-action-result";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { revalidatePageBlocksPath, revalidateCommittedPageBlockAction } from "../../../../../lib/page-blocks/admin-revalidate";
import { mutatePageComposition } from "./helpers";

export type PageDuplicateResult =
  | { ok: true; message: string; pageId: number; feedbackStatus?: "success" | "warning" }
  | { ok: false; code: string; message: string };

export async function duplicatePageAjax(pageId: number): Promise<PageDuplicateResult> {
  const actor = await requireAdminSession();
  if (!Number.isInteger(pageId) || pageId <= 0) {
    return { ok: false, code: "invalid_page", message: "الصفحة غير موجودة." };
  }
  let copiedPageId: number;
  try {
    const result = await mutatePageComposition(pageId, "duplicate_page", {}, actor);
    copiedPageId = Number(result.page_id);
  } catch (error) {
    return { ok: false, code: "page_duplicate_failed", message: error instanceof Error ? error.message : "تعذر نسخ الصفحة." };
  }
  const settled = await revalidateCommittedPageBlockAction(
    adminActionSuccess("تم نسخ الصفحة", "تم نسخ الصفحة وموديولاتها ذريًا.", { entityId: copiedPageId, completion: "committed", code: "created" }),
    () => revalidatePageBlocksPath(copiedPageId),
  );
  return { ok: true, pageId: copiedPageId, message: settled.message, feedbackStatus: settled.feedbackStatus === "warning" ? "warning" : "success" };
}
