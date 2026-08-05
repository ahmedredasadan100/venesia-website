import type { AnalyticsMetric } from "./analytics-contract";
import {
  getAdminReportDefinition,
  type AdminReportId,
  type AdminReportQueryContext,
} from "./reports-information-architecture";
import type {
  AdminReportsModel,
  ReportsSourceStatus,
  ReportsState,
} from "./reports-contract";

export type ReportPresentationMetric = {
  id: string;
  label: string;
  value: number | string;
  filter: string;
  description?: string;
  href?: string;
};

export type ReportPresentationGroup = {
  id: string;
  title: string;
  description: string;
  metrics: ReportPresentationMetric[];
};

export type ReportPresentationRecord = {
  id: string;
  title: string;
  meta: string;
  href?: string;
  status?: string;
};

export type ReportPresentationRecordGroup = {
  id: string;
  title: string;
  description: string;
  filter: string;
  items: ReportPresentationRecord[];
};

export type ReportPresentationAction = {
  id: string;
  label: string;
  description: string;
  href: string;
};

export type AdminReportPresentation = {
  reportId: AdminReportId;
  state: ReportsState;
  message: string;
  groups: ReportPresentationGroup[];
  recordGroups: ReportPresentationRecordGroup[];
  actions: ReportPresentationAction[];
};

function stateFromStatuses(statuses: readonly ReportsSourceStatus[]): ReportsState {
  if (!statuses.length || statuses.every((status) => status === "unavailable")) return "unavailable";
  return statuses.every((status) => status === "ready") ? "ready" : "partial";
}

function analyticsState(state: AdminReportsModel["analytics"]["state"]): ReportsState {
  return state;
}

function formatBytes(value: string) {
  const bytes = BigInt(value);
  if (bytes === BigInt(0)) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let amount = Number(bytes);
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function metricValue(metric: AnalyticsMetric) {
  if (metric.unit === "ratio") return `${(metric.value * 100).toFixed(1)}%`;
  if (metric.unit === "milliseconds") return `${(metric.value / 1000).toFixed(1)} s`;
  if (metric.unit === "currency") return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(metric.value);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(metric.value);
}

function filterPresentation(
  groups: ReportPresentationGroup[],
  records: ReportPresentationRecordGroup[],
  filter: string,
) {
  if (filter === "all") return { groups, records };
  return {
    groups: groups
      .map((group) => ({ ...group, metrics: group.metrics.filter((metric) => metric.filter === filter) }))
      .filter((group) => group.metrics.length > 0),
    records: records.filter((group) => group.filter === filter),
  };
}

function contentPresentation(model: AdminReportsModel) {
  const dashboard = model.dashboard.data;
  const reports = model.reports.data;
  const review = model.contentReview.data;
  const groups: ReportPresentationGroup[] = [];
  const records: ReportPresentationRecordGroup[] = [];

  if (dashboard) {
    groups.push({
      id: "content-volume",
      title: "حجم المحتوى وحالة النشر",
      description: "من Dashboard Read Model المشترك.",
      metrics: [
        { id: "content-total", label: "إجمالي المحتوى", value: dashboard.kpis.topics.total, filter: "all" },
        { id: "content-published", label: "منشور", value: dashboard.kpis.topics.published, filter: "all" },
        { id: "content-drafts", label: "مسودات", value: dashboard.kpis.topics.draft, filter: "draft", href: "/admin/content/topics?status=draft" },
        { id: "content-unpublished", label: "غير منشور", value: dashboard.kpis.topics.unpublished, filter: "all", href: "/admin/content/topics?status=unpublished" },
      ],
    });
    records.push({
      id: "recent-content",
      title: "أهم المحتوى الحديث",
      description: "أحدث المحتويات حسب updated_at؛ ليست بديلًا عن Audit.",
      filter: "all",
      items: dashboard.recentTopics.map((topic) => ({
        id: `topic-${topic.id}`,
        title: topic.title,
        meta: `${topic.category} · ${topic.contentType}`,
        status: topic.status ?? "draft",
        href: `/admin/content/topics/${topic.id}`,
      })),
    });
  }
  if (reports) {
    groups.push({
      id: "content-health",
      title: "صحة المحتوى",
      description: "مشكلات الجودة المحسوبة داخل Reports Read Model.",
      metrics: [
        { id: "content-missing-images", label: "صور ناقصة", value: reports.content.missingImages, filter: "missing_images", href: "/admin/reports/topics-without-image" },
        { id: "content-missing-seo", label: "SEO ناقص", value: reports.content.missingSeo, filter: "missing_seo", href: "/admin/content/topics" },
        { id: "content-missing-alt", label: "Alt ناقص", value: reports.content.missingImageAlt, filter: "missing_alt", href: "/admin/media-library" },
        { id: "content-published-missing-seo", label: "منشور مع SEO ناقص", value: reports.content.publishedWithMissingSeo, filter: "missing_seo" },
      ],
    });
  }
  if (review) {
    groups.push({
      id: "content-review",
      title: "المراجعة والجاهزية",
      description: "نفس قواعد Content Review وPublishing الحالية.",
      metrics: [
        { id: "review-checked", label: "تم فحصه", value: review.checked, filter: "all" },
        { id: "review-ready", label: "جاهز", value: review.ready, filter: "all" },
        { id: "review-blocked", label: "محجوب", value: review.blocked, filter: "review_blocked" },
        { id: "review-published-blocked", label: "منشور مع موانع", value: review.publishedWithBlocks, filter: "review_blocked" },
      ],
    });
    records.push({
      id: "blocked-content-samples",
      title: "عينات المراجعة المحجوبة",
      description: "عينة محدودة من مالك Content Review وليست قائمة كاملة.",
      filter: "review_blocked",
      items: review.samples.map((item) => ({
        id: `review-${item.id}`,
        title: item.title || `محتوى #${item.id}`,
        meta: item.blockerIds.join(" · "),
        status: item.status ?? "draft",
        href: `/admin/content/topics/${item.id}`,
      })),
    });
  }

  return {
    state: stateFromStatuses([model.dashboard.status, model.reports.status, model.contentReview.status]),
    message: "تقرير المحتوى مركّب من Dashboard وReports Read Model وContent Review دون مالك موازٍ.",
    groups,
    records,
    actions: [
      { id: "content-owner", label: "إدارة المحتوى", description: "فتح المالك التشغيلي للمحتوى.", href: "/admin/content/topics" },
      { id: "missing-image-owner", label: "موضوعات بلا صورة", description: "فتح التقرير المتخصص ذي الصفوف الكاملة.", href: "/admin/reports/topics-without-image" },
    ],
  };
}

function projectsPresentation(model: AdminReportsModel) {
  const dashboard = model.dashboard.data;
  const reports = model.reports.data;
  const groups: ReportPresentationGroup[] = [];
  const records: ReportPresentationRecordGroup[] = [];
  if (dashboard) {
    groups.push({
      id: "project-publication",
      title: "حالة المشاريع",
      description: "حقيقة النشر من Dashboard Read Model.",
      metrics: [
        { id: "projects-total", label: "إجمالي المشاريع", value: dashboard.kpis.projects.total, filter: "health" },
        { id: "projects-published", label: "منشورة", value: dashboard.kpis.projects.published, filter: "published" },
        { id: "projects-drafts", label: "مسودات", value: dashboard.kpis.projects.draft, filter: "all" },
        { id: "projects-unpublished", label: "غير منشورة", value: dashboard.kpis.projects.unpublished, filter: "all" },
      ],
    });
    records.push({
      id: "recent-projects",
      title: "أهم المشاريع الحديثة",
      description: "أحدث المشاريع من نفس Dashboard Read Model.",
      filter: "all",
      items: dashboard.recentProjects.map((project) => ({
        id: `project-${project.id}`,
        title: project.arabicName,
        meta: `${project.code} · ${project.updatedAt}`,
        status: project.publicationStatus,
        href: `/admin/projects/${project.id}`,
      })),
    });
  }
  if (reports) {
    groups.push(
      {
        id: "project-health",
        title: "صحة واكتمال البيانات",
        description: "الاكتمال وSEO والصور من Reports Read Model.",
        metrics: [
          { id: "projects-complete", label: "مكتملة البيانات", value: reports.projects.complete, filter: "health" },
          { id: "projects-incomplete", label: "ناقصة البيانات", value: reports.projects.incomplete, filter: "incomplete" },
          { id: "projects-featured", label: "مميزة", value: reports.projects.featured, filter: "featured" },
          { id: "projects-missing-seo", label: "SEO ناقص", value: reports.projects.missingSeo, filter: "missing_seo" },
          { id: "projects-missing-images", label: "صور أساسية ناقصة", value: reports.projects.missingImages, filter: "missing_images" },
        ],
      },
      {
        id: "construction-updates",
        title: "تحديثات التنفيذ",
        description: "المصدر الحالي هو Unified Content من النوع site_update؛ لا يوجد Construction Status مستقل.",
        metrics: [
          { id: "updates-total", label: "إجمالي التحديثات", value: reports.projects.constructionUpdates.total, filter: "all" },
          { id: "updates-published", label: "منشورة", value: reports.projects.constructionUpdates.published, filter: "published" },
          { id: "updates-draft", label: "مسودات", value: reports.projects.constructionUpdates.draft, filter: "all" },
          { id: "updates-unpublished", label: "غير منشورة", value: reports.projects.constructionUpdates.unpublished, filter: "all" },
        ],
      },
    );
  }
  return {
    state: stateFromStatuses([model.dashboard.status, model.reports.status]),
    message: "تقرير المشاريع يعيد استخدام Dashboard وReports Read Model، وتحديثات التنفيذ من Unified Content.",
    groups,
    records,
    actions: [
      { id: "residential-projects", label: "المشاريع السكنية", description: "فتح قائمة المالك السكني.", href: "/admin/projects/residential" },
      { id: "commercial-projects", label: "المشاريع التجارية", description: "فتح قائمة المالك التجاري.", href: "/admin/projects/commercial" },
      { id: "construction-owner", label: "تحديثات التنفيذ", description: "فتح مالك site_update الحالي.", href: "/admin/projects/construction-updates" },
    ],
  };
}

function analyticsPresentation(model: AdminReportsModel, businessOnly = false) {
  const domains = businessOnly ? [model.analytics.reports.business] : [
    model.analytics.reports.content,
    model.analytics.reports.projects,
    model.analytics.reports.seo,
  ];
  const groups: ReportPresentationGroup[] = domains
    .filter((domain) => domain.metrics.length > 0)
    .map((domain) => ({
      id: `analytics-${domain.domain}`,
      title: `${domain.domain} Analytics`,
      description: domain.message,
      metrics: domain.metrics.map((metric) => ({
        id: metric.key,
        label: metric.label,
        value: metricValue(metric),
        filter: businessOnly
          ? metric.key.includes("leads") ? "leads"
            : metric.key.includes("conversion") ? "conversion"
              : metric.key.includes("campaign") ? "campaigns"
                : metric.key.includes("roi") ? "roi"
                  : "sources"
          : domain.domain,
        description: metric.comparison
          ? `${metric.periodStart} — ${metric.periodEnd} · مقارنة ${metric.comparison.periodStart} — ${metric.comparison.periodEnd}: ${metricValue({ ...metric, value: metric.comparison.value, comparison: undefined })}`
          : `${metric.periodStart} — ${metric.periodEnd}`,
      })),
    }));
  const relevantProviders = model.analytics.providers.filter((provider) =>
    businessOnly ? provider.domains.includes("business") : provider.domains.some((domain) => domain !== "business"),
  );
  const records: ReportPresentationRecordGroup[] = [{
    id: "analytics-providers",
    title: "حالة مزودي Analytics",
    description: "الحالة من Analytics Adapter Registry؛ لا يوجد اتصال مباشر داخل التقرير.",
    filter: businessOnly ? "all" : "providers",
    items: relevantProviders.map((provider) => ({
      id: provider.provider,
      title: provider.label,
      meta: provider.message,
      status: provider.status,
    })),
  }];
  const domainState = businessOnly ? model.analytics.reports.business.state : model.analytics.state;
  return {
    state: analyticsState(domainState),
    message: businessOnly
      ? model.analytics.reports.business.message
      : "كل Analytics تمر عبر العقد والـAdapter Registry الواحد؛ غياب المزود لا يتحول إلى Charts أوأصفار.",
    groups,
    records,
    actions: [
      { id: "analytics-integrations", label: "إعدادات التكاملات", description: "فتح شاشة التكاملات دون ربط مباشر من التقرير.", href: "/admin/settings/integrations" },
    ],
  };
}

function seoPresentation(model: AdminReportsModel) {
  const reports = model.reports.data;
  const seo = model.seo.data;
  const groups: ReportPresentationGroup[] = [];
  const records: ReportPresentationRecordGroup[] = [];
  if (reports) {
    groups.push({
      id: "seo-truth",
      title: "Metadata وIndexability",
      description: "العدّادات من Reports Read Model.",
      metrics: [
        { id: "seo-topics-missing", label: "محتوى ناقص Metadata", value: reports.seo.missingMetadata.topics, filter: "missing_metadata" },
        { id: "seo-projects-missing", label: "مشاريع ناقصة Metadata", value: reports.seo.missingMetadata.projects, filter: "missing_metadata" },
        { id: "seo-pages-missing", label: "صفحات ناقصة Metadata", value: reports.seo.missingMetadata.pages, filter: "missing_metadata" },
        { id: "seo-canonical", label: "Canonical Overrides", value: reports.seo.canonicalOverrides, filter: "canonical" },
        { id: "seo-indexable", label: "منشور قابل للفهرسة", value: reports.seo.indexability.indexablePublished, filter: "indexability" },
        { id: "seo-noindex", label: "منشور Noindex", value: reports.seo.indexability.noindexPublished, filter: "indexability" },
      ],
    });
  }
  if (seo) {
    groups.push({
      id: "seo-health",
      title: "Global SEO Health",
      description: seo.scoreFormula,
      metrics: [
        { id: "seo-score", label: "SEO Health", value: `${seo.score}%`, filter: "all" },
        { id: "seo-sitemap", label: "Sitemap Coverage", value: seo.sitemap.totalUrlCount, filter: "sitemap", href: "/admin/seo/sitemap" },
        ...Object.entries(seo.dimensionScores).map(([dimension, value]) => ({
          id: `seo-dimension-${dimension}`,
          label: dimension,
          value: `${value}%`,
          filter: "all",
        })),
      ],
    });
    records.push({
      id: "seo-checks",
      title: "أهم تشخيصات SEO",
      description: "Checks من Global SEO owner.",
      filter: "all",
      items: seo.checks.map((check) => ({
        id: check.id,
        title: check.title,
        meta: check.detail,
        status: check.status,
        href: "/admin/seo/sitemap",
      })),
    });
  }
  return {
    state: stateFromStatuses([model.reports.status, model.seo.status]),
    message: "SEO Read Model وGlobal SEO Health يظلان المالكين الوحيدين للحقيقة والتشخيص.",
    groups,
    records,
    actions: [
      { id: "seo-health-owner", label: "SEO Health", description: "فتح المالك التشخيصي الكامل.", href: "/admin/seo/sitemap" },
      { id: "seo-meta-owner", label: "إعدادات SEO", description: "فتح مالك Metadata العام.", href: "/admin/seo/meta-manager" },
    ],
  };
}

function mediaPresentation(model: AdminReportsModel) {
  const reports = model.reports.data;
  const media = model.media.data;
  const groups: ReportPresentationGroup[] = [];
  const records: ReportPresentationRecordGroup[] = [];
  if (reports) {
    groups.push({
      id: "media-health",
      title: "صحة الميديا",
      description: "Storage وReference Sync وجودة Metadata من Reports Read Model.",
      metrics: [
        { id: "media-storage", label: "حجم معروف", value: formatBytes(reports.media.storage.knownBytes), filter: "storage" },
        { id: "media-size-unknown", label: "حجم غير معروف", value: reports.media.storage.unknownByteSize, filter: "storage" },
        { id: "media-broken", label: "مراجع مكسورة", value: reports.media.brokenReferences, filter: "broken_references" },
        { id: "media-objects", label: "Objects مفقودة", value: reports.media.missingObjects, filter: "missing_objects" },
        { id: "media-alt", label: "Alt مفقود", value: reports.media.missingAlt, filter: "missing_alt" },
        { id: "media-video", label: "Video URLs مفقودة", value: reports.media.missingVideoUrls, filter: "missing_video_urls" },
      ],
    });
  }
  if (media) {
    groups.push({
      id: "media-runtime",
      title: "Media Runtime Diagnostics",
      description: `Provider: ${media.provider ?? "غير متاح"} · Environment: ${media.environment ?? "غير متاح"}`,
      metrics: [
        { id: "media-catalog-count", label: "Catalog Assets", value: media.catalogAssetCount ?? "غير متاح", filter: "all" },
        { id: "media-storage-count", label: "Storage Assets", value: media.storageAssetCount ?? "غير متاح", filter: "storage" },
      ],
    });
    records.push({
      id: "media-warnings",
      title: "Diagnostics الحالية",
      description: "Structured warnings من Media owner.",
      filter: "all",
      items: media.warnings.map((warning, index) => ({ id: `media-warning-${index + 1}`, title: warning, meta: media.state, status: "warning", href: "/admin/settings/media" })),
    });
  }
  return {
    state: stateFromStatuses([model.reports.status, model.media.status]),
    message: "تقرير الميديا يقرأ من Reports Read Model وMedia Diagnostics دون فحص Storage موازٍ.",
    groups,
    records,
    actions: [
      { id: "media-library", label: "مكتبة الميديا", description: "فتح مالك إدارة الأصول.", href: "/admin/media-library" },
      { id: "media-missing-topics", label: "موضوعات بلا صورة", description: "فتح التقرير المتخصص القابل للإجراء.", href: "/admin/reports/topics-without-image" },
      { id: "media-settings", label: "تشخيص الميديا", description: "فتح إعدادات وتشخيص المالك.", href: "/admin/settings/media" },
    ],
  };
}

function publishingPresentation(model: AdminReportsModel) {
  const reports = model.reports.data;
  const review = model.contentReview.data;
  const groups: ReportPresentationGroup[] = [];
  const records: ReportPresentationRecordGroup[] = [];
  if (reports) {
    groups.push({
      id: "publishing-truth",
      title: "حركة النشر",
      description: "النشر الحديث والمعلّق والمسودات من Database Read Model.",
      metrics: [
        { id: "publishing-recent-topics", label: "محتوى نُشر خلال 30 يومًا", value: reports.publishing.recentPublishing.topics, filter: "recent" },
        { id: "publishing-recent-projects", label: "مشاريع نُشرت خلال 30 يومًا", value: reports.publishing.recentPublishing.projects, filter: "recent" },
        { id: "publishing-pending-topics", label: "محتوى معلّق", value: reports.publishing.pendingPublishing.topics, filter: "pending" },
        { id: "publishing-pending-projects", label: "مشاريع معلّقة", value: reports.publishing.pendingPublishing.projects, filter: "pending" },
        { id: "publishing-drafts-topics", label: "مسودات محتوى", value: reports.publishing.drafts.topics, filter: "drafts", href: "/admin/content/topics?status=draft" },
        { id: "publishing-drafts-projects", label: "مسودات مشاريع", value: reports.publishing.drafts.projects, filter: "drafts" },
        { id: "publishing-drafts-pages", label: "مسودات صفحات", value: reports.publishing.drafts.pages, filter: "drafts", href: "/admin/pages-blocks/pages" },
      ],
    });
  }
  if (review) {
    groups.push({
      id: "publishing-validation",
      title: "موانع التحقق",
      description: "من Content Review Capability نفسها.",
      metrics: [
        { id: "publishing-blocked", label: "محجوب بالمراجعة", value: review.blocked, filter: "validation_blocks" },
        { id: "publishing-published-blocks", label: "منشور مع موانع", value: review.publishedWithBlocks, filter: "validation_blocks" },
      ],
    });
    records.push({
      id: "publishing-blockers",
      title: "أكثر موانع النشر تكرارًا",
      description: "المعرفات نفسها التي تعيدها قواعد النشر الحالية.",
      filter: "validation_blocks",
      items: review.blockingChecks.map((item) => ({ id: item.id, title: item.id, meta: `${item.count} سجل`, status: "blocked" })),
    });
  }
  return {
    state: stateFromStatuses([model.reports.status, model.contentReview.status]),
    message: "حركة النشر من Database، وموانع التحقق من Content Review owner دون قواعد موازية.",
    groups,
    records,
    actions: [
      { id: "publishing-content", label: "مسودات المحتوى", description: "فتح قائمة المحتوى على حالة المسودة.", href: "/admin/content/topics?status=draft" },
      { id: "publishing-pages", label: "إدارة الصفحات", description: "فتح مالك صفحات الموقع.", href: "/admin/pages-blocks/pages" },
    ],
  };
}

function auditPresentation(model: AdminReportsModel) {
  const audit = model.audit.data;
  const groups: ReportPresentationGroup[] = [];
  const records: ReportPresentationRecordGroup[] = [];
  if (audit) {
    groups.push({
      id: "audit-summary",
      title: "ملخص Audit",
      description: `التجميعات من أحدث ${audit.sampled} حدث؛ الإجمالي الكامل مستقل عن حجم العينة.`,
      metrics: [
        { id: "audit-total", label: "إجمالي الأحداث", value: audit.total, filter: "all" },
        { id: "audit-sampled", label: "حجم العينة", value: audit.sampled, filter: "all" },
        ...audit.entityActivity.slice(0, 6).map((item) => ({ id: `entity-${item.entityType}`, label: item.entityType, value: item.count, filter: "entity" })),
        ...audit.userActivity.slice(0, 6).map((item) => ({ id: `user-${item.actor}`, label: item.actor, value: item.count, filter: "user" })),
      ],
    });
    records.push(
      {
        id: "audit-recent",
        title: "النشاط الحديث",
        description: "أحدث أحداث Audit من العينة الحالية.",
        filter: "recent",
        items: audit.recentActivity.map((event) => ({ id: `audit-${event.id}`, title: event.action, meta: `${event.actor} · ${event.entityLabel ?? event.entityType ?? "system"} · ${event.createdAt}`, status: "recorded" })),
      },
      {
        id: "audit-publishing",
        title: "تاريخ النشر",
        description: "أحداث النشر وإلغاء النشر داخل العينة الحالية.",
        filter: "publishing",
        items: audit.publishingHistory.map((event) => ({ id: `publish-${event.id}`, title: event.action, meta: `${event.actor} · ${event.entityLabel ?? event.entityType ?? "system"} · ${event.createdAt}`, status: "recorded" })),
      },
    );
  }
  return {
    state: stateFromStatuses([model.audit.status]),
    message: model.audit.message,
    groups,
    records,
    actions: [{ id: "audit-owner", label: "سجل النشاط الكامل", description: "فتح Audit owner مع البحث والفلاتر الكاملة.", href: "/admin/activity-log" }],
  };
}

function systemPresentation(model: AdminReportsModel) {
  const reports = model.reports.data;
  const groups: ReportPresentationGroup[] = [];
  const records: ReportPresentationRecordGroup[] = [];
  if (reports) {
    groups.push({
      id: "database-proof",
      title: "Database وMigration Proof",
      description: reports.databaseDiagnostics.source,
      metrics: [
        { id: "migration-registry", label: "Migration Registered", value: reports.databaseDiagnostics.migrationRegistered ? "yes" : "no", filter: "migrations" },
        { id: "dashboard-model", label: "Dashboard Read Model", value: reports.databaseDiagnostics.dashboardReadModelAvailable ? "available" : "missing", filter: "read_models" },
        { id: "rpc-acl", label: "RPC ACL Service-only", value: reports.databaseDiagnostics.rpcAclServiceOnly ? "yes" : "no", filter: "migrations" },
        { id: "missing-indexes", label: "Missing Indexes", value: reports.databaseDiagnostics.missingIndexes.length, filter: "migrations" },
        { id: "rls-ready", label: "RLS Tables Ready", value: Object.values(reports.databaseDiagnostics.rls).filter(Boolean).length, filter: "migrations" },
      ],
    });
    records.push({
      id: "sources-of-truth",
      title: "Sources of Truth",
      description: "المصادر المعلنة بواسطة Reports Read Model.",
      filter: "sources",
      items: reports.sourcesOfTruth.map((source) => ({ id: source, title: source, meta: "authoritative source", status: "ready" })),
    });
  }
  const sources = [model.dashboard, model.reports, model.contentReview, model.audit, model.seo, model.media];
  records.push({
    id: "report-sources",
    title: "حالة مصادر الطلب",
    description: "Diagnostics مستقلة لكل مالك؛ فشل مصدر لا يتحول إلى نجاح وهمي.",
    filter: "diagnostics",
    items: sources.map((source) => ({ id: source.key, title: source.label, meta: `${source.message} · ${source.source}`, status: source.status, href: source.href })),
  });
  groups.push({
    id: "cache-proof",
    title: "Cache وRevalidation",
    description: model.cache.message,
    metrics: [{ id: "cache-status", label: "Request-time truth", value: model.cache.status, filter: "cache", description: model.cache.source }],
  });
  return {
    state: model.state,
    message: "التشخيص يجمع حالات الملاك الحالية دون إنشاء Health store أوCache owner جديد.",
    groups,
    records,
    actions: [
      { id: "system-media", label: "تشخيص الميديا", description: "فتح Media diagnostics owner.", href: "/admin/settings/media" },
      { id: "system-seo", label: "تشخيص SEO", description: "فتح Global SEO owner.", href: "/admin/seo/sitemap" },
    ],
  };
}

export function buildAdminReportPresentation(
  model: AdminReportsModel,
  reportId: AdminReportId,
  context: AdminReportQueryContext,
): AdminReportPresentation {
  const base = reportId === "content" ? contentPresentation(model)
    : reportId === "projects" ? projectsPresentation(model)
      : reportId === "analytics" ? analyticsPresentation(model)
        : reportId === "seo" ? seoPresentation(model)
          : reportId === "media" ? mediaPresentation(model)
            : reportId === "publishing" ? publishingPresentation(model)
              : reportId === "audit" ? auditPresentation(model)
                : reportId === "system" ? systemPresentation(model)
                  : analyticsPresentation(model, true);
  const filtered = filterPresentation(base.groups, base.records, context.filter);
  const definition = getAdminReportDefinition(reportId);
  return {
    reportId,
    state: base.state,
    message: context.filter === "all"
      ? base.message
      : `${base.message} الفلتر النشط: ${definition.filters.find((item) => item.id === context.filter)?.label}.`,
    groups: filtered.groups,
    recordGroups: filtered.records,
    actions: base.actions,
  };
}

export type ReportExportRow = {
  section: string;
  item: string;
  value: string;
  context: string;
};

export function buildAdminReportExportRows(presentation: AdminReportPresentation): ReportExportRow[] {
  return [
    ...presentation.groups.flatMap((group) => group.metrics.map((metric) => ({
      section: group.title,
      item: metric.label,
      value: String(metric.value),
      context: metric.description ?? metric.filter,
    }))),
    ...presentation.recordGroups.flatMap((group) => group.items.map((item) => ({
      section: group.title,
      item: item.title,
      value: item.status ?? "record",
      context: item.meta,
    }))),
  ];
}
