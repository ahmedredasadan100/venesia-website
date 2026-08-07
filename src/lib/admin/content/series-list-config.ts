/** Series list config — safe for server (no React). */
export const SERIES_LIST_VIEW_KEY = "content-series";

export const SERIES_DEFAULT_COLUMN_KEYS = [
  "name",
  "status",
  "category",
  "topics_count",
  "created_at",
  "actions",
] as const;

export const SERIES_PREFERENCE_COLUMN_KEYS = [
  "topics_count",
  "status",
  "id",
  "slug",
  "category",
  "sort_order",
  "created_at",
  "updated_at",
] as const;

export const SERIES_NOTICE_CODE_MAP = {
  created: { message: "تم إنشاء السلسلة بنجاح." },
  updated: { message: "تم تحديث السلسلة بنجاح." },
  deleted: { message: "تم حذف السلسلة بنجاح." },
  published: { message: "تم نشر السلسلة بنجاح." },
  unpublished: { message: "تم إخفاء السلسلة بنجاح." },
  duplicated: { message: "تم نسخ السلسلة بنجاح." },
  error: {
    message: "تعذر تنفيذ العملية.",
    variant: "danger" as const,
    title: "تعذر تنفيذ العملية",
  },
} as const;
