import type {
  GlobalSeoEffectiveSource,
  GlobalSeoFieldKey,
} from "./global-seo-types";
import type { SitemapMonitorSnapshot } from "./sitemap-monitor-types";

export type GlobalSeoHealthDimension =
  | "identity"
  | "metadata"
  | "crawl"
  | "adoption"
  | "infrastructure";

export type GlobalSeoHealthCheck = {
  id: string;
  dimension: GlobalSeoHealthDimension;
  status: "pass" | "warning" | "fail";
  weight: number;
  title: string;
  detail: string;
  samples?: string[];
  productDecision?: boolean;
};

export type GlobalSeoEffectiveSourceSnapshot = {
  field: GlobalSeoFieldKey;
  source: GlobalSeoEffectiveSource;
  persisted: boolean;
  environmentKey: string;
  displayValue: string;
};

export type GlobalSeoHealthSnapshot = {
  status: "healthy" | "warning" | "error";
  checkedAt: string;
  score: number;
  scoreFormula: string;
  checks: GlobalSeoHealthCheck[];
  dimensionScores: Record<GlobalSeoHealthDimension, number>;
  effectiveSources: GlobalSeoEffectiveSourceSnapshot[];
  sitemap: SitemapMonitorSnapshot;
};
