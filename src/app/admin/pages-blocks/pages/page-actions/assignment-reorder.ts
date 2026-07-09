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
import { cleanText, parseNumber } from "../../../../../lib/page-blocks/admin-utils";
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

/**
 * Swaps sort_order between an assignment and its adjacent sibling (same module kind).
 * Mirrors the approved menu reorder technique — no schema change, no new order system.
 */
export async function movePageBlockAssignment(formData: FormData): Promise<PageBlockActionResult> {
  await requireAdminSession();
  const pageId = parseNumber(formData.get("page_id"));
  const moduleKind = cleanText(formData.get("block_type")) as PageBlockType | "hero" | "media-sidebar" | "media-hub";
  const currentId = parseNumber(formData.get("current_id"));
  const targetId = parseNumber(formData.get("target_id"));

  if (!pageId || !currentId || !targetId) return failure("تعذر إعادة الترتيب.");

  if (moduleKind === "hero") {
    const { data: rows, error } = await getSupabaseAdmin()
      .from("hero_assignments")
      .select("id, priority")
      .eq("target_type", "page")
      .eq("target_id", pageId)
      .in("id", [currentId, targetId]);

    if (error || !rows || rows.length !== 2) return failure(error?.message ?? "تعذر إعادة الترتيب.");

    const current = rows.find((row) => Number(row.id) === currentId);
    const target = rows.find((row) => Number(row.id) === targetId);
    if (!current || !target) return failure("تعذر إعادة الترتيب.");

    const currentOrder = Number(current.priority ?? 0);
    const targetOrder = Number(target.priority ?? 0);

    const { error: e1 } = await getSupabaseAdmin()
      .from("hero_assignments")
      .update({ priority: targetOrder })
      .eq("id", currentId)
      .eq("target_id", pageId)
      .eq("target_type", "page");
    if (e1) return failure(e1.message);

    const { error: e2 } = await getSupabaseAdmin()
      .from("hero_assignments")
      .update({ priority: currentOrder })
      .eq("id", targetId)
      .eq("target_id", pageId)
      .eq("target_type", "page");
    if (e2) return failure(e2.message);

    await auditPageBlockAssignment("reorder", pageId, currentId, { module: "hero", target_id: targetId });
    await revalidatePageBlocksPath(pageId);
    return success();
  }

  const table = isMediaSidebarKind(moduleKind)
    ? MEDIA_SIDEBAR_ASSIGNMENT_TABLE
    : isMediaHubKind(moduleKind)
      ? MEDIA_HUB_ASSIGNMENT_TABLE
      : moduleKind in BLOCK_MODULE_REGISTRY
        ? assignmentTable(moduleKind as PageBlockType)
        : null;

  if (!table) return failure("نوع الموديول غير مدعوم.");

  const { data: rows, error } = await getSupabaseAdmin()
    .from(table)
    .select("id, sort_order")
    .eq("page_id", pageId)
    .in("id", [currentId, targetId]);

  if (error || !rows || rows.length !== 2) return failure(error?.message ?? "تعذر إعادة الترتيب.");

  const current = rows.find((row) => Number(row.id) === currentId);
  const target = rows.find((row) => Number(row.id) === targetId);
  if (!current || !target) return failure("تعذر إعادة الترتيب.");

  const currentOrder = Number(current.sort_order ?? 0);
  const targetOrder = Number(target.sort_order ?? 0);
  const now = new Date().toISOString();

  const { error: e1 } = await getSupabaseAdmin()
    .from(table)
    .update({ sort_order: targetOrder, updated_at: now })
    .eq("id", currentId)
    .eq("page_id", pageId);
  if (e1) return failure(e1.message);

  const { error: e2 } = await getSupabaseAdmin()
    .from(table)
    .update({ sort_order: currentOrder, updated_at: now })
    .eq("id", targetId)
    .eq("page_id", pageId);
  if (e2) return failure(e2.message);

  await auditPageBlockAssignment("reorder", pageId, currentId, {
    module: moduleKind,
    target_id: targetId,
  });
  await revalidatePageBlocksPath(pageId);
  return success();
}
