"use client";

import type { TransitionStartFunction } from "react";

import type { PageBlockAssignmentRow } from "../../../../../../lib/page-blocks/types";
import { movePageBlockAssignment } from "../../actions";
import type { ReorderAdjacency } from "./build-reorder-info";
import { assignmentRowId, compareAssignments } from "./page-blocks-utils";

type PageBlocksReorderTable = {
  rawRows: PageBlockAssignmentRow[];
  setRows: (rows: PageBlockAssignmentRow[]) => void;
};

type UsePageBlocksReorderOptions = {
  pageId: number;
  table: PageBlocksReorderTable;
  reorderInfo: Map<string, ReorderAdjacency>;
  setActionMessage: (message: string | null) => void;
  startTransition: TransitionStartFunction;
};

export function usePageBlocksReorder({
  pageId,
  table,
  reorderInfo,
  setActionMessage,
  startTransition,
}: UsePageBlocksReorderOptions) {
  /** Optimistic in-table reorder — swaps sort_order with the adjacent sibling, rolls back on failure. */
  function handleReorder(row: PageBlockAssignmentRow, direction: "up" | "down") {
    const neighbour = reorderInfo.get(assignmentRowId(row));
    const target = direction === "up" ? neighbour?.up : neighbour?.down;
    if (!target) return;

    const previousRows = table.rawRows;
    const nextRows = previousRows
      .map((current) => {
        if (current.module_kind === row.module_kind && current.id === row.id) {
          return { ...current, sort_order: target.sort_order };
        }
        if (current.module_kind === target.module_kind && current.id === target.id) {
          return { ...current, sort_order: row.sort_order };
        }
        return current;
      })
      .sort(compareAssignments);

    table.setRows(nextRows);
    setActionMessage(null);

    const formData = new FormData();
    formData.set("page_id", String(pageId));
    formData.set("block_type", row.module_kind);
    formData.set("current_id", String(row.id));
    formData.set("target_id", String(target.id));

    startTransition(async () => {
      const result = await movePageBlockAssignment(formData);
      if (!result.ok) {
        table.setRows(previousRows);
        setActionMessage(result.message);
      }
    });
  }

  return { handleReorder };
}
