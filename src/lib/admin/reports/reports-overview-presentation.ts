import {
  ADMIN_REPORT_DEFINITIONS,
  buildAdminReportHref,
} from "./reports-information-architecture";
import type { AdminReportsModel, ReportsState } from "./reports-contract";

export type ReportsOverviewCard = {
  id: string;
  label: string;
  value: number | string;
  description: string;
  href: string;
  tone: "gold" | "blue" | "green" | "amber" | "violet" | "cyan" | "red";
};

export type ReportsOverviewRecord = {
  id: string;
  title: string;
  meta: string;
  href: string;
};

export type ReportsOverviewHealth = {
  id: string;
  label: string;
  state: ReportsState;
  description: string;
  href: string;
};

export type ReportsOverviewProvider = {
  id: string;
  label: string;
  status: string;
  description: string;
  href: string;
};

export type AdminReportsOverviewPresentation = {
  kpis: ReportsOverviewCard[];
  alerts: ReportsOverviewCard[];
  health: ReportsOverviewHealth[];
  providers: ReportsOverviewProvider[];
  projects: ReportsOverviewRecord[];
  content: ReportsOverviewRecord[];
  activity: ReportsOverviewRecord[];
  seoIssues: ReportsOverviewCard[];
  mediaIssues: ReportsOverviewCard[];
  quickAccess: typeof ADMIN_REPORT_DEFINITIONS;
};

function sourceState(statuses: readonly string[]): ReportsState {
  if (statuses.every((status) => status === "unavailable")) return "unavailable";
  return statuses.every((status) => status === "ready") ? "ready" : "partial";
}

function unavailableCard(id: string, label: string, href: string): ReportsOverviewCard {
  return {
    id,
    label,
    value: "غير متاح",
    description: "تعذر تحميل المصدر الحقيقي؛ لم تُعرض قيمة بديلة.",
    href,
    tone: "red",
  };
}

export function buildAdminReportsOverview(
  model: AdminReportsModel,
): AdminReportsOverviewPresentation {
  const dashboard = model.dashboard.data;
  const reports = model.reports.data;
  const seo = model.seo.data;
  const audit = model.audit.data;

  const kpis: ReportsOverviewCard[] = dashboard
    ? [
        { id: "overview-content", label: "إجمالي المحتوى", value: dashboard.kpis.topics.total, description: `${dashboard.kpis.topics.published} منشور`, href: buildAdminReportHref("content"), tone: "gold" },
        { id: "overview-published", label: "المحتوى المنشور", value: dashboard.kpis.topics.published, description: `${dashboard.kpis.topics.unpublished} غير منشور`, href: buildAdminReportHref("publishing", { filter: "recent" }), tone: "green" },
        { id: "overview-projects", label: "المشاريع", value: dashboard.kpis.projects.total, description: `${dashboard.kpis.projects.published} منشور`, href: buildAdminReportHref("projects", { filter: "health" }), tone: "blue" },
        { id: "overview-media", label: "الميديا المُدارة", value: dashboard.kpis.media.total, description: `${dashboard.kpis.media.issues} مشكلة`, href: buildAdminReportHref("media"), tone: "cyan" },
      ]
    : [unavailableCard("overview-dashboard", "Dashboard KPIs", buildAdminReportHref("system", { filter: "read_models" }))];
  kpis.push(
    seo
      ? { id: "overview-seo", label: "SEO Health", value: `${seo.score}%`, description: seo.status, href: buildAdminReportHref("seo"), tone: seo.status === "healthy" ? "green" : "amber" }
      : unavailableCard("overview-seo", "SEO Health", buildAdminReportHref("seo")),
    audit
      ? { id: "overview-audit", label: "إجمالي النشاط", value: audit.total, description: `أحدث ${audit.sampled} حدث في التجميع`, href: buildAdminReportHref("audit", { filter: "recent" }), tone: "violet" }
      : unavailableCard("overview-audit", "Audit Activity", buildAdminReportHref("audit")),
  );

  const alerts: ReportsOverviewCard[] = [];
  if (reports) {
    const candidates: ReportsOverviewCard[] = [
      { id: "alert-content-image", label: "محتوى بلا صورة", value: reports.content.missingImages, description: "يحتاج معالجة داخل Content owner.", href: buildAdminReportHref("content", { filter: "missing_images" }), tone: "red" },
      { id: "alert-content-seo", label: "محتوى ناقص SEO", value: reports.content.missingSeo, description: "Metadata غير مكتملة.", href: buildAdminReportHref("content", { filter: "missing_seo" }), tone: "amber" },
      { id: "alert-project-incomplete", label: "مشاريع ناقصة البيانات", value: reports.projects.incomplete, description: "لم تستوفِ عقد اكتمال المشروع.", href: buildAdminReportHref("projects", { filter: "incomplete" }), tone: "amber" },
      { id: "alert-media-broken", label: "مراجع ميديا مكسورة", value: reports.media.brokenReferences, description: "Reference Sync يحتاج مراجعة.", href: buildAdminReportHref("media", { filter: "broken_references" }), tone: "red" },
      { id: "alert-seo-noindex", label: "منشور Noindex", value: reports.seo.indexability.noindexPublished, description: "محتوى منشور مستبعد من الفهرسة.", href: buildAdminReportHref("seo", { filter: "indexability" }), tone: "amber" },
    ];
    alerts.push(...candidates.filter((item) => typeof item.value === "number" && item.value > 0));
  } else {
    alerts.push(unavailableCard("alert-reports-source", "Reports Read Model", buildAdminReportHref("system", { filter: "diagnostics" })));
  }
  if (model.contentReview.data?.blocked) {
    alerts.push({
      id: "alert-review-blocked",
      label: "محتوى محجوب بالمراجعة",
      value: model.contentReview.data.blocked,
      description: "قواعد النشر الحالية تمنع الإغلاق.",
      href: buildAdminReportHref("publishing", { filter: "validation_blocks" }),
      tone: "red",
    });
  }
  if (model.analytics.state !== "ready") {
    alerts.push({
      id: "alert-analytics",
      label: "Analytics غير مفعّلة بالكامل",
      value: model.analytics.providers.filter((provider) => provider.status === "ready").length,
      description: `مزودون جاهزون من إجمالي ${model.analytics.providers.length}؛ لا توجد بيانات وهمية.`,
      href: buildAdminReportHref("analytics", { filter: "providers" }),
      tone: "amber",
    });
  }

  const health: ReportsOverviewHealth[] = [
    {
      id: "health-content",
      label: "صحة المحتوى",
      state: sourceState([model.dashboard.status, model.reports.status, model.contentReview.status]),
      description: reports ? `${reports.content.missingImages + reports.content.missingSeo + reports.content.missingImageAlt} إشارة جودة` : model.reports.message,
      href: buildAdminReportHref("content"),
    },
    {
      id: "health-projects",
      label: "صحة المشاريع",
      state: sourceState([model.dashboard.status, model.reports.status]),
      description: reports ? `${reports.projects.complete} مكتمل · ${reports.projects.incomplete} ناقص` : model.reports.message,
      href: buildAdminReportHref("projects", { filter: "health" }),
    },
    {
      id: "health-system",
      label: "صحة النظام",
      state: model.state,
      description: `${[model.dashboard, model.reports, model.contentReview, model.audit, model.seo, model.media].filter((source) => source.status === "ready").length} مصادر جاهزة من 6`,
      href: buildAdminReportHref("system", { filter: "diagnostics" }),
    },
  ];

  const providers = model.analytics.providers.map((provider) => ({
    id: provider.provider,
    label: provider.label,
    status: provider.status,
    description: provider.message,
    href: buildAdminReportHref("analytics", { filter: "providers" }),
  }));

  const projects = (dashboard?.recentProjects ?? []).slice(0, 5).map((project) => ({
    id: `overview-project-${project.id}`,
    title: project.arabicName,
    meta: `${project.code} · ${project.publicationStatus}`,
    href: `${buildAdminReportHref("projects")}#recent-projects`,
  }));
  const content = (dashboard?.recentTopics ?? []).slice(0, 5).map((topic) => ({
    id: `overview-topic-${topic.id}`,
    title: topic.title,
    meta: `${topic.category} · ${topic.status ?? "unpublished"}`,
    href: `${buildAdminReportHref("content")}#recent-content`,
  }));
  const activity = (audit?.recentActivity ?? []).slice(0, 5).map((event) => ({
    id: `overview-audit-${event.id}`,
    title: event.action,
    meta: `${event.actor} · ${event.entityLabel ?? event.entityType ?? "system"}`,
    href: buildAdminReportHref("audit", { filter: "recent" }),
  }));

  const seoIssues = reports ? [
    { id: "seo-issues-metadata", label: "Metadata ناقصة", value: reports.seo.missingMetadata.topics + reports.seo.missingMetadata.projects + reports.seo.missingMetadata.pages, description: "محتوى ومشاريع وصفحات.", href: buildAdminReportHref("seo", { filter: "missing_metadata" }), tone: "amber" as const },
    { id: "seo-issues-noindex", label: "منشور Noindex", value: reports.seo.indexability.noindexPublished, description: "يتطلب قرار فهرسة واعٍ.", href: buildAdminReportHref("seo", { filter: "indexability" }), tone: "red" as const },
  ] : [unavailableCard("seo-issues-unavailable", "مشاكل SEO", buildAdminReportHref("seo"))];
  const mediaIssues = reports ? [
    { id: "media-issues-broken", label: "مراجع مكسورة", value: reports.media.brokenReferences, description: "Reference Sync.", href: buildAdminReportHref("media", { filter: "broken_references" }), tone: "red" as const },
    { id: "media-issues-alt", label: "Alt مفقود", value: reports.media.missingAlt, description: "وصول وجودة Metadata.", href: buildAdminReportHref("media", { filter: "missing_alt" }), tone: "amber" as const },
  ] : [unavailableCard("media-issues-unavailable", "مشاكل الميديا", buildAdminReportHref("media"))];

  return {
    kpis,
    alerts,
    health,
    providers,
    projects,
    content,
    activity,
    seoIssues,
    mediaIssues,
    quickAccess: ADMIN_REPORT_DEFINITIONS,
  };
}
