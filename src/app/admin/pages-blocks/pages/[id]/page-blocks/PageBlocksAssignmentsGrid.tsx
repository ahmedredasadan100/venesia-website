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
import type { PageCompositionColumnKey } from "../../../../../../lib/page-blocks/admin-collection-columns";
import PageBlocksAssignmentRow from "./PageBlocksAssignmentRow";
import { assignmentRowId, isManageableAssignment } from "./page-blocks-utils";

type SortKey = "module_kind" | "template_name" | "visibility";

// 150px = secondary module-type column (no dedicated preset).
type PageBlocksAssignmentsGridProps = {
  rows: PageBlockAssignmentRow[];
  totalCount: number;
  previewHref: string | null;
  sort: { key: SortKey | null; direction: AdminTableSortDirection };
  onToggleSort: (key: SortKey) => void;
  allSelected: boolean;
  selectedSet: Set<string>;
  selectAllRef: RefObject<HTMLInputElement | null>;
  onToggleAll: (checked: boolean) => void;
  onToggleSelect: (rowId: string, checked: boolean) => void;
  isPending: boolean;
  onToggleVisibility: (row: PageBlockAssignmentRow) => void;
  onDuplicate: (row: PageBlockAssignmentRow) => void;
  onDelete: (row: PageBlockAssignmentRow) => void;
  visibleColumns: ReadonlySet<PageCompositionColumnKey<"pageAssignments">>;
};

export default function PageBlocksAssignmentsGrid({
  rows,
  totalCount,
  previewHref,
  sort,
  onToggleSort,
  allSelected,
  selectedSet,
  selectAllRef,
  onToggleAll,
  onToggleSelect,
  isPending,
  onToggleVisibility,
  onDuplicate,
  onDelete,
  visibleColumns,
}: PageBlocksAssignmentsGridProps) {
  const gridColumns = [
    ADMIN_DATA_GRID_COLUMNS.checkbox,
    ADMIN_DATA_GRID_COLUMNS.primaryStandard,
    visibleColumns.has("module") ? "150px" : null,
    visibleColumns.has("status") ? ADMIN_DATA_GRID_COLUMNS.statusCompact : null,
    ADMIN_DATA_GRID_ACTION_COLUMNS.threeCompact,
  ]
    .filter((column): column is string => Boolean(column))
    .join(" ");

  function sortProps(key: SortKey) {
    return {
      active: sort.key === key,
      direction: sort.direction,
      onClick: () => onToggleSort(key),
    } as const;
  }

  return (
    <AdminDataGrid className="!rounded-t-none !border-t-0" summary={`${totalCount} موديول`}>
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
        {visibleColumns.has("module") ? (
          <AdminDataGridCenterCell>
            <AdminDataGridSortLabel {...sortProps("module_kind")} className="justify-center">النوع</AdminDataGridSortLabel>
          </AdminDataGridCenterCell>
        ) : null}
        {visibleColumns.has("status") ? (
          <AdminDataGridCenterCell>
            <AdminDataGridSortLabel {...sortProps("visibility")} className="justify-center">الحالة</AdminDataGridSortLabel>
          </AdminDataGridCenterCell>
        ) : null}
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
            previewHref={previewHref}
            index={index}
            columns={gridColumns}
            manageable={manageable}
            isVisible={isVisible}
            isSelected={selectedSet.has(rowId)}
            isPending={isPending}
            onToggleSelect={(checked) => onToggleSelect(rowId, checked)}
            onToggleVisibility={() => onToggleVisibility(row)}
            onDuplicate={() => onDuplicate(row)}
            onDelete={() => onDelete(row)}
            showModule={visibleColumns.has("module")}
            showStatus={visibleColumns.has("status")}
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
