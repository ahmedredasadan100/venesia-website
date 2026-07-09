import type { PageBlockAssignmentRow } from "../../../../../../lib/page-blocks/types";
import { assignmentRowId, isManageableAssignment } from "./page-blocks-utils";

export type ReorderAdjacency = {
  up: PageBlockAssignmentRow | null;
  down: PageBlockAssignmentRow | null;
};

/** Up/down neighbour per row, scoped to same module kind + slot, ordered by sort_order. */
export function buildReorderInfo(rows: PageBlockAssignmentRow[]) {
  const groups = new Map<string, PageBlockAssignmentRow[]>();
  for (const row of rows) {
    if (!isManageableAssignment(row)) continue;
    const key = `${row.module_kind}::${row.slot}`;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const info = new Map<string, ReorderAdjacency>();
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    sorted.forEach((row, index) => {
      info.set(assignmentRowId(row), {
        up: index > 0 ? sorted[index - 1] : null,
        down: index < sorted.length - 1 ? sorted[index + 1] : null,
      });
    });
  }
  return info;
}
