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

const PAGE_STRUCTURE_DISPLAY_PRIORITY: Partial<
  Record<PageBlockAssignmentRow["module_kind"], number>
> = {
  hero: 0,
  breadcrumb: 1,
};

/**
 * Present the page structure from top to bottom without changing Assignment
 * Position, persisted sort_order, or the relative order of the remaining rows.
 */
export function orderPageCompositionRowsForDisplay<
  TRow extends Pick<PageBlockAssignmentRow, "module_kind">,
>(rows: readonly TRow[]): TRow[] {
  return rows
    .map((row, sourceIndex) => ({ row, sourceIndex }))
    .sort(
      (left, right) =>
        (PAGE_STRUCTURE_DISPLAY_PRIORITY[left.row.module_kind] ?? 2) -
          (PAGE_STRUCTURE_DISPLAY_PRIORITY[right.row.module_kind] ?? 2) ||
        left.sourceIndex - right.sourceIndex,
    )
    .map(({ row }) => row);
}

/**
 * Valid semantic Regions for a module kind.
 * Delegates to the shared Page Composition contract (single source of truth).
 */
export function getSlotOptions(kind: string): PageLayoutSlot[] {
  return getAssignablePositions(kind);
}
