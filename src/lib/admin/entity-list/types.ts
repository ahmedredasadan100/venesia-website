import type { ReactNode } from "react";
import type { AdminActionFeedback } from "../admin-action-feedback";
import type { AdminActionResult } from "../admin-action-result";
import type { AdminFeedbackVariant } from "../admin-action-feedback";

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
  title?: string;
  message: string;
};

export type AdminEntityNoticeCodeMap = Record<
  string,
  {
    message: string;
    variant?: AdminFeedbackVariant;
    title?: string;
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
