import {
  adminDataGridActionsColumn,
  ADMIN_DATA_GRID_ACTION_COLUMNS,
} from "../../../../components/admin/ui";
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

function resolveActionsTrack(
  withDuplicateAction: boolean,
  referenceLayout: boolean,
) {
  if (referenceLayout) {
    // Reference rows expose 6 compact actions (edit, preview, publish, duplicate, archive, delete).
    return adminDataGridActionsColumn(6, "compact");
  }
  return withDuplicateAction
    ? ADMIN_DATA_GRID_ACTION_COLUMNS.four
    : ADMIN_DATA_GRID_ACTION_COLUMNS.three;
}

/**
 * Shared-core compatible column defs for sanitize/default helpers.
 * Projects keep custom DataGrid rendering; renderCell is intentionally unused.
 */
export function getProjectsColumnDefs(
  type: "residential" | "commercial",
): AdminEntityColumnDef<ProjectGridRow, ProjectColumnKey>[] {
  return getProjectsColumnMeta(type).map((column) => ({
    key: column.key,
    label: column.label,
    defaultVisible: column.defaultVisible,
    hideable: column.hideable,
    minWidth: 44,
    renderCell: () => null,
  }));
}

export function resolveProjectsVisibleColumns(
  type: "residential" | "commercial",
  initialVisibleColumns?: readonly string[] | null,
): ProjectColumnKey[] {
  const columns = getProjectsColumnDefs(type);
  return sanitizeVisibleColumnKeys(
    columns,
    initialVisibleColumns?.length
      ? initialVisibleColumns
      : getDefaultVisibleColumnKeys(columns),
  );
}

export function buildColumns(
  type: "residential" | "commercial",
  visibleColumns: readonly ProjectColumnKey[],
  withDuplicateAction: boolean,
  referenceLayout: boolean,
) {
  const actionsTrack = resolveActionsTrack(withDuplicateAction, referenceLayout);
  const visible = new Set(visibleColumns);
  return getProjectsColumnMeta(type)
    .filter((column) => visible.has(column.key))
    .map((column) =>
      column.gridTrack === "actions" ? actionsTrack : column.gridTrack,
    )
    .join(" ");
}

export function isProjectColumnVisible(
  visibleColumns: readonly ProjectColumnKey[],
  key: ProjectColumnKey,
) {
  return visibleColumns.includes(key);
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

export function publicationMeta(status?: string | null) {
  if (status === "published") return { label: "منشور", tone: "green" as const };
  if (status === "unpublished") return { label: "مخفي", tone: "gold" as const };
  if (status === "archived") return { label: "أرشيف", tone: "muted" as const };
  return { label: "مسودة", tone: "muted" as const };
}

export function locationLabel(item: ProjectGridRow) {
  return item.location_label || item.map_area || "—";
}

export function featuredLabel(item: ProjectGridRow) {
  return item.featured ? "نعم" : "لا";
}
