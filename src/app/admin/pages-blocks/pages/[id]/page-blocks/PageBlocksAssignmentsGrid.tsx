import type { RefObject } from "react";

import {
  ADMIN_DATA_GRID_ACTION_COLUMNS,
  ADMIN_DATA_GRID_COLUMNS,
  AdminDataGrid,
  AdminDataGridCenterCell,
  AdminDataGridCheckbox,
  AdminDataGridCheckboxCell,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridPrimaryCell,
  AdminDataGridSortLabel,
} from "../../../../../../components/admin/ui";
import type { AdminTableSortDirection } from "../../../../../../components/admin/table-engine";
import { normalizeBoolean } from "../../../../../../lib/page-blocks/admin-utils";
import type { PageBlockAssignmentRow } from "../../../../../../lib/page-blocks/types";
import type { ReorderAdjacency } from "./build-reorder-info";
import PageBlocksAssignmentRow from "./PageBlocksAssignmentRow";
import { assignmentRowId, isManageableAssignment } from "./page-blocks-utils";

type SortKey = "module_kind" | "template_name" | "visibility";

// 150px = secondary module-type column (no dedicated preset).
const gridColumns = `${ADMIN_DATA_GRID_COLUMNS.checkbox} ${ADMIN_DATA_GRID_COLUMNS.primaryStandard} 150px ${ADMIN_DATA_GRID_COLUMNS.statusCompact} ${ADMIN_DATA_GRID_ACTION_COLUMNS.sixCompact}`;

type PageBlocksAssignmentsGridProps = {
  rows: PageBlockAssignmentRow[];
  sort: { key: SortKey | null; direction: AdminTableSortDirection };
  onToggleSort: (key: SortKey) => void;
  allSelected: boolean;
  selectedSet: Set<string>;
  selectAllRef: RefObject<HTMLInputElement | null>;
  onToggleAll: (checked: boolean) => void;
  onToggleSelect: (rowId: string, checked: boolean) => void;
  isPending: boolean;
  reorderInfo: Map<string, ReorderAdjacency>;
  onReorder: (row: PageBlockAssignmentRow, direction: "up" | "down") => void;
  onToggleVisibility: (row: PageBlockAssignmentRow) => void;
  onDuplicate: (row: PageBlockAssignmentRow) => void;
  onDelete: (row: PageBlockAssignmentRow) => void;
};

export default function PageBlocksAssignmentsGrid({
  rows,
  sort,
  onToggleSort,
  allSelected,
  selectedSet,
  selectAllRef,
  onToggleAll,
  onToggleSelect,
  isPending,
  reorderInfo,
  onReorder,
  onToggleVisibility,
  onDuplicate,
  onDelete,
}: PageBlocksAssignmentsGridProps) {
  function sortProps(key: SortKey) {
    return {
      active: sort.key === key,
      direction: sort.direction,
      onClick: () => onToggleSort(key),
    } as const;
  }

  return (
    <AdminDataGrid summary={`${rows.length} موديول`}>
      <AdminDataGridHeader columns={gridColumns}>
        <AdminDataGridCheckboxCell>
          <AdminDataGridCheckbox
            checked={allSelected}
            onChange={(event) => onToggleAll(event.target.checked)}
            inputRef={selectAllRef}
            label="تحديد الكل"
          />
        </AdminDataGridCheckboxCell>
        <AdminDataGridPrimaryCell>
          <AdminDataGridSortLabel {...sortProps("template_name")} className="justify-end">القالب</AdminDataGridSortLabel>
        </AdminDataGridPrimaryCell>
        <AdminDataGridCenterCell>
          <AdminDataGridSortLabel {...sortProps("module_kind")} className="justify-center">النوع</AdminDataGridSortLabel>
        </AdminDataGridCenterCell>
        <AdminDataGridCenterCell>
          <AdminDataGridSortLabel {...sortProps("visibility")} className="justify-center">الحالة</AdminDataGridSortLabel>
        </AdminDataGridCenterCell>
        <div className="text-center">الإجراءات</div>
      </AdminDataGridHeader>

      {rows.map((row, index) => {
        const rowId = assignmentRowId(row);
        const isVisible = normalizeBoolean(row.is_visible, true);
        const manageable = isManageableAssignment(row);
        return (
          <PageBlocksAssignmentRow
            key={rowId}
            row={row}
            rowId={rowId}
            index={index}
            columns={gridColumns}
            manageable={manageable}
            isVisible={isVisible}
            isSelected={selectedSet.has(rowId)}
            isPending={isPending}
            canReorderUp={Boolean(reorderInfo.get(rowId)?.up)}
            canReorderDown={Boolean(reorderInfo.get(rowId)?.down)}
            onToggleSelect={(checked) => onToggleSelect(rowId, checked)}
            onReorder={(direction) => onReorder(row, direction)}
            onToggleVisibility={() => onToggleVisibility(row)}
            onDuplicate={() => onDuplicate(row)}
            onDelete={() => onDelete(row)}
          />
        );
      })}

      {!rows.length ? (
        <AdminDataGridEmpty>
          لا توجد موديولات معيّنة. أنشئ موديولًا من Blocks Hub ثم اضغط «ربط موديول»، أو عيّن Hero من Hero Manager.
        </AdminDataGridEmpty>
      ) : null}
    </AdminDataGrid>
  );
}
