import type { ReactNode } from "react";
import type { AdminActionFeedback } from "../admin-action-feedback";
import type { AdminActionResult } from "../admin-action-result";
import type { AdminFeedbackVariant } from "../admin-action-feedback";
import type { AdminActionFeedbackKind } from "../admin-action-feedback";

/** Portable column contract — no entity or project names. */
export type AdminEntityColumnSticky = "start" | "end";
export type AdminEntityColumnAlignment = "start" | "center" | "end";

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
  /** Explicitly absorbs remaining table width. At most one visible column should opt in. */
  flexible?: boolean;
  /** Logical alignment; defaults to start for the primary column and center otherwise. */
  align?: AdminEntityColumnAlignment;
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
  secondaryLabel?: string;
  searchText?: string;
  disabled?: boolean;
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
  /** Visible field/chip label. Falls back to placeholder. */
  label?: string;
  placeholder: string;
  type?:
    | "single_select"
    | "multi_select"
    | "boolean"
    | "status"
    | "date"
    | "date_range"
    | "entity_select"
    | "hierarchical_entity_select";
  selectionMode?: "single" | "multi";
  /** Sentinel value meaning "no filter" (default: "all"). */
  allValue?: string;
  defaultValue?: string;
  options?: AdminEntityFilterOption[];
  groups?: AdminEntityFilterGroup[];
  searchable?: boolean;
  optionSearchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  /** Optional display override for the closed trigger. */
  getDisplayValue?: (value: string) => string | undefined;
  /** Optional active-chip formatter. */
  getAppliedLabel?: (value: string) => string | undefined;
  /** Multi-select values may count as one active filter or per selected value. */
  activeCountBehavior?: "filter" | "value";
};

export type AdminEntitySearchSuggestion = {
  id: string | number;
  primaryText: string;
  secondaryText?: string;
  typeLabel?: string;
  searchValue?: string;
};

export type AdminEntitySearchSuggestionsConfig = {
  enabled: boolean;
  minLength?: number;
  maxResults?: number;
  load: (
    query: string,
    context: { signal: AbortSignal },
  ) => Promise<readonly AdminEntitySearchSuggestion[]>;
  selectionAction?: "set_query" | "navigate_to_entity" | "set_query_and_select";
  onSelect?: (suggestion: AdminEntitySearchSuggestion) => void;
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
  pending?: boolean;
  suggestions?: AdminEntitySearchSuggestionsConfig;
};

export type AdminEntityFilterValues = Record<string, string>;

export type AdminEntityFiltersChangePatch = {
  search?: string;
  filters?: AdminEntityFilterValues;
};
