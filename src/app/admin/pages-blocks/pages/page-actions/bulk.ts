"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import {
  MEDIA_HUB_ASSIGNMENT_TABLE,
} from "../../../../../lib/media-hub-modules/registry";
import {
  MEDIA_SIDEBAR_ASSIGNMENT_TABLE,
} from "../../../../../lib/media-sidebar-modules/registry";
import { revalidatePageBlocksPath } from "../../../../../lib/page-blocks/admin-revalidate";
import { cleanText, parseNumber } from "../../../../../lib/page-blocks/admin-utils";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  assignmentTable,
  auditPageBlockAssignment,
  parseAssignmentKeys,
} from "./helpers";

export async function bulkPageBlockAssignments(formData: FormData) {
  await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  const action = cleanText(formData.get("bulk_action"));
  const entries = parseAssignmentKeys(formData);

  if (!pageId || !entries.length) {
    throw new Error("Invalid page block bulk request.");
  }
  if (action !== "show" && action !== "hide" && action !== "delete") {
    throw new Error("Unsupported page block bulk action.");
  }

  const now = new Date().toISOString();

  if (action === "show" || action === "hide") {
    const isVisible = action === "show";

    const mutationResults = await Promise.all(
      entries.map((entry) => {
        if (entry.moduleKind === "hero") {
          return getSupabaseAdmin()
            .from("hero_assignments")
            .update({ is_active: isVisible })
            .eq("id", entry.assignmentId)
            .eq("target_id", pageId)
            .eq("target_type", "page");
        }

        if (entry.moduleKind === "media-sidebar") {
          return getSupabaseAdmin()
            .from(MEDIA_SIDEBAR_ASSIGNMENT_TABLE)
            .update({ is_visible: isVisible, updated_at: now })
            .eq("id", entry.assignmentId)
            .eq("page_id", pageId);
        }

        if (entry.moduleKind === "media-hub") {
          return getSupabaseAdmin()
            .from(MEDIA_HUB_ASSIGNMENT_TABLE)
            .update({ is_visible: isVisible, updated_at: now })
            .eq("id", entry.assignmentId)
            .eq("page_id", pageId);
        }

        if (!entry.blockType) return Promise.resolve();

        return getSupabaseAdmin()
          .from(assignmentTable(entry.blockType))
          .update({ is_visible: isVisible, updated_at: now })
          .eq("id", entry.assignmentId)
          .eq("page_id", pageId);
      }),
    );
    const mutationError = mutationResults.find((result) => result?.error)?.error;
    if (mutationError) throw new Error(mutationError.message);
  }

  if (action === "delete") {
    const mutationResults = await Promise.all(
      entries.map((entry) => {
        if (entry.moduleKind === "hero") {
          return getSupabaseAdmin()
            .from("hero_assignments")
            .delete()
            .eq("id", entry.assignmentId)
            .eq("target_id", pageId)
            .eq("target_type", "page");
        }

        if (entry.moduleKind === "media-sidebar") {
          return getSupabaseAdmin()
            .from(MEDIA_SIDEBAR_ASSIGNMENT_TABLE)
            .delete()
            .eq("id", entry.assignmentId)
            .eq("page_id", pageId);
        }

        if (entry.moduleKind === "media-hub") {
          return getSupabaseAdmin()
            .from(MEDIA_HUB_ASSIGNMENT_TABLE)
            .delete()
            .eq("id", entry.assignmentId)
            .eq("page_id", pageId);
        }

        if (!entry.blockType) return Promise.resolve();

        return getSupabaseAdmin()
          .from(assignmentTable(entry.blockType))
          .delete()
          .eq("id", entry.assignmentId)
          .eq("page_id", pageId);
      }),
    );
    const mutationError = mutationResults.find((result) => result?.error)?.error;
    if (mutationError) throw new Error(mutationError.message);
  }

  if (action === "show" || action === "hide" || action === "delete") {
    await auditPageBlockAssignment(
      action === "delete" ? "delete" : action === "show" ? "publish" : "unpublish",
      pageId,
      null,
      { bulk_action: action, assignment_ids: entries.map((entry) => entry.assignmentId) },
    );
  }

  await revalidatePageBlocksPath(pageId);
}
