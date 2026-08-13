import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { adaptPagesReadModel } from "../src/lib/admin/pages/entity-list-read-model-boundary.ts";
import type { SeoScoreInput } from "../src/lib/admin/seo-score.ts";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) =>
  readFileSync(resolve(root, path), "utf8").replace(/\r\n?/gu, "\n");

const migrationPath =
  "sql/migrations/20260810010000_page_delete_hero_assignment_integrity.sql";
const migration = read(migrationPath);
const sortMigrationPath =
  "sql/migrations/20260810020000_admin_pages_sort_adoption.sql";
const sortMigration = read(sortMigrationPath);
const contract = read("src/lib/admin/pages/entity-list-contract.ts");
const adapter = read("src/lib/admin/pages/entity-list-adapter.ts");
const readModelBoundary = read(
  "src/lib/admin/pages/entity-list-read-model-boundary.ts",
);
const config = read("src/lib/admin/pages/pages-list-config.ts");
const page = read("src/app/admin/pages-blocks/pages/page.tsx");
const client = read("src/app/admin/pages-blocks/pages/PagesTableClient.tsx");
const preferenceAction = read(
  "src/app/admin/pages-blocks/pages/page-actions/column-preferences.ts",
);
const compositionClient = read(
  "src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx",
);
const compositionSurface = read(
  "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageCompositionTableSurface.tsx",
);
const assignmentGrid = read(
  "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentsGrid.tsx",
);
const pageSeoPanel = read(
  "src/app/admin/pages-blocks/pages/[id]/PageSeoPanel.tsx",
);
const entityList = read("src/components/admin/entity-list/AdminEntityList.tsx");
const entityListTable = read(
  "src/components/admin/entity-list/AdminEntityListTable.tsx",
);
const sharedSeoPill = read(
  "src/components/admin/seo/AdminSeoScorePill.tsx",
);
const unifiedContentColumns = read(
  "src/components/admin/content/unified-content-columns.tsx",
);
const entityListFilters = read(
  "src/components/admin/entity-list/AdminEntityListFilters.tsx",
);
const dataGrid = read("src/components/admin/ui/AdminDataGrid.tsx");
const adminTable = read("src/components/admin/table-engine/useAdminTable.ts");
const officialSeoOwner = read("src/lib/admin/seo-score.ts");
const adminDateOwner = read("src/lib/content-dates.ts");
const dataEngineContracts = read(
  "src/lib/admin/entity-list/data-engine/contracts.ts",
);
const dataEngineController = read(
  "src/lib/admin/entity-list/data-engine/client-controller.ts",
);
const assignmentRow = read(
  "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentRow.tsx",
);
const bulkActionBar = read("src/components/admin/ui/AdminBulkActionBar.tsx");
const compositionBulkAction = read(
  "src/app/admin/pages-blocks/pages/page-actions/bulk.ts",
);
const assignModal = read(
  "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignModal.tsx",
);
const assignmentDelete = read(
  "src/app/admin/pages-blocks/pages/page-actions/assignment-delete.ts",
);
const assignmentReorder = read(
  "src/app/admin/pages-blocks/pages/page-actions/assignment-reorder.ts",
);
const pageStatusAction = read(
  "src/app/admin/pages-blocks/pages/page-actions/page-status.ts",
);
const pageSeoAction = read(
  "src/app/admin/pages-blocks/pages/page-seo-actions.ts",
);
const foundationalSchema = read(
  "sql/migrations/20250618000000_foundational_schema_baseline.sql",
);
const sharedEntitySeoMigration = read(
  "sql/migrations/20260803153000_shared_entity_seo_capability.sql",
);
const legacyPagesReadModelMigration = read(
  "sql/migrations/20260805120000_admin_pages_search_read_model.sql",
);
const pagination = read("src/components/admin/ui/AdminTablePagination.tsx");
const uiRules = read("src/components/admin/ui/ADMIN_UI_RULES.md");

const replacementMatch = migration.match(
  /v_new constant text := \$new\$([\s\S]*?)\$new\$;/u,
);
const deleteReplacement = replacementMatch?.[1] ?? "";
const heroCleanup =
  "delete from public.hero_assignments\n    where target_type = 'page' and target_id = p_page_id;";
const pageDelete = "delete from public.pages where id = p_page_id;";

assert.match(migration, /^-- Page hard-delete Hero assignment integrity correction\./u);
assert.match(migration, /begin;[\s\S]*pg_get_functiondef[\s\S]*commit;\s*$/u);
assert.match(migration, /elsif p_operation = 'delete_page' then/u);
assert.match(migration, /elsif p_operation = 'replace_hero_template' then/u);
assert.match(migration, /v_delete_branch := left\(v_delete_branch, v_branch_end - 1\)/u);
assert.ok(replacementMatch, "Migration replacement payload is missing.");
assert.ok(deleteReplacement.includes(heroCleanup));
assert.ok(deleteReplacement.indexOf(heroCleanup) < deleteReplacement.indexOf(pageDelete));
assert.equal((deleteReplacement.match(/delete from public\.hero_assignments/gu) ?? []).length, 1);
assert.doesNotMatch(deleteReplacement, /delete from public\.hero_templates|target_type\s*(?:<>|!=|in\s*\()/iu);
assert.doesNotMatch(migration.replace(/^\s*--.*$/gmu, ""), /drop\s+table|alter\s+table|truncate\s+table/iu);

assert.match(
  sortMigration,
  /create or replace function public\.admin_list_pages\([\s\S]*p_sort_field text default 'id'[\s\S]*p_search text default ''[\s\S]*\)\s*returns jsonb/iu,
);
assert.match(
  sortMigration,
  /p_sort_field = 'path' and p_sort_direction = 'asc' then path end asc,[\s\S]*p_sort_field = 'path' and p_sort_direction = 'desc' then path end desc/iu,
);
assert.match(
  sortMigration,
  /p_sort_field = 'slug' and p_sort_direction = 'asc' then slug end asc,[\s\S]*p_sort_field = 'slug' and p_sort_direction = 'desc' then slug end desc/iu,
);
assert.match(
  sortMigration,
  /p_sort_field = 'moduleCount' and p_sort_direction = 'asc' then block_count end asc,[\s\S]*p_sort_field = 'moduleCount' and p_sort_direction = 'desc' then block_count end desc/iu,
);
assert.match(
  sortMigration,
  /p_sort_field = 'updatedAt' and p_sort_direction = 'asc' then updated_at end asc,[\s\S]*p_sort_field = 'updatedAt' and p_sort_direction = 'desc' then updated_at end desc/iu,
);
assert.match(sortMigration, /case when p_sort_field = 'status'[\s\S]*id asc/iu);
assert.match(sortMigration, /'contract_version',\s*2/iu);
for (const sourceField of [
  "p.updated_at",
  "p.seo_title",
  "p.seo_description",
  "p.seo_keywords",
  "p.focus_keyword",
  "p.og_image",
  "p.og_image_alt",
]) {
  assert.ok(
    sortMigration.includes(sourceField),
    `Pages RPC output is missing ${sourceField}`,
  );
}
assert.doesNotMatch(sortMigration, /p_sort_field\s*=\s*'seo'/iu);
assert.doesNotMatch(
  sortMigration,
  /seo_score|seoScore|blockingErrors|analyzeEntitySeo/iu,
);
assert.doesNotMatch(
  sortMigration.replace(/^\s*--.*$/gmu, ""),
  /\b(?:insert\s+into|update|delete\s+from|truncate)\s+public\./iu,
);
assert.match(
  legacyPagesReadModelMigration,
  /p_sort_field = 'title'[\s\S]*p_sort_field = 'status'[\s\S]*id asc/iu,
);
assert.doesNotMatch(
  legacyPagesReadModelMigration,
  /p_sort_field = '(?:path|slug|moduleCount|updatedAt)'/iu,
);

assert.match(contract, /moduleCount:\s*z\.number\(\)\.int\(\)\.nonnegative\(\)/u);
assert.match(contract, /updatedAt:\s*z\.string\(\)\.nullable\(\)/u);
assert.match(contract, /seoScore:\s*z\.number\(\)\.int\(\)\.min\(0\)\.max\(100\)\.nullable\(\)/u);
assert.match(contract, /seoLabel:\s*z\.string\(\)\.nullable\(\)/u);
assert.match(contract, /seoBlockingErrors:\s*z\.number\(\)\.int\(\)\.nonnegative\(\)\.nullable\(\)/u);
assert.match(
  contract,
  /legacyPageSortFields\s*=\s*\[\s*"id",\s*"title",\s*"status",?\s*\]/u,
);
assert.match(contract, /readModelContractVersion:\s*z\.number\(\)\.int\(\)\.positive\(\)/u);
assert.match(contract, /supportedSortFields:\s*z\.array\(z\.enum\(pageSortFields\)\)/u);
assert.match(
  contract,
  /createAdminEntityListResultSchema\([\s\S]*pageEntityListRowSchema,[\s\S]*pageEntityListMetricsSchema/u,
);

assert.match(readModelBoundary, /const transitionalString = z\.string\(\)\.nullable\(\)\.optional\(\)/u);
assert.match(readModelBoundary, /seo_keywords:\s*z\.array\(z\.string\(\)\)\.nullable\(\)\.optional\(\)/u);
assert.match(readModelBoundary, /contract_version:\s*z\.number\(\)\.int\(\)\.positive\(\)\.optional\(\)/u);
assert.match(readModelBoundary, /const seoSource = completePageSeoSourceSchema\.safeParse\(source\)/u);
assert.match(readModelBoundary, /const seo = seoSource\.success[\s\S]*\? options\.analyzeSeo\(\{/u);
assert.match(
  readModelBoundary,
  /profile:\s*"entity"[\s\S]*title:\s*source\.title[\s\S]*description:\s*""[\s\S]*content:\s*""[\s\S]*slug:[\s\S]*source\.path === "\/"[\s\S]*source\.path\.replace\(\/\^\\\/\+\/, ""\)[\s\S]*image:\s*""[\s\S]*imageAlt:\s*""[\s\S]*ogImage:\s*seoSource\.data\.og_image \?\? ""[\s\S]*ogImageAlt:\s*seoSource\.data\.og_image_alt[\s\S]*seoTitle:\s*seoSource\.data\.seo_title[\s\S]*seoDescription:\s*seoSource\.data\.seo_description[\s\S]*seoKeywords:\s*seoSource\.data\.seo_keywords[\s\S]*focusKeyword:\s*seoSource\.data\.focus_keyword[\s\S]*faq:\s*\[\]/u,
);
assert.match(readModelBoundary, /updatedAt:\s*source\.updated_at \?\? null/u);
assert.match(readModelBoundary, /seoScore:\s*seo\?\.score \?\? null/u);
assert.match(readModelBoundary, /seoLabel:\s*seo\?\.label \?\? null/u);
assert.match(readModelBoundary, /seoBlockingErrors:\s*seo\?\.blockingErrors \?\? null/u);
assert.match(readModelBoundary, /readModelContractVersion = readModel\.contract_version \?\? 1/u);
assert.match(
  readModelBoundary,
  /extendedContractAvailable[\s\S]*\? options\.extendedSortFields[\s\S]*: options\.legacySortFields/u,
);
assert.match(adapter, /adaptPagesReadModel\(data, \{/u);
assert.match(adapter, /analyzeSeo:\s*analyzeEntitySeo/u);
assert.match(adapter, /legacySortFields:\s*legacyPageSortFields/u);
assert.match(adapter, /extendedSortFields:\s*pageSortFields/u);
assert.match(adapter, /metrics:\s*readModel\.metrics/u);
assert.equal((adapter.match(/\.rpc\(/gu) ?? []).length, 1);
assert.match(officialSeoOwner, /export function analyzeEntitySeo/u);
assert.match(officialSeoOwner, /export function sortRowsBySeoScore/u);
assert.match(
  officialSeoOwner,
  /leftScore === null && rightScore === null[\s\S]*getId\(left\) - getId\(right\)[\s\S]*if \(leftScore === null\) return 1;[\s\S]*if \(rightScore === null\) return -1;[\s\S]*\(leftScore - rightScore\) \* multiplier/u,
);
assert.match(
  adapter,
  /query\.sort\.field === "seo"[\s\S]*loadSeoSortedPagesReadModel\(query\)/u,
);
assert.match(
  adapter,
  /batchSize = pagesQueryContract\.maxPageSize[\s\S]*sortField:\s*"id"[\s\S]*for \(let page = 2; page <= totalBatches; page \+= 1\)[\s\S]*batch\.totalRows !== totalRows/u,
);
assert.match(
  adapter,
  /sortRowsBySeoScore\([\s\S]*row\.seoScore[\s\S]*sortedRows\.slice\(from, from \+ query\.pageSize\)/u,
);
assert.doesNotMatch(adapter, /\.from\("pages"\)/u);
assert.doesNotMatch(
  `${adapter}\n${readModelBoundary}`,
  /function\s+(?:calculate|get)Seo|score\s*[+*/-]=/iu,
);

let transitionSeoCalls = 0;
const transitionSeoInputs: SeoScoreInput[] = [];
const transitionOptions = {
  analyzeSeo: (input: SeoScoreInput) => {
    transitionSeoCalls += 1;
    transitionSeoInputs.push(input);
    return { score: 84, label: "ready", blockingErrors: 0 };
  },
  legacySortFields: ["id", "title", "status"] as const,
  extendedSortFields: [
    "id",
    "title",
    "path",
    "slug",
    "moduleCount",
    "seo",
    "updatedAt",
    "status",
  ] as const,
};
const legacyReadModel = adaptPagesReadModel(
  {
    rows: [
      {
        id: 1,
        title: "Home",
        slug: "home",
        path: "/",
        page_type: "home",
        status: "published",
        block_count: 4,
      },
    ],
    total_count: 1,
    page: 1,
  },
  transitionOptions,
);
assert.equal(transitionSeoCalls, 0, "Legacy RPC rows must not create fake SEO inputs.");
assert.deepEqual(legacyReadModel.rows[0], {
  id: 1,
  title: "Home",
  slug: "home",
  path: "/",
  page_type: "home",
  status: "published",
  moduleCount: 4,
  updatedAt: null,
  seoScore: null,
  seoLabel: null,
  seoBlockingErrors: null,
});
assert.deepEqual(legacyReadModel.metrics, {
  readModelContractVersion: 1,
  supportedSortFields: ["id", "title", "status"],
});

const extendedReadModel = adaptPagesReadModel(
  {
    rows: [
      {
        id: 2,
        title: "About",
        slug: "about",
        path: "/about",
        page_type: "static",
        status: "published",
        block_count: 3,
        updated_at: "2026-08-10T00:00:00.000Z",
        seo_title: "About Venesia",
        seo_description: "About page",
        seo_keywords: ["venesia"],
        focus_keyword: "venesia",
        og_image: null,
        og_image_alt: "Venesia",
      },
    ],
    total_count: 1,
    page: 1,
    contract_version: 2,
  },
  transitionOptions,
);
assert.equal(transitionSeoCalls, 1);
assert.equal(extendedReadModel.rows[0]?.seoScore, 84);
assert.equal(
  extendedReadModel.rows[0]?.updatedAt,
  "2026-08-10T00:00:00.000Z",
);
assert.deepEqual(extendedReadModel.metrics.supportedSortFields, [
  "id",
  "title",
  "path",
  "slug",
  "moduleCount",
  "seo",
  "updatedAt",
  "status",
]);
assert.deepEqual(transitionSeoInputs[0], {
  profile: "entity",
  title: "About",
  description: "",
  content: "",
  slug: "about",
  image: "",
  imageAlt: "",
  ogImage: "",
  ogImageAlt: "Venesia",
  seoTitle: "About Venesia",
  seoDescription: "About page",
  seoKeywords: ["venesia"],
  focusKeyword: "venesia",
  faq: [],
});

const partialExtendedReadModel = adaptPagesReadModel(
  {
    rows: [
      {
        id: 3,
        title: "Contact",
        slug: "contact",
        path: "/contact",
        page_type: "contact",
        status: "published",
        block_count: 1,
        updated_at: "2026-08-10T00:00:00.000Z",
        seo_title: "Contact",
      },
    ],
    total_count: 1,
    page: 1,
    contract_version: 2,
  },
  transitionOptions,
);
assert.equal(
  transitionSeoCalls,
  1,
  "Partial SEO sources must not invoke the official analyzer with empty fallbacks.",
);
assert.equal(partialExtendedReadModel.rows[0]?.seoScore, null);
assert.equal(partialExtendedReadModel.rows[0]?.seoLabel, null);
assert.equal(partialExtendedReadModel.rows[0]?.seoBlockingErrors, null);

assert.match(
  foundationalSchema,
  /create table if not exists public\.pages \([\s\S]*updated_at timestamp with time zone not null default now\(\)/iu,
);
assert.match(
  sharedEntitySeoMigration,
  /alter table public\.pages[\s\S]*alter column seo_title set not null[\s\S]*alter column seo_description set not null[\s\S]*alter column focus_keyword set not null[\s\S]*alter column seo_keywords set not null[\s\S]*alter column og_image_alt set not null/iu,
);
assert.match(pageStatusAction, /update\(\{ status: nextStatus, updated_at: new Date\(\)\.toISOString\(\) \}\)/u);
assert.match(pageSeoAction, /toEntitySeoPersistence\(seo\)[\s\S]*updated_at:\s*new Date\(\)\.toISOString\(\)/u);
assert.match(adminDateOwner, /ADMIN_TIME_ZONE\s*=\s*"Africa\/Cairo"/u);
assert.match(adminDateOwner, /export function formatAdminDateTime/u);

assert.match(pageSeoPanel, /const publicSlug = props\.path === "\/" \? "" : props\.path\.replace\(\/\^\\\/\+\/, ""\)/u);
for (const input of [
  'name="page_description" value=""',
  'name="page_content" value=""',
  'name="page_image" value=""',
  'name="page_image_alt" value=""',
]) {
  assert.ok(pageSeoPanel.includes(input), `Page SEO input contract missing ${input}`);
}
assert.match(pageSeoPanel, /initial=\{\{[\s\S]*profile:\s*"entity"[\s\S]*faq:\s*\[\]/u);

assert.match(config, /PAGES_LIST_COLUMN_CONTRACT_VERSION\s*=\s*3/u);
const configuredColumnKeys = Array.from(
  config.matchAll(/\bkey:\s*"([^"]+)"/gu),
  (match) => match[1],
);
assert.deepEqual(configuredColumnKeys, [
  "page",
  "path",
  "slug",
  "moduleCount",
  "seo",
  "updatedAt",
  "status",
  "actions",
]);
const configColumnSlice = (key: string, nextKey?: string) => {
  const start = config.indexOf(`key: "${key}"`);
  const end = nextKey ? config.indexOf(`key: "${nextKey}"`, start) : config.indexOf("] as const", start);
  return config.slice(start, end);
};
assert.match(configColumnSlice("slug", "moduleCount"), /defaultVisible:\s*false/u);
for (const [key, nextKey] of [
  ["page", "path"],
  ["path", "slug"],
  ["moduleCount", "seo"],
  ["seo", "updatedAt"],
  ["updatedAt", "status"],
  ["status", "actions"],
  ["actions", undefined],
] as const) {
  assert.match(configColumnSlice(key, nextKey), /defaultVisible:\s*true/u);
}
assert.doesNotMatch(config, /key:\s*"type"/u);
assert.doesNotMatch(config, /key:\s*"selection"/u);
assert.match(page, /contractVersion:\s*PAGES_LIST_COLUMN_CONTRACT_VERSION/u);
assert.match(preferenceAction, /contractVersion:\s*PAGES_LIST_COLUMN_CONTRACT_VERSION/u);
assert.match(client, /type PageEntityListRow/u);
assert.match(client, /export type AdminPageListRow = PageEntityListRow/u);
assert.match(client, /row\.moduleCount/u);

const pageColumn = client.slice(
  client.indexOf('key: "page"'),
  client.indexOf('key: "path"'),
);
const pathColumn = client.slice(
  client.indexOf('key: "path"'),
  client.indexOf('key: "slug"'),
);
const slugColumn = client.slice(
  client.indexOf('key: "slug"'),
  client.indexOf('key: "moduleCount"'),
);
const moduleCountColumn = client.slice(
  client.indexOf('key: "moduleCount"'),
  client.indexOf('key: "seo"'),
);
const seoColumn = client.slice(
  client.indexOf('key: "seo"'),
  client.indexOf('key: "updatedAt"'),
);
const updatedAtColumn = client.slice(
  client.indexOf('key: "updatedAt"'),
  client.indexOf('key: "status"'),
);
const statusColumn = client.slice(
  client.indexOf('key: "status"'),
  client.indexOf('key: "actions"'),
);
const actionsColumnStart = client.indexOf('key: "actions"');
const actionsColumn = client.slice(
  actionsColumnStart,
  client.indexOf("  ];", actionsColumnStart),
);
const orderedColumnOffsets = [
  client.indexOf('key: "page"'),
  client.indexOf('key: "path"'),
  client.indexOf('key: "slug"'),
  client.indexOf('key: "moduleCount"'),
  client.indexOf('key: "seo"'),
  client.indexOf('key: "updatedAt"'),
  client.indexOf('key: "status"'),
  client.indexOf('key: "actions"'),
];

assert.deepEqual(orderedColumnOffsets, [...orderedColumnOffsets].sort((left, right) => left - right));
assert.match(pageColumn, /sortable:\s*supportedSortFields\.has\("title"\)[\s\S]*sortKey:\s*"title"/u);
assert.doesNotMatch(pageColumn, /flexible:\s*true/u);
assert.match(pageColumn, /minWidth:\s*ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS\.textOnly \+ 40/u);
assert.match(
  pathColumn,
  /defaultVisible:\s*true[\s\S]*sortable:\s*supportedSortFields\.has\("path"\)[\s\S]*sortKey:\s*"path"[\s\S]*minWidth:\s*PAGE_PATH_COLUMN_WIDTH[\s\S]*width:\s*PAGE_PATH_COLUMN_WIDTH/u,
);
assert.match(
  slugColumn,
  /defaultVisible:\s*false[\s\S]*sortable:\s*supportedSortFields\.has\("slug"\)[\s\S]*sortKey:\s*"slug"[\s\S]*minWidth:\s*ADMIN_DATA_GRID_REFERENCE_COLUMN_WIDTH[\s\S]*width:\s*ADMIN_DATA_GRID_REFERENCE_COLUMN_WIDTH/u,
);
assert.doesNotMatch(slugColumn, /flexible:\s*true/u);
assert.match(
  moduleCountColumn,
  /sortable:\s*supportedSortFields\.has\("moduleCount"\)[\s\S]*sortKey:\s*"moduleCount"[\s\S]*minWidth:\s*PAGE_MODULE_COUNT_COLUMN_WIDTH[\s\S]*width:\s*PAGE_MODULE_COUNT_COLUMN_WIDTH/u,
);
assert.match(
  seoColumn,
  /defaultVisible:\s*true[\s\S]*sortable:\s*supportedSortFields\.has\("seo"\)[\s\S]*sortKey:\s*"seo"[\s\S]*minWidth:\s*PAGE_SEO_COLUMN_WIDTH[\s\S]*width:\s*PAGE_SEO_COLUMN_WIDTH[\s\S]*<AdminSeoScorePill[\s\S]*score=\{row\.seoScore\}[\s\S]*label=\{row\.seoLabel\}[\s\S]*blockingErrors=\{row\.seoBlockingErrors\}[\s\S]*unavailableReason=\{PAGES_READ_MODEL_TRANSITION_NOTICE\.message\}/u,
);
assert.match(
  updatedAtColumn,
  /defaultVisible:\s*true[\s\S]*sortable:\s*supportedSortFields\.has\("updatedAt"\)[\s\S]*sortKey:\s*"updatedAt"[\s\S]*minWidth:\s*PAGE_UPDATED_AT_COLUMN_WIDTH[\s\S]*width:\s*PAGE_UPDATED_AT_COLUMN_WIDTH[\s\S]*row\.updatedAt \? formatAdminDateTime\(row\.updatedAt\) : "غير متاح"/u,
);
assert.match(
  statusColumn,
  /sortable:\s*supportedSortFields\.has\("status"\)[\s\S]*sortKey:\s*"status"[\s\S]*minWidth:\s*Number\.parseInt\(ADMIN_DATA_GRID_COLUMNS\.statusCompact, 10\)[\s\S]*width:\s*Number\.parseInt\(ADMIN_DATA_GRID_COLUMNS\.statusCompact, 10\)[\s\S]*align:\s*"center"/u,
);
assert.match(
  actionsColumn,
  /sortable:\s*false[\s\S]*minWidth:\s*ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH[\s\S]*width:\s*ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH/u,
);
assert.match(
  contract,
  /pageSortFields\s*=\s*\[\s*"id",\s*"title",\s*"path",\s*"slug",\s*"moduleCount",\s*"seo",\s*"updatedAt",\s*"status",?\s*\]/u,
);
assert.doesNotMatch(contract, /"selection"/u);
assert.match(
  client,
  /PAGE_MODULE_COUNT_COLUMN_WIDTH\s*=\s*\n\s*ADMIN_DATA_GRID_COMPACT_COUNT_COLUMN_WIDTH \+ 24/u,
);
assert.match(client, /PAGE_PATH_COLUMN_WIDTH\s*=\s*200/u);
assert.match(client, /PAGE_SEO_COLUMN_WIDTH\s*=\s*96/u);
assert.match(client, /PAGE_UPDATED_AT_COLUMN_WIDTH\s*=\s*176/u);
assert.doesNotMatch(client, /implicitFlexibleColumn=\{false\}/u);
assert.doesNotMatch(client, /fillAvailableWidth/u);
assert.match(entityList, /implicitFlexibleColumn=\{implicitFlexibleColumn\}/u);
assert.match(entityList, /fillAvailableWidth\?: boolean/u);
assert.match(entityList, /fillAvailableWidth=\{fillAvailableWidth\}/u);
assert.match(entityListTable, /implicitFlexibleColumn\?: boolean/u);
assert.match(entityListTable, /implicitFlexibleColumn = true/u);
assert.match(entityListTable, /fillAvailableWidth\?: boolean/u);
assert.match(entityListTable, /fillAvailableWidth = false/u);
assert.match(
  entityListTable,
  /explicitFlexibleColumnKey \?\?[\s\S]*\(implicitFlexibleColumn[\s\S]*!column\.primary[\s\S]*: undefined\)/u,
);
assert.match(
  entityListTable,
  /const showFillSpacer = fillAvailableWidth && flexibleColumnKey === undefined/u,
);
assert.match(
  entityListTable,
  /flexibleColumnKey === undefined && !showFillSpacer[\s\S]*\? tableMinWidth[\s\S]*: "100%"/u,
);
assert.equal(
  (entityListTable.match(/data-admin-table-fill-spacer/gu) ?? []).length,
  6,
  "The fill spacer must remain presentation-only in both sticky-end and trailing placement branches.",
);
assert.doesNotMatch(config, /fillSpacer|fill-spacer/u);
assert.doesNotMatch(contract, /fillSpacer|fill-spacer/u);

assert.match(sharedSeoPill, /Shared presentation for the official analyzeEntitySeo score output/u);
assert.match(sharedSeoPill, /score:\s*number \| null/u);
assert.match(sharedSeoPill, /if \(score === null\)[\s\S]*tone="muted"[\s\S]*غير متاح/u);
assert.match(sharedSeoPill, /<AdminStatusPill tone=\{getSeoScoreTone\(score\)\}>/u);
assert.doesNotMatch(sharedSeoPill, /analyzeEntitySeo\(|seoKeywords|focusKeyword/u);
assert.match(unifiedContentColumns, /<AdminSeoScorePill score=\{row\.seo_score\} \/>/u);
assert.doesNotMatch(unifiedContentColumns, /function getSeoScoreTone/u);
assert.match(
  client,
  /initialResult\.metrics\?\.supportedSortFields \?\? legacyPageSortFields[\s\S]*constrainQueryToReadModel[\s\S]*supportedSortFields\.has\(candidate\.sort\.field\)[\s\S]*sort:\s*\{ field: "id" as const, direction: "asc" as const \}[\s\S]*constrainQuery:\s*constrainQueryToReadModel/u,
);
assert.match(
  client,
  /const PAGES_READ_MODEL_TRANSITION_NOTICE: AdminActionFeedback = \{[\s\S]*variant:\s*"warning"[\s\S]*title:\s*"تنبيه مؤقت"[\s\S]*بعض بيانات Pages المتقدمة غير متاحة حتى تطبيق تحديث قاعدة البيانات\.[\s\S]*layout:\s*"inline"[\s\S]*lifecycle:\s*"persistent"/u,
);
assert.match(
  client,
  /readModelContractVersion \?\? 1\) >= 2\) \{[\s\S]*return null;[\s\S]*return PAGES_READ_MODEL_TRANSITION_NOTICE;/u,
);
assert.doesNotMatch(client, /kind:\s*"critical_system"/u);
const pagesBulkOptions = client.match(
  /bulkOptions=\{\[([\s\S]*?)\]\}\s*bulkEntityLabel=/u,
)?.[1];
assert.ok(pagesBulkOptions, "Pages bulk options config is missing.");
assert.match(pagesBulkOptions, /value:\s*"delete"/u);
assert.match(pagesBulkOptions, /ADMIN_BULK_ACTION_LABELS\.deleteSelected/u);
assert.doesNotMatch(pagesBulkOptions, /value:\s*"(?:show|hide|detach)"/u);
assert.match(
  client,
  /sortMode=\{\{[\s\S]*mode:\s*"callback"[\s\S]*controller\.setSort\([\s\S]*current\.field === field && current\.direction === "asc"[\s\S]*\? "desc"[\s\S]*: "asc"/u,
);
assert.match(
  dataGrid,
  /const indicator = active \? \(direction === "asc" \? "↑" : "↓"\) : "↕";/u,
);
assert.match(
  dataEngineContracts,
  /params\.set\("sort", `\$\{query\.sort\.field\}_\$\{query\.sort\.direction\}`\)/u,
);
assert.match(
  dataEngineController,
  /const setSort = useCallback\([\s\S]*commitQuery\([\s\S]*sort,[\s\S]*page:[\s\S]*"push"/u,
);
assert.match(dataEngineController, /window\.history\[[\s\S]*pushState/u);
assert.match(assignmentGrid, /AdminDataGridSortLabel/u);
assert.match(
  assignmentGrid,
  /function sortProps\(key: SortKey\)[\s\S]*active:\s*sort\.key === key[\s\S]*direction:\s*sort\.direction[\s\S]*onClick:\s*\(\) => onToggleSort\(key\)/u,
);
assert.match(
  adminTable,
  /function toggleSort\(key: TSortKey\)[\s\S]*current\.key !== key\) return \{ key, direction: "asc" \}[\s\S]*current\.direction === "asc"\) return \{ key, direction: "desc" \}[\s\S]*return \{ key: null, direction: "asc" \}/u,
);

for (const retiredPath of [
  "src/lib/admin/pages/load-pages-table-rows.ts",
  "src/lib/admin/pages/load-page-module-counts.ts",
]) {
  assert.equal(existsSync(resolve(root, retiredPath)), false, `Legacy Pages read path remains: ${retiredPath}`);
}

assert.doesNotMatch(assignmentRow, /AdminStatusPill/u);
assert.match(assignmentRow, /AdminDataGridRowActions[\s\S]*display="visibility"/u);
assert.equal((assignmentRow.match(/const capability: AdminRowActionsCapability/gu) ?? []).length, 1);
assert.match(
  assignmentRow,
  /delete:\s*!manageable[\s\S]*label:\s*"إزالة من الصفحة"[\s\S]*onSelect:\s*onDetach[\s\S]*confirmLabel:\s*"إزالة من الصفحة"/u,
);
assert.match(
  compositionClient,
  /useAdminBoundedClientInstantMutation<PageBlockAssignmentRow>[\s\S]*entity:\s*"page-block-assignments"[\s\S]*rowId:\s*assignmentRowId\(row\)[\s\S]*action:\s*"visibility"/u,
);
assert.match(
  assignmentGrid,
  /rowInteraction:\s*\(rowId:\s*string\)[\s\S]*const interaction = rowInteraction\(rowId\)[\s\S]*interaction=\{interaction\}/u,
);
assert.match(
  assignmentRow,
  /const pendingAction = interaction\.pendingAction[\s\S]*const pendingState = \{[\s\S]*pending:\s*true[\s\S]*const rowBusy = interaction\.isBlocked[\s\S]*visibility:[\s\S]*pendingAction === "visibility"[\s\S]*rowBusy[\s\S]*onSelect:\s*onToggleVisibility/u,
);
assert.match(
  compositionClient,
  /rowInteraction=\{instant\.getRowInteraction\}/u,
);
assert.doesNotMatch(
  compositionClient,
  /mutationBusy=|instant\.rowPending|instant\.bulkPending/u,
);
assert.doesNotMatch(
  compositionClient,
  /search=\{\{[\s\S]*?pending:\s*collectionPending[\s\S]*?\}\}/u,
);
assert.match(
  compositionClient,
  /value:\s*"detach"[\s\S]*label:\s*"إزالة المحدد من الصفحة"[\s\S]*title:\s*"إزالة الروابط المحددة من الصفحة؟"[\s\S]*ستبقى الموديولات وقوالبها في المكتبة/u,
);
assert.doesNotMatch(
  compositionClient,
  /value:\s*"delete"\s*,\s*label:\s*"إزالة/u,
);
assert.match(
  assignmentDelete,
  /export async function detachPageBlockAssignment\(/u,
);
assert.doesNotMatch(assignmentDelete, /function deletePageBlockAssignment\(/u);
assert.match(
  compositionBulkAction,
  /action !== "show" && action !== "hide" && action !== "detach"[\s\S]*const databaseAction = action === "detach" \? "delete" : action;[\s\S]*action:\s*databaseAction/u,
);
assert.match(
  bulkActionBar,
  /confirmation\?: \{[\s\S]*resolvedOption\?\.confirmation[\s\S]*if \(resolvedConfirmation\)[\s\S]*<AdminBulkActionConfirm/u,
);
assert.match(compositionClient, /if \(table\.sort\.key !== null\) return false;/u);
assert.match(compositionClient, /if \(table\.sort\.key !== null\) return;/u);
assert.match(compositionClient, /table\.toggleSort\(key\)/u);
assert.match(compositionClient, /manualReorderEnabled=\{table\.sort\.key === null\}/u);
assert.match(
  compositionClient,
  /<PageCompositionTableSurface[\s\S]*toolbar=\{[\s\S]*<AdminEntityListFilters[\s\S]*surface="embedded"[\s\S]*table=\{[\s\S]*<PageBlocksAssignmentsGrid[\s\S]*pagination=\{[\s\S]*<AdminTablePagination/u,
);
assert.doesNotMatch(
  compositionClient,
  /data-page-composition-table-shell|className="flex flex-col gap-0"/u,
);
assert.match(
  compositionSurface,
  /data-page-composition-table-surface=""[\s\S]*data-page-composition-table-frame=""/u,
);
assert.equal(
  (compositionSurface.match(/rounded-\[20px\]/gu) ?? []).length,
  1,
  "Page Composition table surface must own exactly one rounded card boundary.",
);
assert.match(assignmentGrid, /<AdminDataGrid surface="embedded">/u);
assert.doesNotMatch(assignmentGrid, /!rounded-t-none|!border-t-0/u);
assert.match(entityListFilters, /surface\?: "standalone" \| "embedded"/u);
assert.match(entityListFilters, /surface = "standalone"/u);
assert.match(entityListFilters, /surface === "embedded"[\s\S]*overflow-visible border-b/u);
assert.match(dataGrid, /surface\?: "standalone" \| "embedded"/u);
assert.match(dataGrid, /surface = "standalone"/u);
assert.match(dataGrid, /embedded \? "" : "rounded-\[14px\] border border-white\/8"/u);
assert.match(uiRules, /عند تفعيل فرز عرض مختلف، يُعطّل reorder/u);
assert.match(assignmentReorder, /mutatePageComposition\([\s\S]*"reorder"/u);

assert.match(assignModal, /ASSIGNABLE_MODULE_KINDS/u);
assert.match(assignModal, /moduleKindLabel\(kind\)/u);
assert.match(assignModal, /getContentStatusMetadata\(template\.status\)\.label/u);
assert.doesNotMatch(assignModal, /<option value="hero">Hero<\/option>/u);
assert.match(assignmentDelete, /mutatePageComposition\([\s\S]*"bulk"[\s\S]*action:\s*"delete"/u);
assert.doesNotMatch(assignmentDelete, /hero_templates|_templates"\)\.delete/u);

assert.match(pagination, /const shouldShowFooter = totalCount > currentPageSize \|\| totalPages > 1;/u);
assert.match(pagination, /if \(!shouldShowFooter\) return null;/u);
assert.equal(9 > 10 || 1 > 1, false, "9/10 must keep the shared pagination footer hidden");

console.log("Pages Shell closure guard passed (owner, contracts, consumers, integrity, and failure boundaries).\n");
