import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { QueryClient } from "@tanstack/react-query";

import {
  AdminEntityListQueryValidationError,
  isSameAdminEntityListScope,
  normalizeAdminEntityListQuery,
  parseAdminEntityListRequestQuery,
  serializeAdminEntityListQuery,
  writeAdminEntityListQuery,
  type AdminEntityListQuery,
  type AdminEntityListResult,
} from "../src/lib/admin/entity-list/data-engine/contracts.ts";
import { adminEntityListQueryKeys } from "../src/lib/admin/entity-list/data-engine/query-keys.ts";
import {
  removeAdminEntityRows,
  setAdminEntityListCachesInScope,
} from "../src/lib/admin/entity-list/data-engine/instant-mutation-cache.ts";
import { cacheNormalizedAdminEntityListResult } from "../src/lib/admin/entity-list/data-engine/normalized-result-cache.ts";
import {
  projectsQueryContract,
  withLockedProjectType,
  type ProjectFilters,
  type ProjectSortField,
} from "../src/lib/admin/projects/entity-list-contract.ts";
import type { ProjectEntityListRow } from "../src/lib/admin/projects/entity-list-types.ts";
import {
  applyProjectPublicationMutation,
  projectRowMatchesDataset,
} from "../src/lib/admin/projects/instant-mutation-membership.ts";

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

let assertions = 0;
function check(condition: unknown, label: string) {
  assert.ok(condition, label);
  assertions += 1;
}

const [
  registry,
  residentialPage,
  commercialPage,
  client,
  referenceTable,
  legacyTable,
  adapter,
  types,
  migration,
  mutation,
  mutationCache,
  controller,
  normalizedCache,
  statusActions,
  bulkActions,
  deleteActions,
  actionsFacade,
] = await Promise.all([
  read("src/lib/admin/entity-list/data-engine/registry.ts"),
  read("src/app/admin/projects/residential/page.tsx"),
  read("src/app/admin/projects/commercial/page.tsx"),
  read("src/app/admin/projects/ProjectsTableClient.tsx"),
  read("src/app/admin/projects/projects-table/ReferenceProjectsTable.tsx"),
  read("src/app/admin/projects/projects-table/LegacyProjectsTable.tsx"),
  read("src/lib/admin/projects/entity-list-adapter.ts"),
  read("src/lib/admin/projects/entity-list-types.ts"),
  read("sql/migrations/20260721030000_admin_projects_list_read_model.sql"),
  read("src/lib/admin/entity-list/data-engine/instant-mutation.ts"),
  read("src/lib/admin/entity-list/data-engine/instant-mutation-cache.ts"),
  read("src/lib/admin/entity-list/data-engine/client-controller.ts"),
  read("src/lib/admin/entity-list/data-engine/normalized-result-cache.ts"),
  read("src/app/admin/projects/project-actions/status.ts"),
  read("src/app/admin/projects/project-actions/bulk.ts"),
  read("src/app/admin/projects/project-actions/delete.ts"),
  read("src/app/admin/projects/actions.ts"),
]);

check(registry.includes("projects: projectsEntityListAdapter"), "registry registers projects");
check(residentialPage.includes("loadProjectsEntityListResult"), "residential RSC hydrates");
check(commercialPage.includes("loadProjectsEntityListResult"), "commercial RSC hydrates");
check(residentialPage.includes('withLockedProjectType'), "residential locks project type");
check(commercialPage.includes('withLockedProjectType'), "commercial locks project type");
check(client.includes("useAdminEntityListController"), "client uses shared controller");
check(client.includes("useAdminEntityInstantMutation"), "client uses instant mutations");
check(client.includes('entity: "projects"'), "client binds projects entity");
check(client.includes("AdminNotice"), "client uses AdminNotice");
check(client.includes("AdminEntityListFilters"), "client uses shared filters");
check(client.includes("AdminTablePagination"), "client uses shared pagination");
check(!client.includes("useAdminTable"), "client does not use useAdminTable");
check(!client.includes("getProjectsTableRows"), "client does not full-list refresh");
check(!client.includes("router.refresh"), "client has no router.refresh");
check(!client.includes("window.location"), "client has no window.location reload");
check(!referenceTable.includes("useAdminTable"), "reference table detached from useAdminTable");
check(!legacyTable.includes("useAdminTable"), "legacy table detached from useAdminTable");
check(adapter.includes('.rpc("admin_list_projects"'), "adapter calls admin_list_projects");
check((adapter.match(/\.rpc\(/g) ?? []).length === 1, "adapter uses exactly one rpc");
check(adapter.includes("ProjectsEntityListDatabaseError"), "adapter typed db errors");
check(adapter.includes("z.coerce.number().int().nonnegative().finite()"), "adapter coerces total_count safely");
check(migration.includes("create or replace function public.admin_list_projects"), "migration adds read model");
check(migration.includes("normalized_state"), "migration normalizes out-of-range pages");
check(migration.includes("'page', (select page from normalized_state)"), "migration returns normalized page");
check(migration.includes("p_project_type"), "migration filters project type");
check(migration.includes("p_search"), "migration supports search");
check(migration.includes("p_publication_status"), "migration supports publication filter");
check(migration.includes("p_implementation_status"), "migration supports implementation filter");
check(migration.includes("p_featured"), "migration supports featured filter");
check(migration.includes("p_list_mode"), "migration supports active/archive mode");
for (const input of [
  "p_page",
  "p_page_size",
  "p_sort_field",
  "p_sort_direction",
  "p_project_type",
  "p_publication_status",
  "p_implementation_status",
  "p_featured",
  "p_list_mode",
]) {
  check(
    migration.includes(`if ${input} is null`) &&
      migration.includes(`message = '${input}`),
    `database validates ${input}`,
  );
}
for (const sortField of [
  "homepage_order",
  "arabic_name",
  "code",
  "featured",
  "publication_status",
  "location",
  "updated_at",
]) {
  check(migration.includes(`'${sortField}'`), `database allows sort ${sortField}`);
}
for (const value of ["residential", "commercial"]) {
  check(migration.includes(`'${value}'`), `database allows project type ${value}`);
}
for (const value of ["all", "draft", "published", "unpublished", "archived"]) {
  check(migration.includes(`'${value}'`), `database allows publication ${value}`);
}
for (const value of [
  "all",
  "under-construction",
  "excavation",
  "near-delivery",
  "delivered",
]) {
  check(migration.includes(`'${value}'`), `database allows implementation ${value}`);
}
check(
  migration.includes("p_page_size not in (10, 20, 30)"),
  "database page-size allowlist is explicit",
);
check(
  migration.includes("p_sort_direction not in ('asc', 'desc')"),
  "database sort-direction allowlist is explicit",
);
check(
  migration.includes("p_featured not in ('all', 'yes', 'no')"),
  "database featured allowlist is explicit",
);
check(
  migration.includes("p_list_mode not in ('all', 'active', 'archived')"),
  "database list-mode allowlist is explicit",
);
check(migration.includes("grant execute") && migration.includes("service_role"), "migration grants service_role only");
check(!migration.includes("drop table"), "migration is non-destructive");
check(mutation.includes("cancelQueries"), "mutation cancels in-flight queries");
check(mutation.includes("snapshot.forEach"), "mutation restores snapshots");
check(mutation.includes("reconcileSuccess"), "mutation core supports deterministic success reconciliation");
check(mutation.includes("restoreSnapshot"), "mutation core exposes exact snapshot restoration");
check(mutationCache.includes("matchesAdminEntityListScope"), "cache patches by dataset scope");
check(controller.includes("cacheNormalizedAdminEntityListResult"), "controller out-of-range one-request");
check(normalizedCache.includes("setQueryData(normalizedKey, result)"), "normalized cache transfer");
check(statusActions.includes('code: "publish_validation"'), "status mutations return typed codes");
check(bulkActions.includes(".eq(\"type\", type)"), "bulk actions scoped by project type");
check(deleteActions.includes('code: "confirm_required"'), "delete returns typed codes");
check(!actionsFacade.includes("getProjectsTableRows"), "actions facade no longer exports full-list loader");
check(!statusActions.includes("getProjectsTableRows"), "status module no longer full-list reloads");
check(client.includes("isBulkPending"), "client separates bulk pending");
check(client.includes("rowPendingAction"), "client exposes row-local pending action");
check(!client.includes("const isBusy ="), "client has no global row busy state");
check(client.includes("mutationLockRef"), "client retains single-flight mutation safety");
check(
  referenceTable.includes('pending={pendingAction === "status"}') &&
    legacyTable.includes('pending={pendingAction === "status"}'),
  "row pending presentation is action-local",
);
check(
  referenceTable.includes("pending || handlers.isBulkPending") &&
    legacyTable.includes("pending || handlers.isBulkPending"),
  "bulk pending disables all row actions",
);

const residential = normalizeAdminEntityListQuery(
  projectsQueryContract,
  "type=residential&page=2&limit=20&sort=code_desc&q=tower&publication_status=published&featured=yes&list_mode=active",
);
const commercial = withLockedProjectType(
  normalizeAdminEntityListQuery(projectsQueryContract, "type=commercial").filters,
  "commercial",
);
check(residential.filters.projectType === "residential", "residential type parsed");
check(commercial.projectType === "commercial", "commercial type locked");
check(
  serializeAdminEntityListQuery(residential) !==
    serializeAdminEntityListQuery({
      ...residential,
      filters: { ...residential.filters, projectType: "commercial" },
    }),
  "project-type isolation changes dataset identity",
);

assert.throws(
  () => parseAdminEntityListRequestQuery(projectsQueryContract, "type=warehouse"),
  AdminEntityListQueryValidationError,
);
assertions += 1;
assert.throws(
  () => parseAdminEntityListRequestQuery(projectsQueryContract, "sort=unsafe_desc"),
  AdminEntityListQueryValidationError,
);
assertions += 1;
assert.throws(
  () => parseAdminEntityListRequestQuery(projectsQueryContract, "publication_status=bogus"),
  AdminEntityListQueryValidationError,
);
assertions += 1;
assert.throws(
  () => parseAdminEntityListRequestQuery(projectsQueryContract, "list_mode=trash"),
  AdminEntityListQueryValidationError,
);
assertions += 1;
assert.throws(
  () => parseAdminEntityListRequestQuery(projectsQueryContract, "limit=15"),
  AdminEntityListQueryValidationError,
);
assertions += 1;

const valid = parseAdminEntityListRequestQuery(
  projectsQueryContract,
  "type=residential&page=2&limit=20&sort=arabic_name_asc&q=alpha&publication_status=draft&implementation_status=delivered&featured=no&list_mode=archived",
);
check(valid.filters.projectType === "residential", "strict parse keeps project type");
check(valid.filters.publicationStatus === "draft", "strict parse keeps publication filter");
check(valid.filters.implementationStatus === "delivered", "strict parse keeps implementation filter");
check(valid.filters.featured === "no", "strict parse keeps featured filter");
check(valid.filters.listMode === "archived", "strict parse keeps list mode");
check(
  writeAdminEntityListQuery(projectsQueryContract, valid).get("type") === "residential",
  "URL writer always emits project type",
);

check(adapter.includes("projectEntityListRowSchema"), "adapter defines row schema");
check(adapter.includes("projectsEntityListResultSchema"), "adapter defines result schema");
check(adapter.includes("createAdminEntityListResultSchema"), "adapter uses shared result schema factory");
check(types.includes("export type ProjectEntityListRow"), "shared client-safe row type exists");
check(types.includes("export type ProjectEntityListMetrics"), "shared client-safe metrics type exists");

const membershipRow = (
  publication_status: string,
  overrides: Partial<ProjectEntityListRow> = {},
): ProjectEntityListRow => ({
  id: 1,
  code: "R-1",
  slug: "r-1",
  arabic_name: "برج القاهرة",
  location_label: "القاهرة",
  map_area: "وسط البلد",
  featured: false,
  publication_status,
  status: "under-construction",
  updated_at: "2026-07-21T00:00:00.000Z",
  ...overrides,
});

function membershipHarness(rows: ProjectEntityListRow[]) {
  let current = rows.map((row) => ({ ...row }));
  let removed = new Set<number | string>();
  return {
    cache: {
      patchRows(updater: (row: ProjectEntityListRow) => ProjectEntityListRow) {
        current = current.map(updater);
      },
      removeRows(ids: ReadonlySet<number | string>) {
        removed = new Set([...removed, ...ids]);
        current = current.filter((row) => !ids.has(row.id));
      },
      upsertRows() {},
    },
    rows: () => current,
    removed: () => removed,
    restore(rowsToRestore: ProjectEntityListRow[]) {
      current = rowsToRestore.map((row) => ({ ...row }));
      removed = new Set();
    },
  };
}

const filters = (
  overrides: Partial<ProjectFilters> = {},
): ProjectFilters => ({
  projectType: "residential",
  publicationStatus: "all",
  implementationStatus: "all",
  featured: "all",
  listMode: "all",
  ...overrides,
});

check(
  projectRowMatchesDataset(
    membershipRow("published"),
    "برج القاهرة",
    filters({
      publicationStatus: "published",
      implementationStatus: "under-construction",
      featured: "no",
      listMode: "active",
    }),
  ),
  "complete matching dataset membership keeps row",
);

function verifyPublicationTransition(
  label: string,
  sourceStatus: string,
  nextStatus: string,
  activeFilters: ProjectFilters,
  expectedRemoval: boolean,
) {
  const source = membershipRow(sourceStatus);
  const harness = membershipHarness([source]);
  applyProjectPublicationMutation(
    harness.cache,
    [source],
    new Set([source.id]),
    nextStatus,
    "",
    activeFilters,
  );
  check(
    harness.removed().has(source.id) === expectedRemoval,
    `${label}: removal matches membership`,
  );
  check(
    expectedRemoval ||
      harness.rows()[0]?.publication_status === nextStatus,
    `${label}: matching row is patched`,
  );
}

verifyPublicationTransition(
  "published to unpublished in published filter",
  "published",
  "unpublished",
  filters({ publicationStatus: "published" }),
  true,
);
verifyPublicationTransition(
  "unpublished to published in unpublished filter",
  "unpublished",
  "published",
  filters({ publicationStatus: "unpublished" }),
  true,
);
verifyPublicationTransition(
  "draft to published in draft filter",
  "draft",
  "published",
  filters({ publicationStatus: "draft" }),
  true,
);
verifyPublicationTransition(
  "archive in active mode",
  "published",
  "archived",
  filters({ listMode: "active" }),
  true,
);
verifyPublicationTransition(
  "archive in non-all publication filter",
  "published",
  "archived",
  filters({ publicationStatus: "published" }),
  true,
);
verifyPublicationTransition(
  "restore in archived mode",
  "archived",
  "draft",
  filters({ listMode: "archived" }),
  true,
);
verifyPublicationTransition(
  "restore in archived publication filter",
  "archived",
  "draft",
  filters({ publicationStatus: "archived" }),
  true,
);
verifyPublicationTransition(
  "publication change in unfiltered dataset",
  "draft",
  "published",
  filters(),
  false,
);

const bulkHideRows = [
  membershipRow("published", { id: 21 }),
  membershipRow("published", { id: 22 }),
];
const bulkHideHarness = membershipHarness(bulkHideRows);
applyProjectPublicationMutation(
  bulkHideHarness.cache,
  bulkHideRows,
  new Set([21, 22]),
  "unpublished",
  "",
  filters({ publicationStatus: "published" }),
);
check(
  bulkHideHarness.removed().size === 2,
  "bulk hide removes every row leaving publication dataset",
);

const bulkArchiveRows = [
  membershipRow("published", { id: 31 }),
  membershipRow("draft", { id: 32 }),
];
const bulkArchiveHarness = membershipHarness(bulkArchiveRows);
applyProjectPublicationMutation(
  bulkArchiveHarness.cache,
  bulkArchiveRows,
  new Set([31, 32]),
  "archived",
  "",
  filters({ listMode: "active" }),
);
check(
  bulkArchiveHarness.removed().size === 2,
  "bulk archive removes every row leaving active dataset",
);

const mixedRows = [
  membershipRow("draft", { id: 11, code: "VALID" }),
  membershipRow("draft", { id: 12, code: "SKIPPED" }),
];
const mixedHarness = membershipHarness(mixedRows);
applyProjectPublicationMutation(
  mixedHarness.cache,
  mixedRows,
  new Set([11, 12]),
  "published",
  "",
  filters(),
);
check(
  mixedHarness.rows().every((row) => row.publication_status === "published"),
  "bulk publish applies optimistic state to selected rows",
);
// Mirrors reconcileSuccess: exact snapshot first, then only authoritative IDs.
mixedHarness.restore(mixedRows);
applyProjectPublicationMutation(
  mixedHarness.cache,
  mixedRows,
  new Set([11]),
  "published",
  "",
  filters(),
);
check(
  mixedHarness.rows().find((row) => row.id === 11)?.publication_status ===
    "published",
  "partial bulk publish keeps affected ID published",
);
check(
  mixedHarness.rows().find((row) => row.id === 12)?.publication_status ===
    "draft",
  "partial bulk publish restores skipped ID exactly",
);

const baseQuery = normalizeAdminEntityListQuery(
  projectsQueryContract,
  "type=residential",
);
const pageOneQuery: AdminEntityListQuery<ProjectFilters, ProjectSortField> = {
  ...baseQuery,
  page: 1,
  pageSize: 3,
};
const pageTwoQuery: AdminEntityListQuery<ProjectFilters, ProjectSortField> = {
  ...baseQuery,
  page: 2,
  pageSize: 3,
};
const differentSortQuery: AdminEntityListQuery<ProjectFilters, ProjectSortField> = {
  ...baseQuery,
  page: 1,
  pageSize: 3,
  sort: { field: "code", direction: "desc" },
};
const differentPageSizeQuery: AdminEntityListQuery<ProjectFilters, ProjectSortField> = {
  ...baseQuery,
  page: 1,
  pageSize: 2,
};
const differentSearchQuery: AdminEntityListQuery<ProjectFilters, ProjectSortField> = {
  ...baseQuery,
  search: "other",
  page: 1,
  pageSize: 3,
};
const differentTypeQuery: AdminEntityListQuery<ProjectFilters, ProjectSortField> = {
  ...baseQuery,
  filters: { ...baseQuery.filters, projectType: "commercial" },
  page: 1,
  pageSize: 3,
};
const differentModeQuery: AdminEntityListQuery<ProjectFilters, ProjectSortField> = {
  ...baseQuery,
  filters: { ...baseQuery.filters, listMode: "archived" },
  page: 1,
  pageSize: 3,
};

check(isSameAdminEntityListScope(pageOneQuery, pageTwoQuery), "page excluded from dataset identity");
check(isSameAdminEntityListScope(pageOneQuery, differentSortQuery), "sort excluded from dataset identity");
check(
  isSameAdminEntityListScope(pageOneQuery, differentPageSizeQuery),
  "pageSize excluded from dataset identity",
);
check(!isSameAdminEntityListScope(pageOneQuery, differentSearchQuery), "search defines dataset identity");
check(!isSameAdminEntityListScope(pageOneQuery, differentTypeQuery), "project type defines dataset identity");
check(!isSameAdminEntityListScope(pageOneQuery, differentModeQuery), "list mode filter defines dataset identity");

type ScopeRow = {
  id: number;
  code: string;
  slug: string | null;
  arabic_name: string;
  location_label: string | null;
  map_area: string | null;
  featured: boolean;
  publication_status: string | null;
  status: string | null;
  updated_at: string;
};
type ScopeMetrics = { published: number; featured: number };
const scopeMeta = {
  generatedAt: "2026-07-21T00:00:00.000Z",
  mode: "server-page" as const,
};
const scopeClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
});
const sample = (id: number, code: string): ScopeRow => ({
  id,
  code,
  slug: code.toLowerCase(),
  arabic_name: code,
  location_label: "Cairo",
  map_area: null,
  featured: false,
  publication_status: "published",
  status: "delivered",
  updated_at: "2026-07-21T00:00:00.000Z",
});
scopeClient.setQueryData(
  adminEntityListQueryKeys.query("projects", pageOneQuery),
  {
    rows: [sample(1, "A"), sample(2, "B"), sample(3, "C")],
    pagination: { page: 1, pageSize: 3, totalRows: 4, totalPages: 2 },
    metrics: { published: 4, featured: 1 },
    meta: scopeMeta,
  } satisfies AdminEntityListResult<ScopeRow, ScopeMetrics>,
);
scopeClient.setQueryData(
  adminEntityListQueryKeys.query("projects", pageTwoQuery),
  {
    rows: [sample(4, "D")],
    pagination: { page: 2, pageSize: 3, totalRows: 4, totalPages: 2 },
    metrics: { published: 4, featured: 1 },
    meta: scopeMeta,
  } satisfies AdminEntityListResult<ScopeRow, ScopeMetrics>,
);
scopeClient.setQueryData(
  adminEntityListQueryKeys.query("projects", differentSortQuery),
  {
    rows: [sample(4, "D"), sample(3, "C"), sample(2, "B")],
    pagination: { page: 1, pageSize: 3, totalRows: 4, totalPages: 2 },
    metrics: { published: 4, featured: 1 },
    meta: scopeMeta,
  } satisfies AdminEntityListResult<ScopeRow, ScopeMetrics>,
);
scopeClient.setQueryData(
  adminEntityListQueryKeys.query("projects", differentPageSizeQuery),
  {
    rows: [sample(1, "A"), sample(2, "B")],
    pagination: { page: 1, pageSize: 2, totalRows: 4, totalPages: 2 },
    metrics: { published: 4, featured: 1 },
    meta: scopeMeta,
  } satisfies AdminEntityListResult<ScopeRow, ScopeMetrics>,
);
scopeClient.setQueryData(
  adminEntityListQueryKeys.query("projects", differentSearchQuery),
  {
    rows: [sample(9, "Z")],
    pagination: { page: 1, pageSize: 3, totalRows: 1, totalPages: 1 },
    metrics: { published: 1, featured: 0 },
    meta: scopeMeta,
  } satisfies AdminEntityListResult<ScopeRow, ScopeMetrics>,
);
scopeClient.setQueryData(
  adminEntityListQueryKeys.query("projects", differentTypeQuery),
  {
    rows: [sample(8, "X")],
    pagination: { page: 1, pageSize: 3, totalRows: 1, totalPages: 1 },
    metrics: { published: 1, featured: 0 },
    meta: scopeMeta,
  } satisfies AdminEntityListResult<ScopeRow, ScopeMetrics>,
);

const snapshot = scopeClient.getQueriesData<AdminEntityListResult<ScopeRow, ScopeMetrics>>({
  queryKey: adminEntityListQueryKeys.queries("projects"),
  predicate: (query) =>
    isSameAdminEntityListScope(
      JSON.parse(String(query.queryKey[3])) as AdminEntityListQuery<
        Record<string, unknown>,
        string
      >,
      pageOneQuery,
    ),
});
check(snapshot.length === 4, "snapshot covers same-dataset cached views");

setAdminEntityListCachesInScope<ScopeRow, ScopeMetrics>(
  scopeClient,
  "projects",
  pageOneQuery,
  (data) => removeAdminEntityRows(data, new Set([4])),
);
const readScoped = (
  query: AdminEntityListQuery<ProjectFilters, ProjectSortField>,
) =>
  scopeClient.getQueryData<AdminEntityListResult<ScopeRow, ScopeMetrics>>(
    adminEntityListQueryKeys.query("projects", query),
  )?.pagination;
const readScopedRows = (
  query: AdminEntityListQuery<ProjectFilters, ProjectSortField>,
) =>
  scopeClient.getQueryData<AdminEntityListResult<ScopeRow, ScopeMetrics>>(
    adminEntityListQueryKeys.query("projects", query),
  )?.rows;
check(readScoped(pageOneQuery)?.totalRows === 3, "cross-page totalRows patched");
check(readScoped(pageTwoQuery)?.totalRows === 3, "page-two totalRows patched");
check(readScoped(differentSortQuery)?.totalRows === 3, "cross-sort totalRows patched");
check(readScoped(differentPageSizeQuery)?.totalRows === 3, "cross-page-size totalRows patched");
check(readScoped(pageOneQuery)?.totalPages === 1, "totalPages stays consistent for pageSize 3");
check(readScoped(differentPageSizeQuery)?.totalPages === 2, "totalPages stays consistent for pageSize 2");
check(readScoped(differentSearchQuery)?.totalRows === 1, "search dataset isolated from patch");
check(readScoped(differentTypeQuery)?.totalRows === 1, "project-type dataset isolated from patch");

snapshot.forEach(([key, value]) => scopeClient.setQueryData(key, value));
check(readScoped(pageOneQuery)?.totalRows === 4, "deterministic rollback restores page one");
check(readScoped(pageTwoQuery)?.totalRows === 4, "deterministic rollback restores page two");
check(readScoped(differentSortQuery)?.totalRows === 4, "deterministic rollback restores sort view");
check(readScoped(differentPageSizeQuery)?.totalRows === 4, "deterministic rollback restores page-size view");
check(
  JSON.stringify(readScopedRows(pageTwoQuery)) ===
    JSON.stringify([sample(4, "D")]),
  "deterministic rollback restores exact row values",
);
scopeClient.clear();

const controllerQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
});
const requestedOutOfRangeQuery: AdminEntityListQuery<
  ProjectFilters,
  ProjectSortField
> = { ...baseQuery, page: 999 };
const normalizedResult = {
  rows: [sample(4, "D")],
  pagination: { page: 2, pageSize: 10, totalRows: 11, totalPages: 2 },
  metrics: { published: 8, featured: 2 },
  meta: scopeMeta,
} satisfies AdminEntityListResult<ScopeRow, ScopeMetrics>;
let clientEndpointRequests = 0;
let reconciledPage: number | null = null;
await controllerQueryClient.fetchQuery({
  queryKey: adminEntityListQueryKeys.query("projects", requestedOutOfRangeQuery),
  queryFn: async () => {
    clientEndpointRequests += 1;
    const reconciledQuery = cacheNormalizedAdminEntityListResult(
      controllerQueryClient,
      "projects",
      requestedOutOfRangeQuery,
      normalizedResult,
    );
    reconciledPage = reconciledQuery?.page ?? null;
    return normalizedResult;
  },
});
check(reconciledPage === 2, "out-of-range normalizes to last page");
const normalizedCacheResult = await controllerQueryClient.fetchQuery({
  queryKey: adminEntityListQueryKeys.query("projects", {
    ...requestedOutOfRangeQuery,
    page: 2,
  }),
  queryFn: async () => {
    clientEndpointRequests += 1;
    throw new Error("Normalized query must reuse the transferred result.");
  },
});
check(clientEndpointRequests === 1, "out-of-range requires only one list request");
check(
  (normalizedCacheResult as AdminEntityListResult<ScopeRow, ScopeMetrics>)
    .pagination.page === 2,
  "normalized cache keeps totalRows/totalPages contract",
);
controllerQueryClient.clear();

console.log(
  `verify:admin-instant-projects passed (${assertions} structural/runtime assertions)`,
);
console.log(`out-of-range client endpoint request count: ${clientEndpointRequests}`);
