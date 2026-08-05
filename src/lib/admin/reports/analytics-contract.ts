export const ANALYTICS_CONTRACT_VERSION = "admin-analytics-v1" as const;

export type AnalyticsCapabilityState = "ready" | "partial" | "unavailable";
export type AnalyticsProviderStatus =
  | "not_configured"
  | "ready"
  | "partial"
  | "unavailable";
export type AnalyticsPeriod = "last_30_days" | "last_90_days";
export type AnalyticsCompare = "none" | "previous_period" | "previous_year";
export type AnalyticsQueryContext = {
  period: AnalyticsPeriod;
  compare: AnalyticsCompare;
};
export const DEFAULT_ANALYTICS_QUERY: AnalyticsQueryContext = {
  period: "last_30_days",
  compare: "none",
};
export type AnalyticsReportDomain = "content" | "projects" | "seo" | "business";
export type AnalyticsProviderKey =
  | "google_analytics_4"
  | "google_search_console"
  | "google_ads"
  | "meta_marketing"
  | "tiktok_ads"
  | "snapchat_ads"
  | "microsoft_clarity"
  | "crm";

export type AnalyticsMetricKey =
  | "content.most_viewed"
  | "content.most_read"
  | "content.time_on_page"
  | "content.bounce_rate"
  | "content.scroll_depth"
  | "content.ctr"
  | "content.traffic_sources"
  | "projects.most_visited"
  | "projects.leads"
  | "projects.conversion_funnel"
  | "projects.interest"
  | "projects.geography"
  | "seo.organic_traffic"
  | "seo.keyword_performance"
  | "seo.landing_pages"
  | "seo.search_ctr"
  | "business.leads"
  | "business.conversion_rate"
  | "business.campaign_performance"
  | "business.roi"
  | "business.sources";

export type AnalyticsMetric = {
  key: AnalyticsMetricKey;
  label: string;
  value: number;
  unit: "count" | "milliseconds" | "ratio" | "currency";
  periodStart: string;
  periodEnd: string;
  dimensions?: Record<string, string>;
  comparison?: {
    value: number;
    periodStart: string;
    periodEnd: string;
    changeRatio?: number;
  };
};

export type AnalyticsProviderDefinition = {
  key: AnalyticsProviderKey;
  label: string;
  domains: readonly AnalyticsReportDomain[];
};

export const ANALYTICS_PROVIDER_DEFINITIONS = [
  {
    key: "google_analytics_4",
    label: "Google Analytics 4",
    domains: ["content", "projects", "business"],
  },
  {
    key: "google_search_console",
    label: "Google Search Console",
    domains: ["seo"],
  },
  {
    key: "google_ads",
    label: "Google Ads",
    domains: ["projects", "business"],
  },
  {
    key: "meta_marketing",
    label: "Meta Marketing API",
    domains: ["projects", "business"],
  },
  {
    key: "tiktok_ads",
    label: "TikTok Ads",
    domains: ["projects", "business"],
  },
  {
    key: "snapchat_ads",
    label: "Snapchat Ads",
    domains: ["projects", "business"],
  },
  {
    key: "microsoft_clarity",
    label: "Microsoft Clarity",
    domains: ["content", "projects"],
  },
  {
    key: "crm",
    label: "CRM",
    domains: ["projects", "business"],
  },
] as const satisfies readonly AnalyticsProviderDefinition[];

export type AnalyticsProviderResult = {
  provider: AnalyticsProviderKey;
  status: Exclude<AnalyticsProviderStatus, "not_configured">;
  checkedAt: string;
  message: string;
  metrics: AnalyticsMetric[];
};

export interface AnalyticsProviderAdapter {
  readonly provider: AnalyticsProviderKey;
  load(query: AnalyticsQueryContext): Promise<AnalyticsProviderResult>;
}

export type AnalyticsProviderSnapshot = {
  provider: AnalyticsProviderKey;
  label: string;
  status: AnalyticsProviderStatus;
  checkedAt: string;
  message: string;
  domains: readonly AnalyticsReportDomain[];
  metrics: AnalyticsMetric[];
};

export type AnalyticsDomainReport = {
  domain: AnalyticsReportDomain;
  state: AnalyticsCapabilityState;
  message: string;
  providers: AnalyticsProviderKey[];
  metrics: AnalyticsMetric[];
};

export type AnalyticsSnapshot = {
  contractVersion: typeof ANALYTICS_CONTRACT_VERSION;
  query: AnalyticsQueryContext;
  state: AnalyticsCapabilityState;
  checkedAt: string;
  providers: AnalyticsProviderSnapshot[];
  reports: Record<AnalyticsReportDomain, AnalyticsDomainReport>;
};

const METRIC_DOMAINS: Record<AnalyticsMetricKey, AnalyticsReportDomain> = {
  "content.most_viewed": "content",
  "content.most_read": "content",
  "content.time_on_page": "content",
  "content.bounce_rate": "content",
  "content.scroll_depth": "content",
  "content.ctr": "content",
  "content.traffic_sources": "content",
  "projects.most_visited": "projects",
  "projects.leads": "projects",
  "projects.conversion_funnel": "projects",
  "projects.interest": "projects",
  "projects.geography": "projects",
  "seo.organic_traffic": "seo",
  "seo.keyword_performance": "seo",
  "seo.landing_pages": "seo",
  "seo.search_ctr": "seo",
  "business.leads": "business",
  "business.conversion_rate": "business",
  "business.campaign_performance": "business",
  "business.roi": "business",
  "business.sources": "business",
};

export function assertAnalyticsProviderResult(
  definition: AnalyticsProviderDefinition,
  result: AnalyticsProviderResult,
  query: AnalyticsQueryContext,
) {
  if (result.provider !== definition.key) {
    throw new Error(`Analytics adapter ${definition.key} returned another provider identity`);
  }
  if (result.status === "ready" && result.metrics.length === 0) {
    throw new Error(`Analytics adapter ${definition.key} cannot claim ready without data`);
  }
  if (result.status === "unavailable" && result.metrics.length > 0) {
    throw new Error(`Unavailable Analytics adapter ${definition.key} cannot expose metrics`);
  }
  for (const metric of result.metrics) {
    if (!Number.isFinite(metric.value)) {
      throw new Error(`Analytics metric ${metric.key} has a non-finite value`);
    }
    const domain = METRIC_DOMAINS[metric.key];
    if (!definition.domains.includes(domain)) {
      throw new Error(`Analytics adapter ${definition.key} does not own ${metric.key}`);
    }
    if (!metric.periodStart || !metric.periodEnd) {
      throw new Error(`Analytics metric ${metric.key} is missing its reporting period`);
    }
    if (query.compare === "none" && metric.comparison) {
      throw new Error(`Analytics metric ${metric.key} returned an unrequested comparison`);
    }
    if (query.compare !== "none" && result.status === "ready" && !metric.comparison) {
      throw new Error(`Ready Analytics metric ${metric.key} is missing its requested comparison`);
    }
    if (metric.comparison) {
      if (!Number.isFinite(metric.comparison.value) ||
        (metric.comparison.changeRatio != null && !Number.isFinite(metric.comparison.changeRatio))) {
        throw new Error(`Analytics metric ${metric.key} has an invalid comparison value`);
      }
      if (!metric.comparison.periodStart || !metric.comparison.periodEnd) {
        throw new Error(`Analytics metric ${metric.key} is missing its comparison period`);
      }
    }
  }
}

function buildDomainReports(providers: readonly AnalyticsProviderSnapshot[]) {
  const domains: AnalyticsReportDomain[] = ["content", "projects", "seo", "business"];
  return Object.fromEntries(
    domains.map((domain) => {
      const candidates = providers.filter((provider) => provider.domains.includes(domain));
      const active = candidates.filter(
        (provider) => provider.status === "ready" || provider.status === "partial",
      );
      const metrics = active.flatMap((provider) =>
        provider.metrics.filter((metric) => METRIC_DOMAINS[metric.key] === domain),
      );
      const state: AnalyticsCapabilityState = metrics.length === 0
        ? "unavailable"
        : active.some((provider) => provider.status === "partial")
          ? "partial"
          : "ready";
      return [domain, {
        domain,
        state,
        message: state === "unavailable"
          ? "لا يوجد مصدر Analytics مفعّل يعيد بيانات حقيقية لهذا التقرير."
          : state === "partial"
            ? "البيانات المتاحة جزئية وفق حالة المزود الحالي."
            : "البيانات محمّلة من مزود مفعّل عبر Analytics Adapter Contract.",
        providers: candidates.map((provider) => provider.provider),
        metrics,
      } satisfies AnalyticsDomainReport];
    }),
  ) as Record<AnalyticsReportDomain, AnalyticsDomainReport>;
}

export function createAnalyticsProviderRegistry(
  adapters: readonly AnalyticsProviderAdapter[],
) {
  const byProvider = new Map<AnalyticsProviderKey, AnalyticsProviderAdapter>();
  for (const adapter of adapters) {
    if (byProvider.has(adapter.provider)) {
      throw new Error(`Duplicate Analytics adapter: ${adapter.provider}`);
    }
    if (!ANALYTICS_PROVIDER_DEFINITIONS.some((item) => item.key === adapter.provider)) {
      throw new Error(`Unknown Analytics provider: ${adapter.provider}`);
    }
    byProvider.set(adapter.provider, adapter);
  }

  return {
    async load(query: AnalyticsQueryContext = DEFAULT_ANALYTICS_QUERY): Promise<AnalyticsSnapshot> {
      if (!["last_30_days", "last_90_days"].includes(query.period) ||
        !["none", "previous_period", "previous_year"].includes(query.compare)) {
        throw new Error("Invalid Analytics query context");
      }
      const checkedAt = new Date().toISOString();
      const providers = await Promise.all(
        ANALYTICS_PROVIDER_DEFINITIONS.map(async (definition): Promise<AnalyticsProviderSnapshot> => {
          const adapter = byProvider.get(definition.key);
          if (!adapter) {
            return {
              ...definition,
              provider: definition.key,
              status: "not_configured",
              checkedAt,
              message: "المزود مدعوم بالعقد لكنه غير مفعّل في هذه البيئة.",
              metrics: [],
            };
          }
          try {
            const result = await adapter.load(query);
            assertAnalyticsProviderResult(definition, result, query);
            return { ...definition, ...result };
          } catch {
            return {
              ...definition,
              provider: definition.key,
              status: "unavailable",
              checkedAt: new Date().toISOString(),
              message: "تعذر تحميل المزود عبر Analytics Adapter Contract.",
              metrics: [],
            };
          }
        }),
      );
      const reports = buildDomainReports(providers);
      const reportStates = Object.values(reports).map((report) => report.state);
      const state: AnalyticsCapabilityState = reportStates.every((value) => value === "unavailable")
        ? "unavailable"
        : reportStates.every((value) => value === "ready")
          ? "ready"
          : "partial";
      return {
        contractVersion: ANALYTICS_CONTRACT_VERSION,
        query,
        state,
        checkedAt,
        providers,
        reports,
      };
    },
  };
}
