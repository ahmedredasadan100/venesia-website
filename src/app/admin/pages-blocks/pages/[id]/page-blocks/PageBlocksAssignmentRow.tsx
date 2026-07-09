import Link from "next/link";

import {
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
  AdminDataGridCenterCell,
  AdminDataGridCheckbox,
  AdminDataGridCheckboxCell,
  AdminDataGridPrimaryCell,
  AdminDataGridRow,
  AdminDataGridStatusCell,
  AdminStatusPill,
} from "../../../../../../components/admin/ui";
import { moduleEditHref, moduleKindLabel } from "../../../../../../lib/page-blocks/admin-utils";
import type { PageBlockAssignmentRow } from "../../../../../../lib/page-blocks/types";

type PageBlocksAssignmentRowProps = {
  row: PageBlockAssignmentRow;
  rowId: string;
  index: number;
  columns: string;
  manageable: boolean;
  isVisible: boolean;
  isSelected: boolean;
  isPending: boolean;
  canReorderUp: boolean;
  canReorderDown: boolean;
  onToggleSelect: (checked: boolean) => void;
  onReorder: (direction: "up" | "down") => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
};

export default function PageBlocksAssignmentRow({
  row,
  index,
  columns,
  manageable,
  isVisible,
  isSelected,
  isPending,
  canReorderUp,
  canReorderDown,
  onToggleSelect,
  onReorder,
  onToggleVisibility,
  onDelete,
}: PageBlocksAssignmentRowProps) {
  return (
    <AdminDataGridRow
      columns={columns}
      divided={index > 0}
    >
      <AdminDataGridCheckboxCell>
        {manageable ? (
          <AdminDataGridCheckbox
            checked={isSelected}
            onChange={(event) => onToggleSelect(event.target.checked)}
            label={`تحديد ${row.template_name}`}
          />
        ) : (
          <span className="text-xs text-white/25">—</span>
        )}
      </AdminDataGridCheckboxCell>

      <AdminDataGridPrimaryCell className="flex items-center gap-2">
        <Link
          href={moduleEditHref(row.module_kind, row.template_id)}
          className="min-w-0 truncate text-sm font-semibold text-white hover:text-[#D8B87A]"
          title={row.template_slug}
        >
          {row.template_name}
        </Link>
        {row.module_kind !== "hero" && row.template_status !== "published" ? (
          <span className="shrink-0 rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-200/85">
            غير منشور
          </span>
        ) : null}
      </AdminDataGridPrimaryCell>

      <AdminDataGridCenterCell className="truncate text-sm font-semibold text-white/75">
        {moduleKindLabel(row.module_kind)}
      </AdminDataGridCenterCell>

      <AdminDataGridStatusCell>
        <AdminStatusPill tone={isVisible ? "green" : "muted"}>
          {isVisible ? "ظاهر" : "مخفي"}
        </AdminStatusPill>
      </AdminDataGridStatusCell>

      <AdminDataGridActionsCell compact>
        {manageable ? (
          <>
            <AdminDataGridActionButton
              tone="dark"
              title="تحريك لأعلى"
              size="compact"
              disabled={isPending || !canReorderUp}
              onClick={() => onReorder("up")}
            >
              <span className="text-sm">↑</span>
            </AdminDataGridActionButton>
            <AdminDataGridActionButton
              tone="dark"
              title="تحريك لأسفل"
              size="compact"
              disabled={isPending || !canReorderDown}
              onClick={() => onReorder("down")}
            >
              <span className="text-sm">↓</span>
            </AdminDataGridActionButton>
          </>
        ) : null}
        <AdminDataGridActionButton
          action="edit"
          title="تعديل الموديول"
          href={moduleEditHref(row.module_kind, row.template_id)}
          size="compact"
        />
        {manageable ? (
          <>
            <AdminDataGridActionButton
              action="visibility"
              title={isVisible ? "إخفاء" : "إظهار"}
              size="compact"
              disabled={isPending}
              onClick={onToggleVisibility}
            />
            <AdminDataGridActionButton action="delete" title="حذف الربط" size="compact" onClick={onDelete} />
          </>
        ) : null}
      </AdminDataGridActionsCell>
    </AdminDataGridRow>
  );
}
