export const REDIRECTS_LIST_VIEW_KEY = "seo-redirects";

export type RedirectColumnKey =
  | "source"
  | "destination"
  | "type"
  | "status"
  | "note"
  | "created"
  | "updated"
  | "actions";

type RedirectColumnMeta = {
  key: RedirectColumnKey;
  label: string;
  defaultVisible: boolean;
  hideable: boolean;
};

export const REDIRECTS_LIST_COLUMN_META = {
  source: {
    key: "source",
    label: "المصدر",
    defaultVisible: true,
    hideable: false,
  },
  destination: {
    key: "destination",
    label: "الوجهة",
    defaultVisible: true,
    hideable: true,
  },
  type: {
    key: "type",
    label: "النوع",
    defaultVisible: true,
    hideable: true,
  },
  status: {
    key: "status",
    label: "الحالة",
    defaultVisible: true,
    hideable: true,
  },
  note: {
    key: "note",
    label: "ملاحظة",
    defaultVisible: true,
    hideable: true,
  },
  created: {
    key: "created",
    label: "أُنشئ",
    defaultVisible: true,
    hideable: true,
  },
  updated: {
    key: "updated",
    label: "آخر تحديث",
    defaultVisible: true,
    hideable: true,
  },
  actions: {
    key: "actions",
    label: "الإجراءات",
    defaultVisible: true,
    hideable: false,
  },
} as const satisfies Record<RedirectColumnKey, RedirectColumnMeta>;

const REDIRECTS_LIST_COLUMNS = Object.values(REDIRECTS_LIST_COLUMN_META);

export const REDIRECTS_DEFAULT_COLUMN_KEYS = REDIRECTS_LIST_COLUMNS.filter(
  (column) => column.defaultVisible,
).map((column) => column.key) as RedirectColumnKey[];

export const REDIRECTS_PREFERENCE_COLUMN_KEYS = REDIRECTS_LIST_COLUMNS.filter(
  (column) => column.hideable,
).map((column) => column.key) as RedirectColumnKey[];

export function getRedirectsDefaultColumnKeys() {
  return REDIRECTS_DEFAULT_COLUMN_KEYS as readonly RedirectColumnKey[];
}

export function getRedirectsPreferenceColumnKeys() {
  return REDIRECTS_PREFERENCE_COLUMN_KEYS as readonly RedirectColumnKey[];
}
