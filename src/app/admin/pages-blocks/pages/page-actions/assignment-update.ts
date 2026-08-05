"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { BLOCK_MODULE_REGISTRY } from "../../../../../lib/page-blocks/block-module-registry";
import { type PageBlockActionResult } from "../../../../../lib/page-blocks/action-result";
import { revalidatePageBlocksPath } from "../../../../../lib/page-blocks/admin-revalidate";
import { cleanText, parseFormBoolean, parseNumber } from "../../../../../lib/page-blocks/admin-utils";
import type { PageBlockType } from "../../../../../lib/page-blocks/types";
import {
  databaseAssignmentKind,
  failure,
  mutatePageComposition,
  resolvePageSlug,
  slotPolicyFailure,
  success,
} from "./helpers";

export async function updatePageBlockAssignment(
  _prev: PageBlockActionResult,
  formData: FormData,
): Promise<PageBlockActionResult> {
  const actor = await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  const assignmentId = parseNumber(formData.get("assignment_id"));
  const kind = cleanText(formData.get("block_type")) as PageBlockType | "media-sidebar" | "media-hub";
  const slot = cleanText(formData.get("slot")) || "main";
  if (!pageId || !assignmentId || (!(kind in BLOCK_MODULE_REGISTRY) && kind !== "media-sidebar" && kind !== "media-hub")) {
    return failure("بيانات الربط غير مكتملة.");
  }
  const pageSlug = await resolvePageSlug(pageId);
  if (!pageSlug) return failure("الصفحة غير موجودة.");
  const slotRejection = slotPolicyFailure(pageSlug, kind, slot);
  if (slotRejection) return slotRejection;
  try {
    await mutatePageComposition(pageId, "save_assignment", {
      kind: databaseAssignmentKind(kind),
      assignment_id: assignmentId,
      slot,
      sort_order: parseNumber(formData.get("sort_order"), 0),
      is_visible: parseFormBoolean(formData, "is_visible", false),
    }, actor);
  } catch (error) {
    return failure(error instanceof Error ? error.message : "تعذر تحديث الربط.");
  }
  await revalidatePageBlocksPath(pageId);
  return success();
}

export async function updateHeroPageAssignment(
  _prev: PageBlockActionResult,
  formData: FormData,
): Promise<PageBlockActionResult> {
  const actor = await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  const assignmentId = parseNumber(formData.get("assignment_id"));
  const heroId = parseNumber(formData.get("template_id"));
  if (!pageId || !assignmentId || !heroId) return failure("بيانات الربط غير مكتملة.");
  try {
    await mutatePageComposition(pageId, "save_hero_assignment", {
      assignment_id: assignmentId,
      hero_id: heroId,
      sort_order: parseNumber(formData.get("sort_order"), 0),
      is_visible: parseFormBoolean(formData, "is_visible", true),
    }, actor);
  } catch (error) {
    return failure(error instanceof Error ? error.message : "تعذر تحديث ربط الهيرو.");
  }
  await revalidatePageBlocksPath(pageId);
  return success();
}
