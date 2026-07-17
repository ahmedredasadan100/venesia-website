/** Categories list config — safe for server (no React). */
export const CATEGORIES_LIST_VIEW_KEY = "content-categories";

export const CATEGORIES_DEFAULT_COLUMN_KEYS = [
  "name",
  "count",
  "status",
  "actions",
] as const;

export const CATEGORIES_PREFERENCE_COLUMN_KEYS = [
  "count",
  "status",
  "id",
  "parent",
  "sort_order",
  "created_at",
  "updated_at",
] as const;

export const CATEGORIES_NOTICE_CODE_MAP = {
  created: { message: "تم إنشاء التصنيف بنجاح." },
  updated: { message: "تم تحديث التصنيف بنجاح." },
  deleted: { message: "تم حذف التصنيف بنجاح." },
  shown: { message: "تم إظهار التصنيف بنجاح." },
  hidden: { message: "تم إخفاء التصنيف بنجاح." },
  error: {
    message: "تعذر تنفيذ العملية.",
    variant: "danger" as const,
    title: "تعذر تنفيذ العملية",
  },
} as const;
