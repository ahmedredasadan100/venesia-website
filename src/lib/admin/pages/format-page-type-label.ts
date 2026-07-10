const PAGE_TYPE_LABELS: Record<string, string> = {
  static: "مسار ثابت — محتوى CMS",
  hub: "صفحة محورية",
  home: "الصفحة الرئيسية",
  contact: "صفحة التواصل",
  system: "صفحة نظام",
};

export function formatPageTypeLabel(pageType: string): string {
  const normalized = pageType.trim().toLowerCase();
  return PAGE_TYPE_LABELS[normalized] ?? pageType.trim();
}
