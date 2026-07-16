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
  resolvePageSlug,
  slotPolicyFailure,
  success,
} from "./helpers";

export async function updatePageBlockAssignment(
  _prev: PageBlockActionResult,
  formData: FormData,
): Promise<PageBlockActionResult> {
  await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  const assignmentId = parseNumber(formData.get("assignment_id"));
  const blockType = cleanText(formData.get("block_type")) as PageBlockType | "media-sidebar" | "media-hub";
  const slot = cleanText(formData.get("slot")) || "main";
  const sortOrder = parseNumber(formData.get("sort_order"), 0);
  const isVisible = parseFormBoolean(formData, "is_visible", false);

  if (!pageId || !assignmentId) {
    return failure("بيانات الربط غير مكتملة.");
  }

  const pageSlug = await resolvePageSlug(pageId);
  if (!pageSlug) return failure("الصفحة غير موجودة.");

  if (isMediaSidebarKind(blockType)) {
    const slotRejection = slotPolicyFailure(pageSlug, "media-sidebar", slot);
    if (slotRejection) return slotRejection;
    if (slot !== "sidebar") return failure("موديولات الشريط الجانبي تستخدم slot: sidebar فقط.");

    const { error } = await getSupabaseAdmin()
      .from(MEDIA_SIDEBAR_ASSIGNMENT_TABLE)
      .update({
        slot: "sidebar",
        sort_order: sortOrder,
        is_visible: isVisible,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assignmentId)
      .eq("page_id", pageId);

    if (error) return failure(error.message);

    await auditPageBlockAssignment("update", pageId, assignmentId, { module: "media-sidebar" });
    await revalidatePageBlocksPath(pageId);
    return success();
  }

  if (isMediaHubKind(blockType)) {
    const slotRejection = slotPolicyFailure(pageSlug, "media-hub", slot);
    if (slotRejection) return slotRejection;
    if (slot !== "main") return failure("موديولات Hub تستخدم slot: main فقط.");

    const { error } = await getSupabaseAdmin()
      .from(MEDIA_HUB_ASSIGNMENT_TABLE)
      .update({
        slot: "main",
        sort_order: sortOrder,
        is_visible: isVisible,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assignmentId)
      .eq("page_id", pageId);

    if (error) return failure(error.message);

    await auditPageBlockAssignment("update", pageId, assignmentId, { module: "media-hub" });
    await revalidatePageBlocksPath(pageId);
    return success();
  }

  if (!(blockType in BLOCK_MODULE_REGISTRY)) {
    return failure("بيانات الربط غير مكتملة.");
  }

  const slotRejection = slotPolicyFailure(pageSlug, blockType, slot);
  if (slotRejection) return slotRejection;

  const { error } = await getSupabaseAdmin()
    .from(assignmentTable(blockType))
    .update({
      slot,
      sort_order: sortOrder,
      is_visible: isVisible,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assignmentId)
    .eq("page_id", pageId);

  if (error) return failure(error.message);

  await auditPageBlockAssignment("update", pageId, assignmentId, { block_type: blockType });
  await revalidatePageBlocksPath(pageId);
  return success();
}

export async function updateHeroPageAssignment(
  _prev: PageBlockActionResult,
  formData: FormData,
): Promise<PageBlockActionResult> {
  await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  const assignmentId = parseNumber(formData.get("assignment_id"));
  const sortOrder = parseNumber(formData.get("sort_order"), 0);
  const isVisible = parseFormBoolean(formData, "is_visible", true);

  if (!pageId || !assignmentId) return failure("بيانات الربط غير مكتملة.");

  const { error } = await getSupabaseAdmin()
    .from("hero_assignments")
    .update({ priority: sortOrder, is_active: isVisible })
    .eq("id", assignmentId)
    .eq("target_id", pageId)
    .eq("target_type", "page");

  if (error) return failure(error.message);

  await auditPageBlockAssignment("update", pageId, assignmentId, { module: "hero" });
  await revalidatePageBlocksPath(pageId);
  return success();
}
