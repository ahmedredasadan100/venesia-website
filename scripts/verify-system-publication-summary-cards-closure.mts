import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION } from "../src/lib/admin/interaction-system/adoption-manifest.ts";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) =>
  readFileSync(resolve(root, path), "utf8").replace(/\r\n?/g, "\n");

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

function functionSection(source: string, functionName: string) {
  const start = source.indexOf(`async function ${functionName}`);
  if (start < 0) return "";
  const tail = source.slice(start);
  const nextFunction = tail.indexOf("\n  function ", 1);
  const nextReturn = tail.indexOf("\n\n  return (", 1);
  const ends = [nextFunction, nextReturn].filter((value) => value > 0);
  return tail.slice(0, ends.length ? Math.min(...ends) : undefined);
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
const statusRenderer = read("src/components/admin/ui/AdminDataGridRowActions.tsx");
const dataGrid = read("src/components/admin/ui/AdminDataGrid.tsx");
const instantMutation = read("src/lib/admin/entity-list/data-engine/instant-mutation.ts");

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

const inlineStatus =
  ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION.inlineStatusExtension;
const expectedInlineStatusEntities = [...statusTables, "projects"];

check(
  "Shared Status Icon extension retains the existing architecture owners and contracts",
  inlineStatus.owner === "shared_capabilities" &&
    inlineStatus.runtime === "data_runtime" &&
    inlineStatus.capability === "shared_admin_row_actions" &&
    inlineStatus.adapter === "existing_domain_action_callbacks" &&
    inlineStatus.inputContract === "AdminRowActionsCapability" &&
    inlineStatus.outputContract ===
      "inline_visibility_and_featured_action_state" &&
    inlineStatus.sourceOfTruth === "domain_publication_and_featured_fields",
);
check(
  "Shared Status Icon extension maps Eye, Eye-Off, filled Star, and outline Star at the existing renderer",
  inlineStatus.icons.published === "eye" &&
    inlineStatus.icons.unpublished === "eye_off" &&
    inlineStatus.icons.featured === "star_filled" &&
    inlineStatus.icons.notFeatured === "star_outline" &&
    statusRenderer.includes('display?: "menu" | "visibility" | "featured"') &&
    statusRenderer.includes('action={isVisibility ? "visibility" : "feature"}') &&
    statusRenderer.includes('size="inline"') &&
    dataGrid.includes('if (action === "visibility")') &&
    dataGrid.includes('if (action === "feature")') &&
    dataGrid.includes('fill={active ? "currentColor" : "none"}'),
);
check(
  "Shared Status Icon adoption covers every binary publication table and only the two real Featured consumers",
  inlineStatus.consumers.length === expectedInlineStatusEntities.length &&
    expectedInlineStatusEntities.every((entity) =>
      inlineStatus.consumers.some((entry) => entry.entity === entity),
    ) &&
    new Set(inlineStatus.consumers.map((entry) => entry.entity)).size ===
      inlineStatus.consumers.length &&
    inlineStatus.consumers
      .filter((entry) => "featuredField" in entry && entry.featuredField)
      .map((entry) => entry.entity)
      .sort()
      .join(",") === "projects,topics",
);
check(
  "every declared Shared Status Icon consumer adopts the same inline output contract",
  inlineStatus.consumers.every((entry) => {
    const source = read(entry.consumerSourceFile);
    return (
      source.includes('display="visibility"') &&
      (!("featuredField" in entry) ||
        !entry.featuredField ||
        source.includes('display="featured"'))
    );
  }),
);
check(
  "bounded Page Block consumers extend the existing Instant Mutation Runtime without a new adapter",
  inlineStatus.consumers
    .filter((entry) => entry.dataMode === "bounded-client")
    .every((entry) =>
      read(entry.consumerSourceFile).includes(
        "useAdminBoundedClientInstantMutation",
      ),
    ) &&
    instantMutation.includes(
      "export function useAdminBoundedClientInstantMutation",
    ) &&
    instantMutation.includes("useAdminEntityInstantMutation<Row, Metrics>") &&
    !instantMutation.includes("router.refresh"),
);

const specializedStatusConsumers = [
  "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
  "src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx",
  "src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx",
  "src/app/admin/pages-blocks/blocks/BlockTemplateSummaryListClient.tsx",
].map(read);
check(
  "specialized publication columns removed local pills and keep status mutations instant",
  specializedStatusConsumers.every(
    (source) =>
      !source.includes("AdminStatusPill") &&
      functionSection(source, "runVisibilityMutation").includes(
        "instant.mutateAsync",
      ) &&
      functionSection(source, "runVisibilityMutation").includes(
        "optimistic:",
      ) &&
      !functionSection(source, "runVisibilityMutation").includes(
        "router.refresh",
      ),
  ),
);
check(
  "Media Hub and Sidebar list toggles stay in their existing domain action owners",
  read("src/app/admin/pages-blocks/blocks/media-hub/actions.ts").includes(
    "export async function toggleMediaHubModuleStatus",
  ) &&
    read("src/app/admin/pages-blocks/blocks/media-sidebar/actions.ts").includes(
      "export async function toggleMediaSidebarModuleStatus",
    ) &&
    read("src/app/admin/pages-blocks/blocks/media-hub/page.tsx").includes(
      "toggleAction={toggleMediaHubModuleStatus}",
    ) &&
    read("src/app/admin/pages-blocks/blocks/media-sidebar/page.tsx").includes(
      "toggleAction={toggleMediaSidebarModuleStatus}",
    ),
);

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
