import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  normalizeAdminEntityListQuery,
  parseAdminEntityListRequestQuery,
  writeAdminEntityListQuery,
} from "../src/lib/admin/entity-list/data-engine/contracts.ts";
import {
  projectsQueryContract,
  withLockedProjectType,
} from "../src/lib/admin/projects/entity-list-contract.ts";

const root = resolve(process.cwd());
let passed = 0;
const failures: string[] = [];

function read(relativePath: string) {
  const absolutePath = resolve(root, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing file: ${relativePath}`);
    return "";
  }
  return readFileSync(absolutePath, "utf8");
}

function check(condition: unknown, label: string) {
  if (condition) {
    passed += 1;
    return;
  }
  failures.push(label);
}

function checkAbsent(relativePath: string, label: string) {
  check(!existsSync(resolve(root, relativePath)), label);
}

const adapter = read("src/lib/admin/projects/entity-list-adapter.ts");
const contract = read("src/lib/admin/projects/entity-list-contract.ts");
const types = read("src/lib/admin/projects/entity-list-types.ts");
const client = read("src/app/admin/projects/ProjectsTableClient.tsx");
const table = read(
  "src/app/admin/projects/projects-table/ReferenceProjectsTable.tsx",
);
const config = read("src/lib/admin/projects/projects-list-config.ts");
const actions = read("src/app/admin/projects/actions.ts");
const actionIndex = read(
  "src/app/admin/projects/project-actions/index.ts",
);
const deletion = read(
  "src/app/admin/projects/project-actions/delete.ts",
);
const duplication = read(
  "src/app/admin/projects/project-actions/duplicate.ts",
);
const featuredAction = read(
  "src/app/admin/projects/project-actions/featured.ts",
);
const residentialPage = read(
  "src/app/admin/projects/residential/page.tsx",
);
const commercialPage = read(
  "src/app/admin/projects/commercial/page.tsx",
);
const migration = read(
  "sql/migrations/20260728090000_rebuild_project_admin_data_entry.sql",
);
const rowActionsMigration = read(
  "sql/migrations/20260731100000_project_row_actions_capability.sql",
);
const publicLoader = read("src/lib/projects/load-published-projects.ts");
const publicMapper = read("src/lib/projects/map-public-project.ts");
const publicHelpers = read("src/lib/projects/public-helpers.ts");
const deleteProjectRpc = ["delete", "project", "admin", "entry"].join("_");
const directProjectDelete = [".fr", 'om("projects")', ".del", "ete()"].join("");

check(
  adapter.includes('.from("projects")') &&
    adapter.includes('{ count: "exact" }'),
  "Project list reads the clean projects table with an exact count",
);
check(
  !adapter.includes('rpc("admin_list_projects"'),
  "Project list does not recreate or call the removed compatibility RPC",
);
check(
  [
    "english_name",
    "location_label",
    "featured",
    "updated_at",
  ].every((field) => adapter.includes(field)),
  "Project list selects clean-schema identity and display fields",
);
check(
  [
    "publication_status",
    "homepage_order",
    "map_area",
    "status",
  ].every((field) => !adapter.includes(field)),
  "Project list adapter has no removed legacy-column dependency",
);
check(
  adapter.includes('.eq("type", query.filters.projectType)'),
  "Project type remains server-scoped in the adapter",
);
check(
  adapter.includes("sanitizeProjectSearch") &&
    adapter.includes("arabic_name.ilike") &&
    adapter.includes("english_name.ilike") &&
    adapter.includes("slug.ilike"),
  "Search is sanitized and limited to clean identity fields",
);
check(
  adapter.includes("if (page > totalPages)") &&
    adapter.includes("loadProjectsPage(query, page)"),
  "Out-of-range pages are clamped and reloaded",
);
check(
  adapter.includes(".order(query.sort.field") &&
    adapter.includes('.order("id"'),
  "Sorting has a deterministic id tie-breaker",
);
check(
  contract.includes('"updated_at", direction: "desc"') &&
    !contract.includes("publication_status") &&
    !contract.includes("implementation_status") &&
    !contract.includes("list_mode"),
  "Project query contract exposes only clean-schema filters and sorts",
);
check(
  types.includes("english_name: string") &&
    types.includes("location_label: string") &&
    types.includes("featured: boolean") &&
    !types.includes("publication_status"),
  "Project list row type matches the clean schema",
);
check(
  client.includes("useAdminEntityListController") &&
    client.includes("useAdminEntityInstantMutation"),
  "The list keeps the shared Collection and Instant Data owners",
);
check(
  client.includes("<AdminEntityList") &&
    client.includes('consumer="projects"') &&
    !client.includes("feedbackState") &&
    !client.includes("setVisibleColumns") &&
    !client.includes("<AdminNotice"),
  "ProjectsTableClient has no parallel Collection column or Feedback owner",
);
check(
  client.includes("deleteProjectAjax") &&
    client.includes("duplicateProjectAjax") &&
    client.includes("setProjectFeaturedAjax") &&
    client.includes("navigator.clipboard.writeText") &&
    !client.includes("bulkProjectsActionAjax") &&
    !client.includes("toggleProjectPublicationAjax"),
  "The shared Project client binds copy, duplicate, featured, and delete without legacy bulk/publication commands",
);
check(
  !client.includes("AdminBulkActionBar") &&
    !client.includes("publication_status") &&
    !client.includes("implementation_status") &&
    !client.includes("list_mode"),
  "Legacy bulk and publication filters are absent from the list UI",
);
check(
    table.includes("AdminDataGridRowActions") &&
    table.includes('href: `/admin/projects/${row.id}`') &&
    table.includes("getProjectHref(row)") &&
    table.includes('title: "معلومات المشروع"') &&
    table.includes("copyPublicLink:") &&
    table.includes('visibility: { access: "hidden" }') &&
    table.includes("onToggleFeatured") &&
    table.includes("onDuplicate") &&
    table.includes('archive: { access: "hidden" }'),
  "Rows expose one shared Edit, Preview, Information, Copy Link, Featured, Duplicate, and Delete declaration",
);
check(
  client.includes("<AdminEntityList") &&
    table.includes("AdminEntityColumnDef") &&
    table.includes("AdminDataGridRowActions") &&
    table.includes('mode: "shared"') &&
    !table.includes("AdminConfirmDialog") &&
    !table.includes("window.confirm") &&
    !client.includes("window.confirm"),
  "Project list delegates Data Grid, row actions, column state, feedback, and confirmation to shared owners",
);
check(
  [
    '"project"',
    '"english_name"',
    '"slug"',
    '"location"',
    '"updated_at"',
    '"actions"',
  ].every((column) => config.includes(column)) &&
    !config.includes("publication_status") &&
    !config.includes("featured"),
  "Column preferences contain only clean list columns",
);
check(
  residentialPage.includes("loadProjectsEntityListResult(initialQuery)") &&
    residentialPage.includes("requireAdminSession()"),
  "Residential RSC authenticates and hydrates the shared list",
);
check(
  commercialPage.includes("loadProjectsEntityListResult(initialQuery)") &&
    commercialPage.includes("requireAdminSession()"),
  "Commercial RSC authenticates and hydrates the shared list",
);
check(
  !residentialPage.includes("/admin/projects/construction-updates"),
  "Construction updates are excluded from the clean list navigation",
);
check(
  !actions.includes("bulkProjectsActionAjax") &&
    actions.includes("duplicateProjectAjax") &&
    actions.includes("setProjectFeaturedAjax") &&
    !actions.includes("toggleProjectPublicationAjax") &&
    !actionIndex.includes("bulkProjectsActionAjax") &&
    actionIndex.includes("duplicateProjectAjax") &&
    actionIndex.includes("setProjectFeaturedAjax") &&
    !actionIndex.includes("toggleProjectPublicationAjax"),
  "Project action boundary exports only approved row commands and excludes legacy bulk/publication commands",
);
checkAbsent(
  "src/app/admin/projects/project-actions/status.ts",
  "Legacy status action owner is removed",
);
checkAbsent(
  "src/app/admin/projects/project-actions/bulk.ts",
  "Legacy bulk action owner is removed",
);
checkAbsent(
  "src/app/admin/projects/projects-table/LegacyProjectsTable.tsx",
  "The second legacy Project table renderer is removed",
);
check(
  deletion.includes("requireAdminSession") &&
    deletion.includes(`"${deleteProjectRpc}"`) &&
    !deletion.includes(directProjectDelete) &&
    deletion.includes('.from("project_videos")') &&
    deletion.includes('domainKey: "project_videos"'),
  "Explicit deletion is RPC-owned, authenticated, and synchronizes clean video identities",
);
check(
  migration.includes(`function public.${deleteProjectRpc}`) &&
    migration.includes(`grant execute on function public.${deleteProjectRpc}(bigint) to service_role`),
  "Aggregate delete RPC is service-role-only",
);
check(
  duplication.includes("requireAdminSession") &&
    duplication.includes('rpc(\n    "duplicate_project_admin_entry"') &&
    duplication.includes('buildCmsAuditAction("project", "duplicate")') &&
    duplication.includes("synchronizeDuplicatedProjectMedia") &&
    duplication.includes("revalidateProjectPaths"),
  "Duplicate command is authenticated, atomic-RPC-owned, audited, media-synchronized, and revalidated",
);
check(
  featuredAction.includes("requireAdminSession") &&
    featuredAction.includes('rpc(\n    "set_project_featured_admin_entry"') &&
    featuredAction.includes('buildCmsAuditAction("project", "update")') &&
    featuredAction.includes("revalidateProjectPaths"),
  "Featured command writes desired authoritative state through the authenticated audited Project boundary",
);
check(
  rowActionsMigration.includes("add column if not exists featured boolean") &&
    rowActionsMigration.includes("alter column featured set default false") &&
    rowActionsMigration.includes("alter column featured set not null") &&
    rowActionsMigration.includes("function public.duplicate_project_admin_entry") &&
    rowActionsMigration.includes("function public.set_project_featured_admin_entry") &&
    rowActionsMigration.includes("for update") &&
    rowActionsMigration.includes("public.project_floor_plan_details") &&
    rowActionsMigration.includes("grant execute on function public.duplicate_project_admin_entry(bigint) to service_role"),
  "Additive migration owns featured truth and transaction-complete aggregate duplication",
);
check(
  publicLoader.includes('"slug", "featured"') &&
    publicMapper.includes("featured: project.featured === true") &&
    publicHelpers.includes("projects.filter((project) => project.featured)") &&
    publicHelpers.includes("return `/projects/${project.slug}`") &&
    publicHelpers.includes("return absoluteUrlWithBase(getProjectHref(project))"),
  "Public Project loader, mapper, featured selection, and absolute public-link route share authoritative Project data",
);
checkAbsent(
  "scripts/qa-admin-instant-projects.mjs",
  "Obsolete destructive legacy Project QA surface is removed",
);
check(
  migration.includes("drop function if exists public.admin_list_projects") &&
    !migration.includes("create or replace function public.admin_list_projects"),
  "The clean migration drops rather than replaces the legacy list RPC",
);

const normalized = normalizeAdminEntityListQuery(
  projectsQueryContract,
  "type=commercial&q=  Nile   Tower  &page=2&limit=20&sort=english_name_asc",
);
check(
  normalized.filters.projectType === "commercial" &&
    normalized.search === "Nile Tower" &&
    normalized.page === 2 &&
    normalized.pageSize === 20 &&
    normalized.sort.field === "english_name" &&
    normalized.sort.direction === "asc",
  "Clean Project URL state normalizes search, paging, type, and sort",
);
check(
  withLockedProjectType(normalized.filters, "residential").projectType ===
    "residential",
  "Page ownership can lock the Project type",
);
const written = writeAdminEntityListQuery(
  projectsQueryContract,
  normalized,
);
check(
  written.get("type") === "commercial" &&
    written.get("q") === "Nile Tower" &&
    written.get("publication_status") === null,
  "Clean Project URL serialization never emits legacy publication state",
);
let oldParamRejected = false;
try {
  parseAdminEntityListRequestQuery(
    projectsQueryContract,
    "type=residential&publication_status=published",
  );
} catch {
  oldParamRejected = true;
}
check(
  oldParamRejected,
  "Strict Project request boundary rejects removed publication parameters",
);

if (failures.length > 0) {
  console.error("verify-admin-instant-projects FAILED:");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`verify-admin-instant-projects OK (${passed} checks)`);
