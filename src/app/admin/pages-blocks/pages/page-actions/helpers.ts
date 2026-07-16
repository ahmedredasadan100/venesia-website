import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { loadPagesTableRows } from "../../../../../lib/admin/pages/load-pages-table-rows";
import { BLOCK_MODULE_REGISTRY, ALL_ASSIGNMENT_TABLES } from "../../../../../lib/page-blocks/block-module-registry";
import {
  MEDIA_HUB_ASSIGNMENT_TABLE,
} from "../../../../../lib/media-hub-modules/registry";
import {
  MEDIA_SIDEBAR_ASSIGNMENT_TABLE,
} from "../../../../../lib/media-sidebar-modules/registry";
import { type PageBlockActionResult } from "../../../../../lib/page-blocks/action-result";
import type { PageBlockType, PageModuleKind } from "../../../../../lib/page-blocks/types";
import {
  getUnsupportedSlotAssignmentMessage,
  isSlotAllowedForRoute,
} from "../../../../../lib/page-composition/route-slot-policy";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import type { ParsedAssignmentKey } from "./types";

export function pagesListPath(options?: { notice?: string; error?: string }) {
  const params = new URLSearchParams();
  if (options?.notice) params.set("notice", options.notice);
  if (options?.error) params.set("error", options.error);
  const query = params.toString();
  return `/admin/pages-blocks/pages${query ? `?${query}` : ""}`;
}

export async function auditPageBlockAssignment(
  verb: "create" | "update" | "delete" | "reorder" | "publish" | "unpublish" | "duplicate",
  pageId: number,
  assignmentId?: number | null,
  metadata?: Record<string, unknown>,
) {
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("page_block_assignment", verb),
    entityType: "page_block_assignment",
    entityId: assignmentId ?? null,
    metadata: { page_id: pageId, ...metadata },
  });
}

export async function copyPageModuleAssignments(sourcePageId: number, targetPageId: number) {
  for (const table of ALL_ASSIGNMENT_TABLES) {
    const { data, error } = await getSupabaseAdmin()
      .from(table)
      .select("template_id, slot, sort_order, is_visible")
      .eq("page_id", sourcePageId);

    if (error) throw new Error(error.message);
    if (!data?.length) continue;

    const { error: insertError } = await getSupabaseAdmin().from(table).insert(
      data.map((row) => ({
        page_id: targetPageId,
        template_id: row.template_id,
        slot: row.slot,
        sort_order: row.sort_order,
        is_visible: false,
      })),
    );

    if (insertError) throw new Error(insertError.message);
  }
}

export async function copyPageHeroAssignments(
  sourcePageId: number,
  targetPageId: number,
  targetSlug: string,
  targetPath: string,
) {
  const { data, error } = await getSupabaseAdmin()
    .from("hero_assignments")
    .select("hero_id, priority")
    .eq("target_type", "page")
    .eq("target_id", sourcePageId);

  if (error) throw new Error(error.message);
  if (!data?.length) return;

  const { error: insertError } = await getSupabaseAdmin().from("hero_assignments").insert(
    data.map((row) => ({
      hero_id: row.hero_id,
      target_type: "page",
      target_id: targetPageId,
      target_slug: targetSlug,
      path: targetPath,
      is_active: false,
      priority: row.priority,
    })),
  );

  if (insertError) throw new Error(insertError.message);
}

export function isMediaSidebarKind(kind: string) {
  return kind === "media-sidebar";
}

export function isMediaHubKind(kind: string) {
  return kind === "media-hub";
}

export async function resolvePageSlug(pageId: number): Promise<string | null> {
  const { data, error } = await getSupabaseAdmin().from("pages").select("slug").eq("id", pageId).maybeSingle();
  if (error || !data?.slug) return null;
  return String(data.slug);
}

/** Returns Arabic failure result when slot is not allowed for this page + module kind. */
export function slotPolicyFailure(
  pageSlug: string | null,
  moduleKind: string,
  slot: string,
): PageBlockActionResult | null {
  if (isSlotAllowedForRoute(pageSlug, moduleKind, slot)) return null;
  return failure(getUnsupportedSlotAssignmentMessage(pageSlug, moduleKind, slot));
}

export function assignmentTable(blockType: PageBlockType) {
  return BLOCK_MODULE_REGISTRY[blockType].assignmentTable;
}

export function templateTable(blockType: PageBlockType) {
  return BLOCK_MODULE_REGISTRY[blockType].templateTable;
}

export async function nextSortOrder(pageId: number, blockType: PageBlockType) {
  const table = assignmentTable(blockType);
  const { data } = await getSupabaseAdmin()
    .from(table)
    .select("sort_order")
    .eq("page_id", pageId)
    .order("sort_order", { ascending: false })
    .limit(1);

  return ((data?.[0]?.sort_order as number | undefined) ?? 0) + 10;
}

export async function nextMediaSidebarSortOrder(pageId: number) {
  const { data } = await getSupabaseAdmin()
    .from(MEDIA_SIDEBAR_ASSIGNMENT_TABLE)
    .select("sort_order")
    .eq("page_id", pageId)
    .order("sort_order", { ascending: false })
    .limit(1);

  return ((data?.[0]?.sort_order as number | undefined) ?? 0) + 10;
}

export async function nextMediaHubSortOrder(pageId: number) {
  const { data } = await getSupabaseAdmin()
    .from(MEDIA_HUB_ASSIGNMENT_TABLE)
    .select("sort_order")
    .eq("page_id", pageId)
    .order("sort_order", { ascending: false })
    .limit(1);

  return ((data?.[0]?.sort_order as number | undefined) ?? 0) + 10;
}

export function failure(message: string): PageBlockActionResult {
  return { ok: false, message, redirectTo: null };
}

export function success(options?: { message?: string | null; redirectTo?: string | null }): PageBlockActionResult {
  return {
    ok: true,
    message: options?.message ?? null,
    redirectTo: options?.redirectTo ?? null,
  };
}

export function parseAssignmentKeys(formData: FormData): ParsedAssignmentKey[] {
  return formData
    .getAll("ids")
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const [kind, assignmentId] = value.split(":");
      const moduleKind = kind as PageModuleKind;
      return {
        moduleKind,
        blockType:
          moduleKind === "hero" || moduleKind === "media-sidebar" || moduleKind === "media-hub"
            ? null
            : (moduleKind as PageBlockType),
        assignmentId: Number(assignmentId),
      };
    })
    .filter((entry) => Number.isFinite(entry.assignmentId) && entry.moduleKind);
}

export async function loadPagesTableRowsForAdmin() {
  await requireAdminSession();
  return loadPagesTableRows();
}
