export const DASHBOARD_CONTRACT_VERSION = "dashboard-truth-v1" as const;
export const DASHBOARD_MIGRATION_VERSION = "20260807120000" as const;

export type DashboardState = "ready" | "partial" | "unavailable";
export type DashboardSourceStatus = "ready" | "warning" | "unavailable";

export type DashboardSource<T> = {
  key: "read_model" | "audit" | "media_diagnostics";
  label: string;
  source: string;
  status: DashboardSourceStatus;
  checkedAt: string;
  message: string;
  data: T | null;
  href?: string;
};

export type DashboardReadModel = {
  contractVersion: typeof DASHBOARD_CONTRACT_VERSION;
  checkedAt: string;
  kpis: {
    topics: {
      total: number;
      published: number;
      unpublished: number;
      featured: number;
    };
    categories: { total: number; published: number; unpublished: number };
    projects: {
      total: number;
      published: number;
      unpublished: number;
    };
    pages: { total: number; published: number; unpublished: number };
    media: { total: number; active: number; issues: number };
  };
  contentHealth: {
    topicsMissingImage: number;
    topicsMissingSeoDescription: number;
    categoriesMissingImage: number;
    staleUnpublished: number;
  };
  recentTopics: Array<{
    id: number;
    title: string;
    contentType: string;
    slug: string;
    status: string | null;
    category: string;
    updatedAt: string;
    publishedAt: string | null;
  }>;
  recentProjects: Array<{
    id: number;
    code: string;
    arabicName: string;
    slug: string;
    publicationStatus: string;
    updatedAt: string;
  }>;
  databaseDiagnostics: {
    source: string;
    migrationVersion: typeof DASHBOARD_MIGRATION_VERSION;
    migrationRegistered: boolean;
    rls: Record<string, boolean>;
    missingIndexes: string[];
    rpcAclServiceOnly: boolean;
    checkedAt: string;
  };
};

export type DashboardActivity = {
  id: number;
  actor: string;
  action: string;
  entity: string;
  timestamp: string;
  outcome: string | null;
};

export type DashboardAuditReadModel = {
  events: DashboardActivity[];
  total: number;
};

export type DashboardMediaDiagnostics = {
  state: "synced" | "uncertain";
  provider: string | null;
  environment: string | null;
  lastUpdatedAt: string | null;
  storageAssetCount: number | null;
  catalogAssetCount: number | null;
  warnings: string[];
};

export type AdminDashboardModel = {
  state: DashboardState;
  checkedAt: string;
  readModel: DashboardSource<DashboardReadModel>;
  audit: DashboardSource<DashboardAuditReadModel>;
  media: DashboardSource<DashboardMediaDiagnostics>;
  cache: {
    status: "ready";
    source: "Next.js force-dynamic request-time rendering";
    checkedAt: string;
    message: string;
  };
};

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid Dashboard read-model object at ${path}`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, path: string): string {
  if (typeof value !== "string" || !value) {
    throw new Error(`Invalid Dashboard read-model text at ${path}`);
  }
  return value;
}

function nullableText(value: unknown, path: string): string | null {
  if (value == null) return null;
  return text(value, path);
}

function count(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid Dashboard read-model count at ${path}`);
  }
  return value;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid Dashboard read-model boolean at ${path}`);
  }
  return value;
}

function rows(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Invalid Dashboard read-model rows at ${path}`);
  return value;
}

function parseRls(value: unknown) {
  const input = record(value, "databaseDiagnostics.rls");
  return Object.fromEntries(
    Object.entries(input).map(([table, enabled]) => [
      table,
      boolean(enabled, `databaseDiagnostics.rls.${table}`),
    ]),
  );
}

export function parseDashboardReadModel(value: unknown): DashboardReadModel {
  const root = record(value, "root");
  if (root.contractVersion !== DASHBOARD_CONTRACT_VERSION) {
    throw new Error("Unsupported Dashboard read-model contract version");
  }

  const kpis = record(root.kpis, "kpis");
  const topics = record(kpis.topics, "kpis.topics");
  const categories = record(kpis.categories, "kpis.categories");
  const projects = record(kpis.projects, "kpis.projects");
  const pages = record(kpis.pages, "kpis.pages");
  const media = record(kpis.media, "kpis.media");
  const health = record(root.contentHealth, "contentHealth");
  const diagnostics = record(root.databaseDiagnostics, "databaseDiagnostics");

  if (diagnostics.migrationVersion !== DASHBOARD_MIGRATION_VERSION) {
    throw new Error("Dashboard migration provenance does not match the contract");
  }

  return {
    contractVersion: DASHBOARD_CONTRACT_VERSION,
    checkedAt: text(root.checkedAt, "checkedAt"),
    kpis: {
      topics: {
        total: count(topics.total, "kpis.topics.total"),
        published: count(topics.published, "kpis.topics.published"),
        unpublished: count(topics.unpublished, "kpis.topics.unpublished"),
        featured: count(topics.featured, "kpis.topics.featured"),
      },
      categories: {
        total: count(categories.total, "kpis.categories.total"),
        published: count(categories.published, "kpis.categories.published"),
        unpublished: count(categories.unpublished, "kpis.categories.unpublished"),
      },
      projects: {
        total: count(projects.total, "kpis.projects.total"),
        published: count(projects.published, "kpis.projects.published"),
        unpublished: count(projects.unpublished, "kpis.projects.unpublished"),
      },
      pages: {
        total: count(pages.total, "kpis.pages.total"),
        published: count(pages.published, "kpis.pages.published"),
        unpublished: count(pages.unpublished, "kpis.pages.unpublished"),
      },
      media: {
        total: count(media.total, "kpis.media.total"),
        active: count(media.active, "kpis.media.active"),
        issues: count(media.issues, "kpis.media.issues"),
      },
    },
    contentHealth: {
      topicsMissingImage: count(health.topicsMissingImage, "contentHealth.topicsMissingImage"),
      topicsMissingSeoDescription: count(
        health.topicsMissingSeoDescription,
        "contentHealth.topicsMissingSeoDescription",
      ),
      categoriesMissingImage: count(
        health.categoriesMissingImage,
        "contentHealth.categoriesMissingImage",
      ),
      staleUnpublished: count(health.staleUnpublished, "contentHealth.staleUnpublished"),
    },
    recentTopics: rows(root.recentTopics, "recentTopics").map((row, index) => {
      const item = record(row, `recentTopics.${index}`);
      return {
        id: count(item.id, `recentTopics.${index}.id`),
        title: text(item.title, `recentTopics.${index}.title`),
        contentType: text(item.content_type, `recentTopics.${index}.content_type`),
        slug: text(item.slug, `recentTopics.${index}.slug`),
        status: nullableText(item.status, `recentTopics.${index}.status`),
        category: text(item.category, `recentTopics.${index}.category`),
        updatedAt: text(item.updated_at, `recentTopics.${index}.updated_at`),
        publishedAt: nullableText(item.published_at, `recentTopics.${index}.published_at`),
      };
    }),
    recentProjects: rows(root.recentProjects, "recentProjects").map((row, index) => {
      const item = record(row, `recentProjects.${index}`);
      return {
        id: count(item.id, `recentProjects.${index}.id`),
        code: text(item.code, `recentProjects.${index}.code`),
        arabicName: text(item.arabic_name, `recentProjects.${index}.arabic_name`),
        slug: text(item.slug, `recentProjects.${index}.slug`),
        publicationStatus: text(
          item.publication_status,
          `recentProjects.${index}.publication_status`,
        ),
        updatedAt: text(item.updated_at, `recentProjects.${index}.updated_at`),
      };
    }),
    databaseDiagnostics: {
      source: text(diagnostics.source, "databaseDiagnostics.source"),
      migrationVersion: DASHBOARD_MIGRATION_VERSION,
      migrationRegistered: boolean(
        diagnostics.migrationRegistered,
        "databaseDiagnostics.migrationRegistered",
      ),
      rls: parseRls(diagnostics.rls),
      missingIndexes: rows(diagnostics.missingIndexes, "databaseDiagnostics.missingIndexes").map(
        (item, index) => text(item, `databaseDiagnostics.missingIndexes.${index}`),
      ),
      rpcAclServiceOnly: boolean(
        diagnostics.rpcAclServiceOnly,
        "databaseDiagnostics.rpcAclServiceOnly",
      ),
      checkedAt: text(diagnostics.checkedAt, "databaseDiagnostics.checkedAt"),
    },
  };
}

export function deriveDashboardState(
  statuses: readonly DashboardSourceStatus[],
): DashboardState {
  if (statuses.length === 0 || statuses.every((status) => status === "unavailable")) {
    return "unavailable";
  }
  return statuses.every((status) => status === "ready") ? "ready" : "partial";
}

export function buildAdminDashboardModel(input: {
  checkedAt: string;
  readModel: DashboardSource<DashboardReadModel>;
  audit: DashboardSource<DashboardAuditReadModel>;
  media: DashboardSource<DashboardMediaDiagnostics>;
}): AdminDashboardModel {
  return {
    state: deriveDashboardState([
      input.readModel.status,
      input.audit.status,
      input.media.status,
    ]),
    checkedAt: input.checkedAt,
    readModel: input.readModel,
    audit: input.audit,
    media: input.media,
    cache: {
      status: "ready",
      source: "Next.js force-dynamic request-time rendering",
      checkedAt: input.checkedAt,
      message:
        "لا توجد نسخة Dashboard مشتركة بين الطلبات؛ كل فتح أوRefresh يعيد قراءة المصادر الحالية، لذلك لا يلزم mutation invalidation موازٍ.",
    },
  };
}
