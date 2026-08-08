import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) =>
  readFileSync(resolve(root, path), "utf8").replace(/\r\n?/g, "\n");

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

const migration = read("sql/migrations/20260807120000_system_publication_summary_cards_closure.sql");
const metricCard = read("src/components/admin/ui/AdminMetricCard.tsx");
const metricGrid = read("src/components/admin/ui/AdminMetricCardsGrid.tsx");
const topics = read("src/components/admin/content/TopicsListClient.tsx");
const topicContract = read("src/lib/admin/content/entity-list-contracts/topics.ts");
const topicLoader = read("src/lib/admin/content/load-unified-content.ts");
const categories = read("src/app/admin/content/categories/CategoriesListClient.tsx");
const series = read("src/app/admin/content/series/SeriesTableClient.tsx");
const projectCapability = read("src/lib/admin/projects/project-publishing-capability.ts");
const projectEntryContract = read("src/lib/admin/projects/project-entry-contract.ts");
const pageStatus = read("src/app/admin/pages-blocks/pages/page-actions/page-status.ts");
const moduleStatus = read("src/lib/page-blocks/admin-utils.ts");
const heroLoader = read("src/lib/load-hero-section.ts");
const assignmentLoader = read("src/lib/page-blocks/admin-queries.ts");
const pagination = read("src/components/admin/ui/AdminTablePagination.tsx");
const pagesConfig = read("src/lib/admin/pages/pages-list-config.ts");

const binaryRuntimeSources = [
  read("src/lib/admin/content/content-status-metadata.ts"),
  read("src/lib/content-public-visibility.ts"),
  topicContract,
  read("src/lib/admin/content/entity-list-contracts/categories.ts"),
  read("src/lib/admin/content/entity-list-contracts/series.ts"),
  projectCapability,
  read("src/lib/admin/projects/entity-list-contract.ts"),
  pageStatus,
  moduleStatus,
  read("src/lib/page-blocks/types.ts"),
];

check(
  "publication runtime exposes only published and unpublished",
  binaryRuntimeSources.every((source) => !/"(?:draft|archived)"/.test(source)) &&
    binaryRuntimeSources.every((source) => source.includes("published") && source.includes("unpublished")),
);

const statusTables = [
  "topics",
  "pages",
  "topic_categories",
  "topic_series",
  "content_block_templates",
  "breadcrumb_block_templates",
  "cards_block_templates",
  "cta_block_templates",
  "feed_module_templates",
  "media_hub_module_templates",
  "media_sidebar_module_templates",
  "hero_templates",
] as const;

check(
  "migration maps every status table and installs binary constraints",
  statusTables.every((table) =>
    migration.includes(`alter table public.${table} add constraint ${table}_status_check check (status in ('published', 'unpublished'))`),
  ) &&
    migration.includes("set publication_status = 'unpublished'") &&
    migration.includes("projects_publication_status_check check (publication_status in ('published', 'unpublished'))"),
);
check(
  "migration is guarded, transactional, and retains shared database owners",
  migration.trimStart().startsWith("-- System Publication") &&
    migration.includes("begin;") &&
    migration.trimEnd().endsWith("commit;") &&
    migration.includes("pg_get_functiondef") &&
    migration.includes("publication rewrite drifted") &&
    !/drop\s+table|truncate\s+table|drop\s+column/i.test(migration.replace(/--[^\n]*/g, "")),
);

check(
  "Hero publication status is canonical while assignment visibility stays independent",
  heroLoader.includes('template.status === "published"') &&
    assignmentLoader.includes('normalizeBoolean(row.is_active, true) && template.status === "published"') &&
    migration.includes("sync_hero_template_publication_compatibility") &&
    migration.includes("before insert or update of status, is_visible on public.hero_templates"),
);

check(
  "shared metric card owns bold typography, dashboard glow, and actionable state",
  metricCard.includes("onClick?: () => void") &&
    metricCard.includes('const Component = onClick ? "button" : "div"') &&
    metricCard.includes('"aria-pressed": active') &&
    (metricCard.match(/font-bold/g) ?? []).length >= 2 &&
    metricCard.includes("hoverGlow") &&
    metricCard.includes("radial-gradient") &&
    metricGrid.includes("AdminMetricCard"),
);

const topicLabels = [
  "إجمالي الموضوعات",
  "منشور",
  "غير منشور",
  "بدون صورة",
  "مرتبطة بسلسلة",
  "مميزة",
  "متوسط SEO",
];
check(
  "Topics exposes the exact real summary set and delegates actionable cards to Shared Collection Filters",
  topicLabels.every((label) => topics.includes(`label: "${label}"`)) &&
    topics.includes('controller.setFilter("status", "published")') &&
    topics.includes('controller.setFilter("status", "unpublished")') &&
    topics.includes('controller.setFilter("image", "without")') &&
    topics.includes('controller.setFilter("seriesId", "any")') &&
    topics.includes('controller.setFilter("featured", "yes")') &&
    topics.includes('resetToView("active")') &&
    !/label: "متوسط SEO"[^\n]+onClick/.test(topics) &&
    topicContract.includes('image: "all" | "without"') &&
    topicContract.includes('seriesId: number | "any" | null'),
);
check(
  "Topics metrics come from the real filtered read model",
  ["withoutImage", "withSeries", "featured", "seoAverage"].every((metric) => topicLoader.includes(metric)) &&
    topicLoader.includes('.or("image.is.null,image.eq.")') &&
    topicLoader.includes('.not("series_id", "is", null)'),
);

check(
  "Categories exposes total/category-topic-series and binary status cards without featured",
  ["إجمالي التصنيفات", "إجمالي الموضوعات", "إجمالي السلاسل", "منشور", "غير منشور"].every((label) =>
    categories.includes(`label: "${label}"`),
  ) &&
    categories.includes('controller.setFilter("status", "published")') &&
    categories.includes('controller.setFilter("status", "unpublished")') &&
    !categories.includes('label: "مميزة"'),
);
check(
  "Series exposes total/topics/average and binary status cards without featured",
  ["إجمالي السلاسل", "إجمالي الموضوعات", "متوسط الموضوعات لكل سلسلة", "منشور", "غير منشور"].every((label) =>
    series.includes(`label: "${label}"`),
  ) &&
    series.includes('controller.setFilter("status", "published")') &&
    series.includes('controller.setFilter("status", "unpublished")') &&
    !series.includes('label: "مميزة"'),
);
check(
  "Featured remains a real capability only for Topics and Projects",
  topicLoader.includes("is_featured") &&
    projectEntryContract.includes("featured: boolean") &&
    !categories.includes("featured") &&
    !series.includes("featured"),
);

const countChromeSources = [
  read("src/components/admin/page-blocks/BlockModuleManagerClient.tsx"),
  read("src/app/admin/pages-blocks/blocks/BlockTemplateSummaryListClient.tsx"),
  read("src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx"),
  read("src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx"),
  read("src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentsGrid.tsx"),
];
check(
  "standalone Page Block and Hero count chrome is removed while pagination counts remain allowed",
  countChromeSources.every((source) => !source.includes("AdminMetricCardsGrid")) &&
    !pagesConfig.includes('"modules"') &&
    !pagesConfig.includes("block_count"),
);
check(
  "shared pagination hides at ten or fewer and owns the only visible total range",
  pagination.includes("totalCount > currentPageSize || totalPages > 1") &&
    pagination.includes("if (!shouldShowFooter) return null") &&
    pagination.includes("rangeStart") &&
    pagination.includes("rangeEnd") &&
    pagination.includes("totalCount"),
);

console.log(`verify-system-publication-summary-cards-closure passed (${passed} checks).`);
