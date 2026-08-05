import type { GlobalSeoHealthSnapshot } from "../../seo/global-seo-health-types";
import type { AdminAuditReport } from "../audit/audit-report";
import type { ContentReviewReport } from "../content-workflow/content-review-report";
import type {
  DashboardMediaDiagnostics,
  DashboardReadModel,
  DashboardSource,
} from "../dashboard/dashboard-contract";
import type { AnalyticsSnapshot } from "./analytics-contract";

export const REPORTS_CONTRACT_VERSION = "admin-reports-truth-v1" as const;
export const REPORTS_MIGRATION_VERSION = "20260805230000" as const;

export type ReportsState = "ready" | "partial" | "unavailable";
export type ReportsSourceStatus = "ready" | "warning" | "unavailable";

export type ReportsSource<T> = {
  key: "reports_read_model" | "content_review" | "audit_report" | "seo_health";
  label: string;
  source: string;
  status: ReportsSourceStatus;
  checkedAt: string;
  message: string;
  data: T | null;
  href?: string;
};

export type ReportsReadModel = {
  contractVersion: typeof REPORTS_CONTRACT_VERSION;
  checkedAt: string;
  content: {
    missingSeo: number;
    missingImages: number;
    missingImageAlt: number;
    publishedWithMissingSeo: number;
  };
  projects: {
    featured: number;
    missingSeo: number;
    missingImages: number;
    complete: number;
    incomplete: number;
    constructionUpdates: {
      source: "topics.content_type=site_update";
      total: number;
      published: number;
      draft: number;
      unpublished: number;
    };
  };
  seo: {
    missingMetadata: { topics: number; projects: number; pages: number };
    canonicalOverrides: number;
    indexability: { indexablePublished: number; noindexPublished: number };
  };
  media: {
    storage: { knownBytes: string; unknownByteSize: number };
    brokenReferences: number;
    missingObjects: number;
    missingAlt: number;
    missingVideoUrls: number;
  };
  publishing: {
    recentPublishing: { windowDays: 30; topics: number; projects: number };
    pendingPublishing: { topics: number; projects: number };
    drafts: { topics: number; projects: number; pages: number };
  };
  sourcesOfTruth: string[];
  databaseDiagnostics: {
    source: string;
    migrationVersion: typeof REPORTS_MIGRATION_VERSION;
    migrationRegistered: boolean;
    dashboardReadModelAvailable: boolean;
    rls: Record<string, boolean>;
    missingIndexes: string[];
    rpcAclServiceOnly: boolean;
    checkedAt: string;
  };
};

export type AdminReportsModel = {
  state: ReportsState;
  checkedAt: string;
  dashboard: DashboardSource<DashboardReadModel>;
  reports: ReportsSource<ReportsReadModel>;
  contentReview: ReportsSource<ContentReviewReport>;
  audit: ReportsSource<AdminAuditReport>;
  seo: ReportsSource<GlobalSeoHealthSnapshot>;
  media: DashboardSource<DashboardMediaDiagnostics>;
  analytics: AnalyticsSnapshot;
  cache: {
    status: "ready";
    source: "Next.js force-dynamic request-time rendering";
    checkedAt: string;
    message: string;
  };
};

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid Reports read-model object at ${path}`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, path: string): string {
  if (typeof value !== "string" || !value) {
    throw new Error(`Invalid Reports read-model text at ${path}`);
  }
  return value;
}

function count(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid Reports read-model count at ${path}`);
  }
  return value;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid Reports read-model boolean at ${path}`);
  }
  return value;
}

function rows(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Invalid Reports read-model rows at ${path}`);
  return value;
}

function countGroup(value: unknown, path: string, keys: readonly string[]) {
  const input = record(value, path);
  return Object.fromEntries(keys.map((key) => [key, count(input[key], `${path}.${key}`)]));
}

export function parseReportsReadModel(value: unknown): ReportsReadModel {
  const root = record(value, "root");
  if (root.contractVersion !== REPORTS_CONTRACT_VERSION) {
    throw new Error("Unsupported Reports read-model contract version");
  }
  const content = record(root.content, "content");
  const projects = record(root.projects, "projects");
  const construction = record(projects.constructionUpdates, "projects.constructionUpdates");
  const seo = record(root.seo, "seo");
  const missingMetadata = countGroup(seo.missingMetadata, "seo.missingMetadata", ["topics", "projects", "pages"]);
  const indexability = countGroup(seo.indexability, "seo.indexability", ["indexablePublished", "noindexPublished"]);
  const media = record(root.media, "media");
  const storage = record(media.storage, "media.storage");
  const publishing = record(root.publishing, "publishing");
  const recentPublishing = record(publishing.recentPublishing, "publishing.recentPublishing");
  const pendingPublishing = countGroup(publishing.pendingPublishing, "publishing.pendingPublishing", ["topics", "projects"]);
  const drafts = countGroup(publishing.drafts, "publishing.drafts", ["topics", "projects", "pages"]);
  const diagnostics = record(root.databaseDiagnostics, "databaseDiagnostics");
  if (diagnostics.migrationVersion !== REPORTS_MIGRATION_VERSION) {
    throw new Error("Reports migration provenance does not match the contract");
  }
  const rlsInput = record(diagnostics.rls, "databaseDiagnostics.rls");
  const knownBytes = String(storage.knownBytes);
  if (!/^\d+$/.test(knownBytes)) {
    throw new Error("Invalid Reports read-model byte count at media.storage.knownBytes");
  }
  if (construction.source !== "topics.content_type=site_update") {
    throw new Error("Unsupported construction updates source");
  }
  if (recentPublishing.windowDays !== 30) {
    throw new Error("Unsupported recent publishing window");
  }

  return {
    contractVersion: REPORTS_CONTRACT_VERSION,
    checkedAt: text(root.checkedAt, "checkedAt"),
    content: {
      missingSeo: count(content.missingSeo, "content.missingSeo"),
      missingImages: count(content.missingImages, "content.missingImages"),
      missingImageAlt: count(content.missingImageAlt, "content.missingImageAlt"),
      publishedWithMissingSeo: count(content.publishedWithMissingSeo, "content.publishedWithMissingSeo"),
    },
    projects: {
      featured: count(projects.featured, "projects.featured"),
      missingSeo: count(projects.missingSeo, "projects.missingSeo"),
      missingImages: count(projects.missingImages, "projects.missingImages"),
      complete: count(projects.complete, "projects.complete"),
      incomplete: count(projects.incomplete, "projects.incomplete"),
      constructionUpdates: {
        source: "topics.content_type=site_update",
        total: count(construction.total, "projects.constructionUpdates.total"),
        published: count(construction.published, "projects.constructionUpdates.published"),
        draft: count(construction.draft, "projects.constructionUpdates.draft"),
        unpublished: count(construction.unpublished, "projects.constructionUpdates.unpublished"),
      },
    },
    seo: {
      missingMetadata: missingMetadata as ReportsReadModel["seo"]["missingMetadata"],
      canonicalOverrides: count(seo.canonicalOverrides, "seo.canonicalOverrides"),
      indexability: indexability as ReportsReadModel["seo"]["indexability"],
    },
    media: {
      storage: {
        knownBytes,
        unknownByteSize: count(storage.unknownByteSize, "media.storage.unknownByteSize"),
      },
      brokenReferences: count(media.brokenReferences, "media.brokenReferences"),
      missingObjects: count(media.missingObjects, "media.missingObjects"),
      missingAlt: count(media.missingAlt, "media.missingAlt"),
      missingVideoUrls: count(media.missingVideoUrls, "media.missingVideoUrls"),
    },
    publishing: {
      recentPublishing: {
        windowDays: 30,
        topics: count(recentPublishing.topics, "publishing.recentPublishing.topics"),
        projects: count(recentPublishing.projects, "publishing.recentPublishing.projects"),
      },
      pendingPublishing: pendingPublishing as ReportsReadModel["publishing"]["pendingPublishing"],
      drafts: drafts as ReportsReadModel["publishing"]["drafts"],
    },
    sourcesOfTruth: rows(root.sourcesOfTruth, "sourcesOfTruth")
      .map((item, index) => text(item, `sourcesOfTruth.${index}`)),
    databaseDiagnostics: {
      source: text(diagnostics.source, "databaseDiagnostics.source"),
      migrationVersion: REPORTS_MIGRATION_VERSION,
      migrationRegistered: boolean(diagnostics.migrationRegistered, "databaseDiagnostics.migrationRegistered"),
      dashboardReadModelAvailable: boolean(diagnostics.dashboardReadModelAvailable, "databaseDiagnostics.dashboardReadModelAvailable"),
      rls: Object.fromEntries(
        Object.entries(rlsInput).map(([table, enabled]) => [
          table,
          boolean(enabled, `databaseDiagnostics.rls.${table}`),
        ]),
      ),
      missingIndexes: rows(diagnostics.missingIndexes, "databaseDiagnostics.missingIndexes")
        .map((item, index) => text(item, `databaseDiagnostics.missingIndexes.${index}`)),
      rpcAclServiceOnly: boolean(diagnostics.rpcAclServiceOnly, "databaseDiagnostics.rpcAclServiceOnly"),
      checkedAt: text(diagnostics.checkedAt, "databaseDiagnostics.checkedAt"),
    },
  };
}

export function deriveReportsState(
  statuses: readonly ReportsSourceStatus[],
): ReportsState {
  if (statuses.length === 0 || statuses.every((status) => status === "unavailable")) {
    return "unavailable";
  }
  return statuses.every((status) => status === "ready") ? "ready" : "partial";
}
