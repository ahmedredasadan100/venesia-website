import { ADMIN_DATA_GRID_ACTION_COLUMNS } from "../../../../components/admin/ui";
import type { ProjectGridRow } from "./projects-table-types";

export function buildColumns(withDuplicateAction: boolean, referenceLayout: boolean) {
  if (referenceLayout) {
    return `44px minmax(260px, 1fr) 96px 72px 96px 120px ${ADMIN_DATA_GRID_ACTION_COLUMNS.fiveCompact}`;
  }

  const actionsColumn = withDuplicateAction
    ? ADMIN_DATA_GRID_ACTION_COLUMNS.four
    : ADMIN_DATA_GRID_ACTION_COLUMNS.three;

  return `44px minmax(96px,110px) minmax(200px,1.2fr) 90px 110px 150px ${actionsColumn}`;
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
