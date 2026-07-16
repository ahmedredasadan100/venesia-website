import { PAGE_LAYOUT_SLOTS, type PageLayoutSlot, type PageBlockAssignmentRow } from "../../../../../../lib/page-blocks/types";
import { getAssignableSlotsForRoute } from "../../../../../../lib/page-composition/route-slot-policy";

export function assignmentRowId(row: PageBlockAssignmentRow) {
  return `${row.module_kind}:${row.id}`;
}

export function isManageableAssignment(row: PageBlockAssignmentRow) {
  return row.manages_assignment_on_page;
}

/** Canonical row order — mirrors getPageModuleAssignmentsForAdmin so optimistic order == server order. */
export function compareAssignments(a: PageBlockAssignmentRow, b: PageBlockAssignmentRow) {
  const kindOrder = (kind: string) => (kind === "hero" ? -2 : kind === "breadcrumb" ? -1 : 0);
  const byKind = kindOrder(a.module_kind) - kindOrder(b.module_kind);
  if (byKind !== 0) return byKind;
  return a.sort_order - b.sort_order || a.id - b.id;
}

/**
 * Valid layout slots for a module kind on a page.
 * Delegates to the shared route-slot policy (single source of truth).
 */
export function getSlotOptions(kind: string, pageSlug?: string | null): PageLayoutSlot[] {
  return getAssignableSlotsForRoute(pageSlug, kind);
}

/** Kind-only fallback (no page context) — prefer getSlotOptions(kind, pageSlug). */
export function getKindOnlySlotOptions(kind: string): PageLayoutSlot[] {
  if (kind === "hero" || kind === "breadcrumb") return ["hero"];
  if (kind === "feed" || kind === "media-sidebar") return ["sidebar"];
  if (kind === "media-hub") return ["main"];
  return [...PAGE_LAYOUT_SLOTS];
}
