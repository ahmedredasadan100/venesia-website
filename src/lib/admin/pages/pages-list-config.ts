export const PAGES_LIST_VIEW_KEY = "pages";
export const PAGES_LIST_COLUMN_CONTRACT_VERSION = 3;

export type PageColumnKey =
  | "page"
  | "path"
  | "slug"
  | "moduleCount"
  | "seo"
  | "updatedAt"
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
    key: "path",
    label: "المسار",
    defaultVisible: true,
    hideable: true,
  },
  {
    key: "slug",
    label: "Slug",
    defaultVisible: false,
    hideable: true,
  },
  {
    key: "moduleCount",
    label: "عدد الموديولات",
    defaultVisible: true,
    hideable: true,
  },
  {
    key: "seo",
    label: "SEO",
    defaultVisible: true,
    hideable: true,
  },
  {
    key: "updatedAt",
    label: "آخر تحديث",
    defaultVisible: true,
    hideable: true,
  },
  {
    key: "status",
    label: "الحالة",
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
