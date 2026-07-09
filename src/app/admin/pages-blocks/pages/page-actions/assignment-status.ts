"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { BLOCK_MODULE_REGISTRY } from "../../../../../lib/page-blocks/block-module-registry";
import {
  MEDIA_HUB_ASSIGNMENT_TABLE,
} from "../../../../../lib/media-hub-modules/registry";
import {
  MEDIA_SIDEBAR_ASSIGNMENT_TABLE,
} from "../../../../../lib/media-sidebar-modules/registry";
import { type PageBlockActionResult } from "../../../../../lib/page-blocks/action-result";
import { revalidatePageBlocksPath } from "../../../../../lib/page-blocks/admin-revalidate";
import { cleanText, parseFormBoolean, parseNumber } from "../../../../../lib/page-blocks/admin-utils";
import type { PageBlockType } from "../../../../../lib/page-blocks/types";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  assignmentTable,
  auditPageBlockAssignment,
  failure,
  isMediaHubKind,
  isMediaSidebarKind,
  success,
} from "./helpers";

export async function togglePageBlockAssignment(formData: FormData): Promise<PageBlockActionResult> {
  await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  const assignmentId = parseNumber(formData.get("assignment_id"));
  const blockType = cleanText(formData.get("block_type")) as PageBlockType | "hero" | "media-sidebar" | "media-hub";
  const nextVisible = parseFormBoolean(formData, "next_visible", false);
  const visibilityVerb = nextVisible ? "publish" : "unpublish";

  if (!pageId || !assignmentId) return failure("بيانات الربط غير مكتملة.");

  if (blockType === "hero") {
    const { error } = await getSupabaseAdmin()
      .from("hero_assignments")
      .update({ is_active: nextVisible })
      .eq("id", assignmentId)
      .eq("target_id", pageId)
      .eq("target_type", "page");

    if (error) return failure(error.message);
    await auditPageBlockAssignment(visibilityVerb, pageId, assignmentId, { module: "hero" });
    await revalidatePageBlocksPath(pageId);
    return success();
  }

  if (isMediaSidebarKind(blockType)) {
    const { error } = await getSupabaseAdmin()
      .from(MEDIA_SIDEBAR_ASSIGNMENT_TABLE)
      .update({ is_visible: nextVisible, updated_at: new Date().toISOString() })
      .eq("id", assignmentId)
      .eq("page_id", pageId);

    if (error) return failure(error.message);
    await auditPageBlockAssignment(visibilityVerb, pageId, assignmentId, { module: "media-sidebar" });
    await revalidatePageBlocksPath(pageId);
    return success();
  }

  if (isMediaHubKind(blockType)) {
    const { error } = await getSupabaseAdmin()
      .from(MEDIA_HUB_ASSIGNMENT_TABLE)
      .update({ is_visible: nextVisible, updated_at: new Date().toISOString() })
      .eq("id", assignmentId)
      .eq("page_id", pageId);

    if (error) return failure(error.message);
    await auditPageBlockAssignment(visibilityVerb, pageId, assignmentId, { module: "media-hub" });
    await revalidatePageBlocksPath(pageId);
    return success();
  }

  if (!(blockType in BLOCK_MODULE_REGISTRY)) return failure("نوع الموديول غير مدعوم.");

  const { error } = await getSupabaseAdmin()
    .from(assignmentTable(blockType))
    .update({ is_visible: nextVisible, updated_at: new Date().toISOString() })
    .eq("id", assignmentId)
    .eq("page_id", pageId);

  if (error) return failure(error.message);

  await auditPageBlockAssignment(visibilityVerb, pageId, assignmentId, { block_type: blockType });
  await revalidatePageBlocksPath(pageId);
  return success();
}
