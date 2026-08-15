import type {
  PageBlockAssignmentRow,
  PageLayoutSlot,
} from "../../../../../../lib/page-blocks/types";
import { getAssignableSlotsForRoute } from "../../../../../../lib/page-composition/route-slot-policy";

export function assignmentRowId(row: PageBlockAssignmentRow) {
  return `${row.module_kind}:${row.id}`;
}

export function isManageableAssignment(row: PageBlockAssignmentRow) {
  return row.manages_assignment_on_page;
}

/**
 * Valid layout slots for a module kind on a page.
 * Delegates to the shared route-slot policy (single source of truth).
 */
export function getSlotOptions(kind: string, pageSlug?: string | null): PageLayoutSlot[] {
  return getAssignableSlotsForRoute(pageSlug, kind);
}
