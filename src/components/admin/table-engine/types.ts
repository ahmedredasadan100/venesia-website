export type AdminTableId = string | number;
export type AdminTableSortDirection = "asc" | "desc";

export type AdminTableSortState<TKey extends string = string> = {
  key: TKey | null;
  direction: AdminTableSortDirection;
};
