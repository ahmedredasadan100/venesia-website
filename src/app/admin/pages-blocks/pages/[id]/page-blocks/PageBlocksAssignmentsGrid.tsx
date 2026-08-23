import { useRef, type RefObject } from "react";

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
import type { PageLayoutSlot } from "../../../../../../lib/page-blocks/layout-slots";
import type { PageCompositionColumnKey } from "../../../../../../lib/page-blocks/admin-collection-columns";
import type { AdminInstantMutationRowInteraction } from "../../../../../../lib/admin/entity-list/data-engine/instant-mutation";
import PageBlocksAssignmentRow from "./PageBlocksAssignmentRow";
import { assignmentRowId, isManageableAssignment } from "./page-blocks-utils";

type SortKey = "module_kind" | "template_name" | "slot" | "visibility";

// 150px = secondary module-type column (no dedicated preset).
type PageBlocksAssignmentsGridProps = {
  rows: PageBlockAssignmentRow[];
  previewHref: string | null;
  sort: { key: SortKey | null; direction: AdminTableSortDirection };
  onToggleSort: (key: SortKey) => void;
  allSelected: boolean;
  selectedSet: Set<string>;
  selectAllRef: RefObject<HTMLInputElement | null>;
  onToggleAll: (checked: boolean) => void;
  onToggleSelect: (rowId: string, checked: boolean) => void;
  rowInteraction: (rowId: string) => AdminInstantMutationRowInteraction;
  onToggleVisibility: (row: PageBlockAssignmentRow) => Promise<void>;
  getDisplayPositionOptions: (row: PageBlockAssignmentRow) => PageLayoutSlot[];
  onDisplayPositionChange: (row: PageBlockAssignmentRow, slot: PageLayoutSlot) => void;
  onDuplicate: (row: PageBlockAssignmentRow) => void;
  onDetach: (row: PageBlockAssignmentRow) => void;
  getReorderPosition: (row: PageBlockAssignmentRow) => { position: number; count: number };
  onReorder: (row: PageBlockAssignmentRow, targetPosition: number) => void;
  manualReorderEnabled: boolean;
  visibleColumns: ReadonlySet<PageCompositionColumnKey<"pageAssignments">>;
};

export default function PageBlocksAssignmentsGrid({
  rows,
  previewHref,
  sort,
  onToggleSort,
  allSelected,
  selectedSet,
  selectAllRef,
  onToggleAll,
  onToggleSelect,
  rowInteraction,
  onToggleVisibility,
  getDisplayPositionOptions,
  onDisplayPositionChange,
  onDuplicate,
  onDetach,
  getReorderPosition,
  onReorder,
  manualReorderEnabled,
  visibleColumns,
}: PageBlocksAssignmentsGridProps) {
  const draggedRowIdRef = useRef<string | null>(null);
  const gridColumns = [
    ADMIN_DATA_GRID_COLUMNS.checkbox,
    ADMIN_DATA_GRID_COLUMNS.reorder,
    ADMIN_DATA_GRID_COLUMNS.primaryStandard,
    visibleColumns.has("module") ? "150px" : null,
    ADMIN_DATA_GRID_COLUMNS.displayPosition,
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
    <AdminDataGrid surface="embedded">
      <AdminDataGridHeader columns={gridColumns}>
        <AdminDataGridCheckboxCell>
          <AdminDataGridCheckbox
            checked={allSelected}
            onChange={(event) => onToggleAll(event.target.checked)}
            inputRef={selectAllRef}
            label="تحديد الكل"
          />
        </AdminDataGridCheckboxCell>
        <AdminDataGridCenterCell>ترتيب</AdminDataGridCenterCell>
        <AdminDataGridPrimaryCell>
          <AdminDataGridSortLabel {...sortProps("template_name")} className="justify-end">القالب</AdminDataGridSortLabel>
        </AdminDataGridPrimaryCell>
        {visibleColumns.has("module") ? (
          <AdminDataGridCenterCell>
            <AdminDataGridSortLabel {...sortProps("module_kind")} className="justify-center">النوع</AdminDataGridSortLabel>
          </AdminDataGridCenterCell>
        ) : null}
        <AdminDataGridCenterCell>
          <AdminDataGridSortLabel {...sortProps("slot")} className="justify-center">موضع العرض</AdminDataGridSortLabel>
        </AdminDataGridCenterCell>
        {visibleColumns.has("status") ? (
          <AdminDataGridCenterCell>
            <AdminDataGridSortLabel {...sortProps("visibility")} className="justify-center">الحالة</AdminDataGridSortLabel>
          </AdminDataGridCenterCell>
        ) : null}
        <div className="text-center">الإجراءات</div>
      </AdminDataGridHeader>

      {rows.map((row, index) => {
        const rowId = assignmentRowId(row);
        const isVisible = normalizeBoolean(row.is_publicly_visible, false);
        const manageable = isManageableAssignment(row);
        const interaction = rowInteraction(rowId);
        const reorder = getReorderPosition(row);
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
            interaction={interaction}
            onToggleSelect={(checked) => onToggleSelect(rowId, checked)}
            onToggleVisibility={() => onToggleVisibility(row)}
            displayPositionOptions={getDisplayPositionOptions(row)}
            onDisplayPositionChange={(slot) => onDisplayPositionChange(row, slot)}
            onDuplicate={() => onDuplicate(row)}
            onDetach={() => onDetach(row)}
            reorderPosition={reorder.position}
            reorderCount={reorder.count}
            manualReorderEnabled={manualReorderEnabled}
            onMoveTo={(targetPosition) => onReorder(row, targetPosition)}
            onDragStart={(event) => {
              draggedRowIdRef.current = rowId;
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", rowId);
            }}
            onDragOver={(event) => {
              if (!manualReorderEnabled || !draggedRowIdRef.current) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => {
              event.preventDefault();
              const sourceId = draggedRowIdRef.current || event.dataTransfer.getData("text/plain");
              const source = rows.find((candidate) => assignmentRowId(candidate) === sourceId);
              draggedRowIdRef.current = null;
              if (!source || source.slot !== row.slot) return;
              onReorder(source, reorder.position);
            }}
            onDragEnd={() => {
              draggedRowIdRef.current = null;
            }}
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
