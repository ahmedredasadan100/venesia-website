import { PAGE_LAYOUT_SLOTS, type PageBlockAssignmentRow } from "../../../../../../lib/page-blocks/types";
import type { PageLayoutSlot } from "../../../../../../lib/page-blocks/layout-slots";

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

/** Valid layout slots for a module kind — kinds with >1 option are inline-editable. */
export function getSlotOptions(kind: string): PageLayoutSlot[] {
  if (kind === "hero" || kind === "breadcrumb") return ["hero"];
  if (kind === "feed" || kind === "media-sidebar") return ["sidebar"];
  if (kind === "media-hub") return ["main"];
  return [...PAGE_LAYOUT_SLOTS];
}
