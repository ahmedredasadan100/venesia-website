/** Series list config — safe for server (no React). */
export const SERIES_LIST_VIEW_KEY = "content-series";

export const SERIES_DEFAULT_COLUMN_KEYS = [
  "name",
  "topics_count",
  "status",
  "actions",
] as const;

export const SERIES_PREFERENCE_COLUMN_KEYS = [
  "topics_count",
  "status",
] as const;

export const SERIES_NOTICE_CODE_MAP = {
  created: { message: "تم إنشاء السلسلة بنجاح." },
  updated: { message: "تم تحديث السلسلة بنجاح." },
  deleted: { message: "تم حذف السلسلة بنجاح." },
  published: { message: "تم إظهار السلسلة بنجاح." },
  unpublished: { message: "تم إخفاء السلسلة بنجاح." },
  duplicated: { message: "تم نسخ السلسلة بنجاح." },
  error: {
    message: "تعذر تنفيذ العملية.",
    variant: "danger" as const,
    title: "تعذر تنفيذ العملية",
  },
} as const;
