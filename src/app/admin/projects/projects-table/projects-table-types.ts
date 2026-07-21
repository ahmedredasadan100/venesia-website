import type { RefObject } from "react";
import type { ProjectColumnKey } from "../../../../lib/admin/projects/projects-list-config";

export type ProjectGridRow = {
  id: number;
  code: string;
  slug?: string | null;
  arabic_name: string;
  location_label: string;
  map_area: string;
  featured: boolean;
  publication_status: string | null;
  status?: string | null;
  updated_at: string;
};

export type ProjectRowActionHandlers = {
  onTogglePublication: (id: number, status: string | null) => void;
  onArchive: (id: number) => void;
  onRestore: (id: number) => void;
  onRequestPermanentDelete: (item: ProjectGridRow) => void;
  onDuplicate?: (id: number) => void;
  isRowPending: (id: number) => boolean;
  rowPendingAction: (id: number) => string | null;
  /** True while any row or bulk mutation owns the single-flight lock. */
  isMutationBusy: boolean;
  isBulkPending: boolean;
};

export type ProjectTableSortState = {
  field: string;
  direction: "asc" | "desc";
};

export type ProjectTableSelection = {
  selectedIds: number[];
  selectedSet: Set<number>;
  allSelected: boolean;
  selectAllRef: RefObject<HTMLInputElement | null>;
  toggleAll: (checked: boolean) => void;
  toggleOne: (id: number, checked: boolean) => void;
  clearSelection: () => void;
};

export type { ProjectColumnKey };
