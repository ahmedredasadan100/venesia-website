export type AdminTableId = string | number;
export type AdminTableSortDirection = "asc" | "desc";

export type AdminTableSortState<TKey extends string = string> = {
  key: TKey | null;
  direction: AdminTableSortDirection;
};

export type AdminTableActionResult<TRow> = {
  ok: boolean;
  message?: string;
  rows?: TRow[];
};

export type AdminTableFeedback = {
  type: "success" | "error";
  message: string;
} | null;
