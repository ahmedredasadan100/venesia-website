/** Topics list config — safe for server actions (no React). */
export const TOPICS_LIST_VIEW_KEY = "content-topics";
export const TOPICS_LIST_PAGE_SIZES = [10, 20, 30, 50] as const;
export const TOPICS_LIST_DEFAULT_PAGE_SIZE = 10;

export const TOPICS_PREFERENCE_COLUMN_KEYS = [
  "category",
  "id",
  "views",
  "created_at",
  "updated_at",
  "created_by",
  "content_type",
  "series",
  "status",
  "featured",
  "seo",
  "published_at",
] as const;

export const TOPICS_NOTICE_CODE_MAP = {
  published: { message: "تم نشر المحتوى بنجاح." },
  unpublished: {
    message: "تم إخفاء المحتوى مع الحفاظ على بيانات النشر.",
  },
  saved: { message: "تم حفظ التغيير بنجاح." },
  created: { message: "تم إنشاء نسخة غير منشورة بنجاح." },
  deleted: { message: "تم حذف المحتوى حذفًا آمنًا." },
  error: {
    message: "تعذر تنفيذ العملية.",
    variant: "danger" as const,
    title: "تعذر تنفيذ العملية",
  },
} as const;
