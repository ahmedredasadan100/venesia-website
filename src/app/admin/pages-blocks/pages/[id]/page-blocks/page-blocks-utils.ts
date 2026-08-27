import type {
  PageBlockAssignmentRow,
  PageLayoutSlot,
} from "../../../../../../lib/page-blocks/types";
import { getAssignablePositions } from "../../../../../../lib/page-composition/page-assignment-contract";

export function assignmentRowId(row: PageBlockAssignmentRow) {
  return `${row.module_kind}:${row.id}`;
}

export function isManageableAssignment(row: PageBlockAssignmentRow) {
  return row.manages_assignment_on_page;
}

/**
 * Valid semantic Regions for a module kind.
 * Delegates to the shared Page Composition contract (single source of truth).
 */
export function getSlotOptions(kind: string): PageLayoutSlot[] {
  return getAssignablePositions(kind);
}
