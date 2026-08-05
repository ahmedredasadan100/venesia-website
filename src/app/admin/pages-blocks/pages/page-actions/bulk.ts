"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { revalidatePageBlocksPath } from "../../../../../lib/page-blocks/admin-revalidate";
import { cleanText, parseNumber } from "../../../../../lib/page-blocks/admin-utils";
import { databaseAssignmentKind, mutatePageComposition, parseAssignmentKeys } from "./helpers";

export async function bulkPageBlockAssignments(formData: FormData) {
  const actor = await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  const action = cleanText(formData.get("bulk_action"));
  const entries = parseAssignmentKeys(formData);
  if (!pageId || !entries.length) throw new Error("Invalid page block bulk request.");
  if (action !== "show" && action !== "hide" && action !== "delete") {
    throw new Error("Unsupported page block bulk action.");
  }
  await mutatePageComposition(pageId, "bulk", {
    changes: entries.map((entry) => ({
      kind: databaseAssignmentKind(entry.moduleKind),
      id: entry.assignmentId,
      action,
    })),
  }, actor);
  await revalidatePageBlocksPath(pageId);
}
