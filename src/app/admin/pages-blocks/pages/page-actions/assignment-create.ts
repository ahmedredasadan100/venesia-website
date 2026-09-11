"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { BLOCK_MODULE_REGISTRY } from "../../../../../lib/page-blocks/block-module-registry";
import { type PageBlockActionResult } from "../../../../../lib/page-blocks/action-result";
import { revalidatePageBlocksPath } from "../../../../../lib/page-blocks/admin-revalidate";
import { cleanText, parseFormBoolean, parseNumber } from "../../../../../lib/page-blocks/admin-utils";
import { getHeroAssignmentConflicts } from "../../../../../lib/page-blocks/module-assignments-query";
import type { PageBlockType } from "../../../../../lib/page-blocks/types";
import { getDefaultAssignmentPosition } from "../../../../../lib/page-composition/page-assignment-contract";
import {
  databaseAssignmentKind,
  failure,
  mutatePageComposition,
  nextPageCompositionSortOrder,
  pageExists,
  positionPolicyFailure,
  success,
} from "./helpers";

async function resolveRequestedSortOrder(
  formData: FormData,
  pageId: number,
  slot: string,
) {
  const rawSortOrder = cleanText(formData.get("sort_order"));
  return rawSortOrder
    ? parseNumber(rawSortOrder, 0)
    : nextPageCompositionSortOrder(pageId, slot);
}

async function saveAssignment(options: {
  pageId: number;
  kind: PageBlockType | "media-sidebar" | "media-hub";
  templateId: number;
  slot: string;
  sortOrder: number;
  isVisible: boolean;
}): Promise<PageBlockActionResult> {
  const actor = await requireAdminSession();
  if (!(await pageExists(options.pageId))) return failure("الصفحة غير موجودة.");
  const slotRejection = positionPolicyFailure(options.kind, options.slot);
  if (slotRejection) return slotRejection;
  try {
    await mutatePageComposition(options.pageId, "save_assignment", {
      kind: databaseAssignmentKind(options.kind),
      template_id: options.templateId,
      slot: options.slot,
      sort_order: options.sortOrder,
      is_visible: options.isVisible,
    }, actor);
  } catch (error) {
    return failure(error instanceof Error ? error.message : "تعذر حفظ ربط الموديول.");
  }
  await revalidatePageBlocksPath(options.pageId);
  return success();
}

export async function assignPageBlock(
  _prev: PageBlockActionResult,
  formData: FormData,
): Promise<PageBlockActionResult> {
  const pageId = parseNumber(formData.get("page_id"));
  const blockType = cleanText(formData.get("block_type")) as PageBlockType;
  const templateId = parseNumber(formData.get("template_id"));
  if (!pageId || !templateId || !(blockType in BLOCK_MODULE_REGISTRY)) return failure("بيانات الربط غير مكتملة.");
  const slot = cleanText(formData.get("slot")) || getDefaultAssignmentPosition(blockType);
  return saveAssignment({
    pageId,
    kind: blockType,
    templateId,
    slot,
    sortOrder: await resolveRequestedSortOrder(formData, pageId, slot),
    isVisible: parseFormBoolean(formData, "is_visible", true),
  });
}

export async function assignMediaSidebarModule(
  _prev: PageBlockActionResult,
  formData: FormData,
) {
  const pageId = parseNumber(formData.get("page_id"));
  const templateId = parseNumber(formData.get("template_id"));
  if (!pageId || !templateId) return failure("بيانات الربط غير مكتملة.");
  const slot = cleanText(formData.get("slot")) || getDefaultAssignmentPosition("media-sidebar");
  return saveAssignment({
    pageId,
    kind: "media-sidebar",
    templateId,
    slot,
    sortOrder: await resolveRequestedSortOrder(formData, pageId, slot),
    isVisible: parseFormBoolean(formData, "is_visible", true),
  });
}

export async function assignMediaHubModule(
  _prev: PageBlockActionResult,
  formData: FormData,
) {
  const pageId = parseNumber(formData.get("page_id"));
  const templateId = parseNumber(formData.get("template_id"));
  if (!pageId || !templateId) return failure("بيانات الربط غير مكتملة.");
  const slot = cleanText(formData.get("slot")) || getDefaultAssignmentPosition("media-hub");
  return saveAssignment({
    pageId,
    kind: "media-hub",
    templateId,
    slot,
    sortOrder: await resolveRequestedSortOrder(formData, pageId, slot),
    isVisible: parseFormBoolean(formData, "is_visible", true),
  });
}

export async function assignHeroModule(
  _prev: PageBlockActionResult,
  formData: FormData,
) {
  const actor = await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  const heroId = parseNumber(formData.get("template_id"));
  if (!pageId || !heroId) return failure("بيانات ربط الهيرو غير مكتملة.");
  if (!(await pageExists(pageId))) return failure("الصفحة غير موجودة.");
  const slot = getDefaultAssignmentPosition("hero");
  const slotRejection = positionPolicyFailure(
    "hero",
    slot,
  );
  if (slotRejection) return slotRejection;
  try {
    if ((await getHeroAssignmentConflicts([pageId])).length) {
      return failure("الصفحة مرتبطة بهيرو واحد بالفعل. عدّل الربط الحالي أو أزله أولًا.");
    }
    await mutatePageComposition(pageId, "save_hero_assignment", {
      hero_id: heroId,
      sort_order: 0,
      is_visible: parseFormBoolean(formData, "is_visible", true),
    }, actor);
  } catch (error) {
    return failure(error instanceof Error ? error.message : "تعذر حفظ ربط الهيرو.");
  }
  await revalidatePageBlocksPath(pageId);
  return success();
}
