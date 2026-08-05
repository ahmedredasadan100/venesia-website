import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { loadPagesTableRows } from "../../../../../lib/admin/pages/load-pages-table-rows";
import { BLOCK_MODULE_REGISTRY } from "../../../../../lib/page-blocks/block-module-registry";
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

export function databaseAssignmentKind(kind: string) {
  return kind === "media-sidebar" ? "media_sidebar" : kind === "media-hub" ? "media_hub" : kind;
}

export async function mutatePageComposition(
  pageId: number,
  operation: string,
  payload: Record<string, unknown>,
  actor: { id: number; username: string },
) {
  const { data, error } = await getSupabaseAdmin().rpc("mutate_page_composition", {
    p_page_id: pageId,
    p_operation: operation,
    p_payload: payload,
    p_actor_admin_user_id: actor.id,
    p_actor_username: actor.username,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Page Composition atomic mutation returned an invalid result.");
  }
  return data as Record<string, unknown>;
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
