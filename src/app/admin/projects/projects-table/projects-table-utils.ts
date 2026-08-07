import { adminDataGridActionsColumn } from "../../../../components/admin/ui";
import {
  getDefaultVisibleColumnKeys,
  sanitizeVisibleColumnKeys,
  type AdminEntityColumnDef,
} from "../../../../lib/admin/entity-list";
import {
  getProjectsColumnMeta,
  type ProjectColumnKey,
} from "../../../../lib/admin/projects/projects-list-config";
import type { ProjectGridRow } from "./projects-table-types";

export function getProjectsColumnDefs(): AdminEntityColumnDef<
  ProjectGridRow,
  ProjectColumnKey
>[] {
  return getProjectsColumnMeta().map((column) => ({
    key: column.key,
    label: column.label,
    defaultVisible: column.defaultVisible,
    hideable: column.hideable,
    minWidth: 44,
    renderCell: () => null,
  }));
}

export function resolveProjectsVisibleColumns(
  initialVisibleColumns?: readonly string[] | null,
): ProjectColumnKey[] {
  const columns = getProjectsColumnDefs();
  return sanitizeVisibleColumnKeys(
    columns,
    initialVisibleColumns == null
      ? getDefaultVisibleColumnKeys(columns)
      : initialVisibleColumns,
  );
}

export function buildColumns(visibleColumns: readonly ProjectColumnKey[]) {
  const visible = new Set(visibleColumns);
  return getProjectsColumnMeta()
    .filter((column) => visible.has(column.key))
    .map((column) =>
      column.gridTrack === "actions"
        ? adminDataGridActionsColumn(2)
        : column.gridTrack,
    )
    .join(" ");
}

export function isProjectColumnVisible(
  visibleColumns: readonly ProjectColumnKey[],
  key: ProjectColumnKey,
) {
  return visibleColumns.includes(key);
}
