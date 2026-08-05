"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { type PageBlockActionResult } from "../../../../../lib/page-blocks/action-result";
import { revalidatePageBlocksPath } from "../../../../../lib/page-blocks/admin-revalidate";
import { cleanText, parseNumber } from "../../../../../lib/page-blocks/admin-utils";
import { databaseAssignmentKind, failure, mutatePageComposition, success } from "./helpers";

export async function deletePageBlockAssignment(formData: FormData): Promise<PageBlockActionResult> {
  const actor = await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  const assignmentId = parseNumber(formData.get("assignment_id"));
  const kind = cleanText(formData.get("block_type"));
  if (!pageId || !assignmentId) return failure("بيانات الربط غير مكتملة.");
  try {
    await mutatePageComposition(pageId, "bulk", {
      changes: [{ kind: databaseAssignmentKind(kind), id: assignmentId, action: "delete" }],
    }, actor);
  } catch (error) {
    return failure(error instanceof Error ? error.message : "تعذر حذف الربط.");
  }
  await revalidatePageBlocksPath(pageId);
  return success();
}
