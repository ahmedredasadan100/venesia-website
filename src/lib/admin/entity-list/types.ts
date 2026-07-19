import type { ReactNode } from "react";
import type { AdminActionFeedback } from "../admin-action-feedback";
import type { AdminActionResult } from "../admin-action-result";
import type { AdminFeedbackVariant } from "../admin-action-feedback";
import type { AdminActionFeedbackKind } from "../admin-action-feedback";

/** Portable column contract — no entity or project names. */
export type AdminEntityColumnSticky = "start" | "end";

export type AdminEntityColumnDef<
  TRow,
  TKey extends string = string,
  TSortKey extends string = string,
> = {
  key: TKey;
  label: string;
  defaultVisible: boolean;
  hideable: boolean;
  sortable?: boolean;
  sortKey?: TSortKey;
  minWidth: number;
  width?: number;
  sticky?: AdminEntityColumnSticky;
  /** When true, cell is treated as the primary identity cell (sticky start after selection). */
  primary?: boolean;
  renderCell: (ctx: AdminEntityCellContext<TRow>) => ReactNode;
};

export type AdminEntityCellContext<TRow> = {
  row: TRow;
  rowId: string | number;
  onMutationResult?: (result: AdminActionResult) => void;
};

export type AdminEntityBulkOption = {
  value: string;
  label: string;
};

export type AdminEntityListEmptyState = {
  mode: "system" | "filtered";
  systemEmpty: ReactNode;
  filteredEmpty: ReactNode;
};

export type AdminEntityNoticeCodeMap = Record<
  string,
  {
    message: string;
    variant?: AdminFeedbackVariant;
    title?: string;
    /** Defaults to transient action feedback. */
    kind?: AdminActionFeedbackKind;
  }
>;

export type AdminEntityFeedbackMapper = (
  result: AdminActionResult,
) => AdminActionFeedback;

export type AdminEntityColumnPreferencePayload = {
  viewKey: string;
  visibleColumns: string[];
  allowedColumns: readonly string[];
};

export type AdminEntityPersistResult = {
  ok: boolean;
  message?: string;
};

/** Portable search/filter contracts — no entity or project names. */
export type AdminEntityFilterOption = {
  value: string;
  label: string;
  /** Generic tree presentation metadata. */
  depth?: number;
  parentValue?: string;
};

export type AdminEntityFilterGroup = {
  label: string;
  options: AdminEntityFilterOption[];
};

export type AdminEntityFilterDef = {
  id: string;
  /** URL query param key for this filter. */
  paramKey: string;
  placeholder: string;
  /** Sentinel value meaning "no filter" (default: "all"). */
  allValue?: string;
  options?: AdminEntityFilterOption[];
  groups?: AdminEntityFilterGroup[];
  className?: string;
  disabled?: boolean;
  /** Optional display override for the closed trigger. */
  getDisplayValue?: (value: string) => string | undefined;
};

export type AdminEntitySearchConfig = {
  /** URL query param key (default: "q"). */
  paramKey?: string;
  placeholder: string;
  value: string;
  /** Minimum trimmed length before committing search to URL (default: 0). */
  minLength?: number;
  debounceMs?: number;
  className?: string;
  disabled?: boolean;
};

export type AdminEntityFilterValues = Record<string, string>;

export type AdminEntityFiltersChangePatch = {
  search?: string;
  filters?: AdminEntityFilterValues;
};
