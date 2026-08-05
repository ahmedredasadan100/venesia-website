"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { revalidatePageBlocksPath } from "../../../../../lib/page-blocks/admin-revalidate";
import { databaseAssignmentKind, mutatePageComposition } from "./helpers";

export type PageCompositionOrderingRevision = {
  kind: string;
  id: number;
  updated_at: string;
};

export async function reorderPageComposition(
  pageId: number,
  slot: string,
  assignments: PageCompositionOrderingRevision[],
) {
  const actor = await requireAdminSession();
  if (!pageId || !slot || !assignments.length) {
    return { ok: false as const, code: "invalid_reorder_payload", message: "بيانات ترتيب الصفحة غير مكتملة." };
  }
  try {
    await mutatePageComposition(pageId, "reorder", {
      slot,
      assignments: assignments.map((item) => ({ ...item, kind: databaseAssignmentKind(item.kind) })),
    }, actor);
  } catch (error) {
    return { ok: false as const, code: "atomic_reorder_failed", message: error instanceof Error ? error.message : "تعذر حفظ ترتيب الصفحة." };
  }
  try {
    await revalidatePageBlocksPath(pageId);
    return { ok: true as const, code: "page_composition_reordered" };
  } catch (error) {
    console.error("Page Composition reorder committed but cache revalidation failed.", error);
    return { ok: true as const, code: "saved_with_cache_warning", warning: "تم حفظ الترتيب، لكن تعذرت إعادة التحقق من الذاكرة المؤقتة." };
  }
}
