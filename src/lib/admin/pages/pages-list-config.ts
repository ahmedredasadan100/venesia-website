export const PAGES_LIST_VIEW_KEY = "pages";

export type PageColumnKey =
  | "page"
  | "type"
  | "status"
  | "actions";

export type PageColumnMeta = {
  key: PageColumnKey;
  label: string;
  defaultVisible: boolean;
  hideable: boolean;
};

export const PAGES_LIST_COLUMNS = [
  {
    key: "page",
    label: "الصفحة",
    defaultVisible: true,
    hideable: false,
  },
  {
    key: "status",
    label: "الحالة",
    defaultVisible: true,
    hideable: true,
  },
  {
    key: "type",
    label: "النوع",
    defaultVisible: true,
    hideable: true,
  },
  {
    key: "actions",
    label: "الإجراءات",
    defaultVisible: true,
    hideable: false,
  },
] as const satisfies readonly PageColumnMeta[];

export const PAGES_DEFAULT_COLUMN_KEYS = PAGES_LIST_COLUMNS.filter(
  (column) => column.defaultVisible,
).map((column) => column.key) as PageColumnKey[];

export const PAGES_PREFERENCE_COLUMN_KEYS = PAGES_LIST_COLUMNS.filter(
  (column) => column.hideable,
).map((column) => column.key) as PageColumnKey[];

export function getPagesDefaultColumnKeys(): readonly PageColumnKey[] {
  return PAGES_DEFAULT_COLUMN_KEYS;
}

export function getPagesPreferenceColumnKeys(): readonly PageColumnKey[] {
  return PAGES_PREFERENCE_COLUMN_KEYS;
}
