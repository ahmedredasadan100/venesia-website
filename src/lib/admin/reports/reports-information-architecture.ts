import type { AnalyticsQueryContext } from "./analytics-contract";

export const ADMIN_REPORT_IDS = [
  "content",
  "projects",
  "analytics",
  "seo",
  "media",
  "publishing",
  "audit",
  "system",
  "business",
] as const;

export type AdminReportId = (typeof ADMIN_REPORT_IDS)[number];

export type AdminReportFilterDefinition = {
  id: string;
  label: string;
  description: string;
};

export type AdminReportDefinition = {
  id: AdminReportId;
  label: string;
  shortLabel: string;
  eyebrow: string;
  description: string;
  href: `/admin/reports/${AdminReportId}`;
  icon: string;
  filters: readonly AdminReportFilterDefinition[];
};

export const ADMIN_REPORT_DEFINITIONS = [
  {
    id: "content",
    label: "تقارير المحتوى",
    shortLabel: "المحتوى",
    eyebrow: "CONTENT REPORTS",
    description: "الصحة، الجاهزية، الصور، SEO وحالة المراجعة من ملاك المحتوى الحالية.",
    href: "/admin/reports/content",
    icon: "✦",
    filters: [
      { id: "all", label: "الكل", description: "كل مؤشرات المحتوى المتاحة." },
      { id: "missing_images", label: "صور ناقصة", description: "المحتوى الذي يحتاج صورة أساسية." },
      { id: "missing_seo", label: "SEO ناقص", description: "المحتوى الذي يحتاج بيانات SEO." },
      { id: "missing_alt", label: "Alt ناقص", description: "الصور التي تحتاج نصًا بديلًا." },
      { id: "review_blocked", label: "محجوب بالمراجعة", description: "السجلات التي تمنعها قواعد النشر الحالية." },
      { id: "unpublished", label: "غير المنشور", description: "المحتوى غير المنشور للعامة." },
    ],
  },
  {
    id: "projects",
    label: "تقارير المشاريع",
    shortLabel: "المشاريع",
    eyebrow: "PROJECTS REPORTS",
    description: "حالة النشر، الاكتمال، التمييز وتحديثات التنفيذ من حقيقة المشاريع الحالية.",
    href: "/admin/reports/projects",
    icon: "▣",
    filters: [
      { id: "all", label: "الكل", description: "كل مؤشرات المشاريع المتاحة." },
      { id: "health", label: "الصحة", description: "ملخص اكتمال وجودة بيانات المشاريع." },
      { id: "published", label: "منشورة", description: "المشاريع المنشورة حاليًا." },
      { id: "featured", label: "مميزة", description: "المشاريع المعلمة كمميزة." },
      { id: "incomplete", label: "ناقصة البيانات", description: "المشاريع التي لم تستوفِ عقد الاكتمال." },
      { id: "missing_seo", label: "SEO ناقص", description: "المشاريع التي تحتاج Metadata." },
      { id: "missing_images", label: "صور ناقصة", description: "المشاريع التي تحتاج صورًا أساسية." },
    ],
  },
  {
    id: "analytics",
    label: "تقارير التحليلات",
    shortLabel: "التحليلات",
    eyebrow: "ANALYTICS REPORTS",
    description: "بيانات المحتوى والمشاريع والبحث عبر Analytics Adapter Registry الواحد فقط.",
    href: "/admin/reports/analytics",
    icon: "⌁",
    filters: [
      { id: "all", label: "الكل", description: "كل مجالات Analytics المتاحة." },
      { id: "providers", label: "المزودون", description: "حالة اتصالات Analytics المعتمدة." },
      { id: "content", label: "المحتوى", description: "قراءة وتفاعل المحتوى عند توفر المزود." },
      { id: "projects", label: "المشاريع", description: "الزيارات والاهتمام بالمشاريع عند توفر المزود." },
      { id: "seo", label: "البحث", description: "Organic وCTR والصفحات الهابطة عند توفر المزود." },
    ],
  },
  {
    id: "seo",
    label: "تقارير SEO",
    shortLabel: "SEO",
    eyebrow: "SEO REPORTS",
    description: "Metadata وCanonical وIndexability وSitemap من Global SEO owner.",
    href: "/admin/reports/seo",
    icon: "◎",
    filters: [
      { id: "all", label: "الكل", description: "كل مؤشرات SEO المتاحة." },
      { id: "missing_metadata", label: "Metadata ناقصة", description: "الكيانات التي تحتاج Metadata." },
      { id: "canonical", label: "Canonical", description: "حالة Canonical overrides." },
      { id: "indexability", label: "Indexability", description: "حالة الفهرسة للمحتوى المنشور." },
      { id: "sitemap", label: "Sitemap", description: "صحة وتغطية Sitemap." },
    ],
  },
  {
    id: "media",
    label: "تقارير الميديا",
    shortLabel: "الميديا",
    eyebrow: "MEDIA REPORTS",
    description: "التخزين والمراجع وAlt وVideo URLs من Media owners الحالية.",
    href: "/admin/reports/media",
    icon: "▧",
    filters: [
      { id: "all", label: "الكل", description: "كل مؤشرات صحة الميديا." },
      { id: "broken_references", label: "مراجع مكسورة", description: "المراجع التي لا تحل إلى أصل صالح." },
      { id: "missing_objects", label: "Objects مفقودة", description: "أصول الكتالوج التي لا يقابلها Storage object." },
      { id: "missing_alt", label: "Alt مفقود", description: "الأصول التي تحتاج نصًا بديلًا." },
      { id: "missing_video_urls", label: "Video URL مفقود", description: "محتوى الفيديو دون رابط صالح." },
      { id: "storage", label: "التخزين", description: "حجم التخزين وجودة قياسه." },
    ],
  },
  {
    id: "publishing",
    label: "تقارير النشر",
    shortLabel: "النشر",
    eyebrow: "PUBLISHING REPORTS",
    description: "النشر الحديث والمعلّق والمسودات وموانع التحقق من ملاك النشر والمراجعة.",
    href: "/admin/reports/publishing",
    icon: "◇",
    filters: [
      { id: "all", label: "الكل", description: "كل مؤشرات النشر المتاحة." },
      { id: "recent", label: "النشر الحديث", description: "ما نُشر خلال نافذة الثلاثين يومًا." },
      { id: "unpublished", label: "غير المنشور", description: "الكيانات غير المنشورة عبر أنواع المحتوى الحالية." },
      { id: "validation_blocks", label: "موانع التحقق", description: "قواعد المراجعة التي تمنع النشر." },
    ],
  },
  {
    id: "audit",
    label: "تقارير النشاط",
    shortLabel: "النشاط",
    eyebrow: "AUDIT REPORTS",
    description: "النشاط الحديث وحركة الكيانات والمستخدمين وتاريخ النشر من Audit owner.",
    href: "/admin/reports/audit",
    icon: "☷",
    filters: [
      { id: "all", label: "الكل", description: "كل ملخصات Audit المتاحة." },
      { id: "recent", label: "حديث", description: "أحدث أحداث Audit." },
      { id: "entity", label: "حسب الكيان", description: "توزيع النشاط حسب نوع الكيان." },
      { id: "user", label: "حسب المستخدم", description: "توزيع النشاط حسب المنفّذ." },
      { id: "publishing", label: "تاريخ النشر", description: "أحداث النشر وإلغاء النشر." },
    ],
  },
  {
    id: "system",
    label: "تقارير النظام",
    shortLabel: "النظام",
    eyebrow: "SYSTEM REPORTS",
    description: "Diagnostics وصحة Read Models وCache وMigrations ومصادر الحقيقة.",
    href: "/admin/reports/system",
    icon: "⚙",
    filters: [
      { id: "all", label: "الكل", description: "كل تشخيصات النظام المتاحة." },
      { id: "diagnostics", label: "Diagnostics", description: "حالة مصادر التقارير في الطلب الحالي." },
      { id: "read_models", label: "Read Models", description: "صحة عقود القراءة المشتركة." },
      { id: "cache", label: "Cache", description: "سياسة Cache وRevalidation الحالية." },
      { id: "migrations", label: "Migrations", description: "Registry وACL وRLS والفهارس." },
      { id: "sources", label: "Sources of Truth", description: "الملاك الموثوقة التي تكوّن التقارير." },
    ],
  },
  {
    id: "business",
    label: "تقارير الأعمال",
    shortLabel: "الأعمال",
    eyebrow: "BUSINESS REPORTS",
    description: "Leads وConversion وCampaigns وROI عبر Analytics Contract عند توفر مصادر حقيقية.",
    href: "/admin/reports/business",
    icon: "◈",
    filters: [
      { id: "all", label: "الكل", description: "كل مؤشرات الأعمال المتاحة." },
      { id: "leads", label: "Leads", description: "العملاء المحتملون عند توفر CRM أوAdapter صالح." },
      { id: "conversion", label: "Conversion", description: "معدل ومسار التحويل عند توفر المصدر." },
      { id: "campaigns", label: "Campaigns", description: "أداء الحملات عند توفر المزود." },
      { id: "roi", label: "ROI", description: "العائد عند توفر تكاليف وإيرادات موثوقة." },
      { id: "sources", label: "Sources", description: "مصادر الأعمال والزيارات عند توفرها." },
    ],
  },
] as const satisfies readonly AdminReportDefinition[];

export type AdminReportPeriod = "current" | "last_30_days" | "last_90_days";
export type AdminReportCompare = "none" | "previous_period" | "previous_year";

export type AdminReportQueryContext = {
  filter: string;
  period: AdminReportPeriod;
  compare: AdminReportCompare;
};

export type AdminReportQueryResolution =
  | { state: "valid"; context: AdminReportQueryContext }
  | { state: "invalid"; message: string };

export type AdminReportQueryInput = Record<string, string | string[] | undefined>;

const QUERY_KEYS = new Set(["filter", "period", "compare"]);

export function isAdminReportId(value: string): value is AdminReportId {
  return (ADMIN_REPORT_IDS as readonly string[]).includes(value);
}

export function getAdminReportDefinition(reportId: AdminReportId) {
  return ADMIN_REPORT_DEFINITIONS.find((definition) => definition.id === reportId)!;
}

function scalar(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function defaultPeriod(reportId: AdminReportId): AdminReportPeriod {
  return reportId === "analytics" || reportId === "business" ? "last_30_days" : "current";
}

function allowedPeriods(reportId: AdminReportId): readonly AdminReportPeriod[] {
  if (reportId === "analytics" || reportId === "business") {
    return ["last_30_days", "last_90_days"];
  }
  if (reportId === "publishing") return ["current", "last_30_days"];
  return ["current"];
}

export function resolveAdminReportQuery(
  reportId: AdminReportId,
  input: AdminReportQueryInput,
): AdminReportQueryResolution {
  const unknownKeys = Object.keys(input).filter((key) => !QUERY_KEYS.has(key));
  if (unknownKeys.length) {
    return { state: "invalid", message: `معاملات تقرير غير مدعومة: ${unknownKeys.join(", ")}.` };
  }
  if (Object.values(input).some(Array.isArray)) {
    return { state: "invalid", message: "لا تقبل معاملات التقرير قيمًا مكررة." };
  }

  const definition = getAdminReportDefinition(reportId);
  const filter = scalar(input.filter) ?? "all";
  const period = (scalar(input.period) ?? defaultPeriod(reportId)) as AdminReportPeriod;
  const compare = (scalar(input.compare) ?? "none") as AdminReportCompare;

  if (!definition.filters.some((item) => item.id === filter)) {
    return { state: "invalid", message: `الفلتر «${filter}» لا ينتمي إلى تقرير ${definition.label}.` };
  }
  if (!allowedPeriods(reportId).includes(period)) {
    return { state: "invalid", message: `الفترة «${period}» غير مدعومة لهذا التقرير.` };
  }
  if (!["none", "previous_period", "previous_year"].includes(compare)) {
    return { state: "invalid", message: `المقارنة «${compare}» غير مدعومة.` };
  }
  if (compare !== "none" && reportId !== "analytics" && reportId !== "business") {
    return { state: "invalid", message: "مقارنة الفترات متاحة فقط للتقارير التي تعيد Metrics مؤرخة عبر Analytics Contract." };
  }

  return { state: "valid", context: { filter, period, compare } };
}

export function buildAdminReportHref(
  reportId: AdminReportId,
  input: Partial<AdminReportQueryContext> = {},
) {
  const definition = getAdminReportDefinition(reportId);
  const params = new URLSearchParams();
  if (input.filter && input.filter !== "all") params.set("filter", input.filter);
  if (input.period && input.period !== defaultPeriod(reportId)) params.set("period", input.period);
  if (input.compare && input.compare !== "none") params.set("compare", input.compare);
  const query = params.toString();
  return query ? `${definition.href}?${query}` : definition.href;
}

export function getAdminReportAnalyticsQuery(
  reportId: AdminReportId,
  context: AdminReportQueryContext,
): AnalyticsQueryContext | undefined {
  if (reportId !== "analytics" && reportId !== "business") return undefined;
  return {
    period: context.period === "last_90_days" ? "last_90_days" : "last_30_days",
    compare: context.compare,
  };
}

export type ReportExperienceCapabilityKey =
  | "global_filters"
  | "drill_down"
  | "export"
  | "print"
  | "saved_reports"
  | "favorites"
  | "compare_periods"
  | "schedule_reports"
  | "executive_pdf"
  | "action_center"
  | "ai_insights";

export type ReportExperienceCapability = {
  key: ReportExperienceCapabilityKey;
  label: string;
  state: "ready" | "contextual" | "unavailable";
  owner: string;
  message: string;
};

export const REPORT_EXPERIENCE_CAPABILITIES = [
  { key: "global_filters", label: "Global Filters", state: "ready", owner: "Reports URL Query Contract", message: "الفلاتر جزء من URL وتُرفض القيم غير المعروفة صراحةً." },
  { key: "drill_down", label: "Drill Down", state: "ready", owner: "Reports Information Architecture", message: "بطاقات النظرة العامة تنقل إلى التقرير والفلتر المقصودين." },
  { key: "export", label: "Export", state: "ready", owner: "Reports Export Adapter", message: "CSV يُبنى وقت الطلب من نفس النموذج المحمّل ويُرفض عند غياب الحقيقة." },
  { key: "print", label: "Print", state: "ready", owner: "Reports Presentation", message: "نسخة الطباعة تستخدم نفس محتوى التقرير الحالي دون نسخة بيانات موازية." },
  { key: "saved_reports", label: "Saved Reports", state: "unavailable", owner: "Unassigned persistence dependency", message: "لا يوجد مالك persistence معتمد لحفظ تعريفات التقارير؛ لم يُنشأ جدول محلي بديل." },
  { key: "favorites", label: "Favorites", state: "unavailable", owner: "Unassigned preference dependency", message: "يتطلب توسيع مالك تفضيلات المستخدم بقرار نطاق مستقل؛ لا توجد حالة Client وهمية." },
  { key: "compare_periods", label: "Compare Periods", state: "contextual", owner: "Analytics Contract", message: "العقد يقبل سياق المقارنة، والنتيجة تبقى غير متاحة حتى يعيد Adapter فترات قابلة للمقارنة." },
  { key: "schedule_reports", label: "Schedule Reports", state: "unavailable", owner: "Unassigned scheduling dependency", message: "يتطلب Job/Scheduling owner معتمدًا؛ لم يُنشأ مؤقت أوCron موازٍ." },
  { key: "executive_pdf", label: "Executive PDF", state: "unavailable", owner: "Unassigned document-generation dependency", message: "يتطلب عقد توليد وتسليم ملفات معتمدًا؛ Print متاح ولا يُسمى PDF تنفيذيًا." },
  { key: "action_center", label: "Action Center", state: "ready", owner: "Reports Drill-down Contract", message: "المشكلات الحقيقية ترتبط بالتقرير أوشاشة المالك المناسبة دون mutation موازية." },
  { key: "ai_insights", label: "AI Insights", state: "unavailable", owner: "Unassigned AI provider dependency", message: "لا يوجد AI provider أوInsight contract معتمد؛ لا تُنتج توصيات مولدة أوثابتة." },
] as const satisfies readonly ReportExperienceCapability[];
