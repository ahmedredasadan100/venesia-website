"use server";

import { revalidateCommittedPageBlockResult, success } from "./helpers";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { cleanText, parseNumber } from "../../../../../lib/page-blocks/admin-utils";
import { databaseAssignmentKind, mutatePageComposition, parseAssignmentKeys } from "./helpers";

export async function bulkPageBlockAssignments(formData: FormData) {
  const actor = await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  const action = cleanText(formData.get("bulk_action"));
  const entries = parseAssignmentKeys(formData);
  if (!pageId || !entries.length) throw new Error("Invalid page block bulk request.");
  if (action !== "show" && action !== "hide" && action !== "detach") {
    throw new Error("Unsupported page block bulk action.");
  }
  const databaseAction = action === "detach" ? "delete" : action;
  await mutatePageComposition(pageId, "bulk", {
    changes: entries.map((entry) => ({
      kind: databaseAssignmentKind(entry.moduleKind),
      id: entry.assignmentId,
      action: databaseAction,
    })),
  }, actor);
  return revalidateCommittedPageBlockResult(pageId, success({ message: action === "detach" ? "تمت إزالة الروابط المحددة من الصفحة." : "تم تحديث الروابط المحددة." }));
}
