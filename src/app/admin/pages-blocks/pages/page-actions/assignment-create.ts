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
  nextMediaHubSortOrder,
  nextMediaSidebarSortOrder,
  nextSortOrder,
  resolvePageSlug,
  slotPolicyFailure,
  success,
} from "./helpers";

async function saveAssignment(options: {
  pageId: number;
  kind: PageBlockType | "media-sidebar" | "media-hub";
  templateId: number;
  slot: string;
  sortOrder: number;
  isVisible: boolean;
}): Promise<PageBlockActionResult> {
  const actor = await requireAdminSession();
  const pageSlug = await resolvePageSlug(options.pageId);
  if (!pageSlug) return failure("الصفحة غير موجودة.");
  const slotRejection = slotPolicyFailure(pageSlug, options.kind, options.slot);
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
  return saveAssignment({
    pageId,
    kind: blockType,
    templateId,
    slot: cleanText(formData.get("slot")) || "main",
    sortOrder: parseNumber(formData.get("sort_order"), await nextSortOrder(pageId, blockType)),
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
  return saveAssignment({ pageId, kind: "media-sidebar", templateId, slot: "sidebar",
    sortOrder: parseNumber(formData.get("sort_order"), await nextMediaSidebarSortOrder(pageId)),
    isVisible: parseFormBoolean(formData, "is_visible", true) });
}

export async function assignMediaHubModule(
  _prev: PageBlockActionResult,
  formData: FormData,
) {
  const pageId = parseNumber(formData.get("page_id"));
  const templateId = parseNumber(formData.get("template_id"));
  if (!pageId || !templateId) return failure("بيانات الربط غير مكتملة.");
  return saveAssignment({ pageId, kind: "media-hub", templateId, slot: "main",
    sortOrder: parseNumber(formData.get("sort_order"), await nextMediaHubSortOrder(pageId)),
    isVisible: parseFormBoolean(formData, "is_visible", true) });
}

export async function assignHeroModule(
  _prev: PageBlockActionResult,
  formData: FormData,
) {
  const actor = await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  const heroId = parseNumber(formData.get("template_id"));
  if (!pageId || !heroId) return failure("بيانات ربط الهيرو غير مكتملة.");
  try {
    await mutatePageComposition(pageId, "save_hero_assignment", {
      hero_id: heroId,
      sort_order: parseNumber(formData.get("sort_order"), 0),
      is_visible: true,
    }, actor);
  } catch (error) {
    return failure(error instanceof Error ? error.message : "تعذر حفظ ربط الهيرو.");
  }
  await revalidatePageBlocksPath(pageId);
  return success();
}
