"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { revalidatePageBlocksPath } from "../../../../../lib/page-blocks/admin-revalidate";
import { mutatePageComposition } from "./helpers";

export type PageDuplicateResult =
  | { ok: true; message: string; pageId: number }
  | { ok: false; code: string; message: string };

export async function duplicatePageAjax(pageId: number): Promise<PageDuplicateResult> {
  const actor = await requireAdminSession();
  if (!Number.isInteger(pageId) || pageId <= 0) {
    return { ok: false, code: "invalid_page", message: "الصفحة غير موجودة." };
  }
  try {
    const result = await mutatePageComposition(pageId, "duplicate_page", {}, actor);
    const copiedPageId = Number(result.page_id);
    await revalidatePageBlocksPath(copiedPageId);
    return { ok: true, message: "تم نسخ الصفحة وموديولاتها ذريًا.", pageId: copiedPageId };
  } catch (error) {
    return { ok: false, code: "page_duplicate_failed", message: error instanceof Error ? error.message : "تعذر نسخ الصفحة." };
  }
}
