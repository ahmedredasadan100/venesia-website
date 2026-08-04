export type SitemapEntrySource =
  | "static_pages"
  | "cms_pages"
  | "projects"
  | "articles"
  | "media"
  | "track_your_project";

export type SitemapEntry = {
  url: string;
  path: string;
  source: SitemapEntrySource;
  lastModified?: Date;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
  entityId?: number | string;
  slug?: string;
  canonicalOverride?: string;
};

export type SitemapMonitorSnapshot = {
  status: "healthy" | "warning" | "error";
  checkedAt: string;
  generationMode: "runtime";
  generationError?: string;
  totalUrlCount: number;
  countsBySource: Record<SitemapEntrySource, number>;
  excludedCounts: SitemapExcludedCounts;
  checks: SitemapCheckItem[];
  googleSearchConsoleStatus: "not_connected";
};

export type SitemapCheckSeverity = "info" | "warning" | "error";

export type SitemapCheckItem = {
  id: string;
  severity: SitemapCheckSeverity;
  title: string;
  detail: string;
  count?: number;
  samples?: string[];
};

export type SitemapExcludedCounts = {
  unpublished: number;
  deleted: number;
  noindex: number;
  invalidOrMissingSlug: number;
};

const SOURCE_LABELS: Record<SitemapEntrySource, string> = {
  static_pages: "صفحات ثابتة",
  cms_pages: "صفحات CMS",
  projects: "مشروعات",
  articles: "مقالات",
  media: "محتوى إعلامي",
  track_your_project: "تابع مشروعك",
};

export function getSitemapSourceLabel(source: SitemapEntrySource) {
  return SOURCE_LABELS[source];
}

export type SitemapGenerationResult = {
  entries: SitemapEntry[];
  generationMode: "runtime";
  generatedAt: string;
  error?: string;
  sourceErrors: Array<{ source: SitemapEntrySource; message: string }>;
  duplicateUrls: string[];
};
