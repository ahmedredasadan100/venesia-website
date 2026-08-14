export const CMS_AUDIT_VERBS = {
  create: "create",
  update: "update",
  delete: "delete",
  permanent_delete: "permanent_delete",
  restore: "restore",
  archive: "archive",
  publish: "publish",
  unpublish: "unpublish",
  reorder: "reorder",
  duplicate: "duplicate",
  restore_default: "restore_default",
} as const;

export type CmsAuditVerb = (typeof CMS_AUDIT_VERBS)[keyof typeof CMS_AUDIT_VERBS];

export type CmsEntityType =
  | "page"
  | "page_block_assignment"
  | "topic"
  | "topic_category"
  | "topic_series"
  | "media_content"
  | "project"
  | "project_location"
  | "project_children"
  | "menu"
  | "menu_item"
  | "footer_settings"
  | "site_settings"
  | "redirect"
  | "content_block_template"
  | "media_asset"
  | "media_folder";

export type CmsAuditAction = `${CmsEntityType}.${CmsAuditVerb}`;

export function buildCmsAuditAction(entityType: CmsEntityType, verb: CmsAuditVerb): CmsAuditAction {
  return `${entityType}.${verb}`;
}

const VERB_LABELS: Record<CmsAuditVerb, string> = {
  create: "إنشاء",
  update: "تعديل",
  delete: "حذف",
  permanent_delete: "حذف نهائي",
  restore: "استعادة",
  archive: "أرشفة",
  publish: "نشر",
  unpublish: "إلغاء النشر",
  reorder: "إعادة ترتيب",
  duplicate: "نسخ",
  restore_default: "استعادة الافتراضي",
};

const ENTITY_LABELS: Record<CmsEntityType, string> = {
  page: "صفحة",
  page_block_assignment: "ربط بلوك صفحة",
  topic: "موضوع",
  topic_category: "تصنيف موضوع",
  topic_series: "سلسلة",
  media_content: "محتوى إعلامي",
  project: "مشروع",
  project_location: "موقع مشروع",
  project_children: "بيانات فرعية للمشروع",
  menu: "قائمة",
  menu_item: "عنصر قائمة",
  footer_settings: "إعدادات الفوتر",
  site_settings: "إعدادات الموقع",
  redirect: "تحويل URL",
  content_block_template: "قالب بلوك محتوى",
  media_asset: "أصل وسائط",
  media_folder: "مجلد وسائط",
};

export function formatCmsAuditActionLabel(action: string): string | null {
  const dot = action.indexOf(".");
  if (dot <= 0) return null;
  const entityType = action.slice(0, dot) as CmsEntityType;
  const verb = action.slice(dot + 1) as CmsAuditVerb;
  if (!(entityType in ENTITY_LABELS) || !(verb in VERB_LABELS)) return null;
  return `${VERB_LABELS[verb]} — ${ENTITY_LABELS[entityType]}`;
}
