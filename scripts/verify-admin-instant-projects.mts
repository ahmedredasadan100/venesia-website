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
const dataController = read(
  "src/lib/admin/entity-list/data-engine/client-controller.ts",
);
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
const publicationAction = read(
  "src/app/admin/projects/project-actions/publication.ts",
);
const residentialPage = read(
  "src/app/admin/projects/residential/page.tsx",
);
const commercialPage = read(
  "src/app/admin/projects/commercial/page.tsx",
);
const columnPreferencesOwner = read(
  "src/lib/admin/preferences/admin-column-preferences.ts",
);
const migration = read(
  "sql/migrations/20260728090000_rebuild_project_admin_data_entry.sql",
);
const rowActionsMigration = read(
  "sql/migrations/20260731100000_project_row_actions_capability.sql",
);
const publishingMigration = read(
  "sql/migrations/20260803120000_project_publishing_visibility_capability.sql",
);
const publicLoader = read("src/lib/projects/load-published-projects.ts");
const publicMapper = read("src/lib/projects/map-public-project.ts");
const publicHelpers = read("src/lib/projects/public-helpers.ts");
const deleteProjectRpc = ["delete", "project", "admin", "entry"].join("_");
const directProjectDelete = [".fr", 'om("projects")', ".del", "ete()"].join("");

check(
  adapter.includes('.rpc("admin_list_projects"') &&
    adapter.includes("projectEntityListRpcResultSchema") &&
    adapter.includes("total_count"),
  "Project list reads one authoritative publication-aware RPC result",
);
check(
  publishingMigration.includes(
    "create or replace function public.admin_list_projects",
  ) &&
    publishingMigration.includes(
      "grant execute on function public.admin_list_projects(integer, integer, text, text, text, text, text, text) to service_role",
    ),
  "Project publishing migration owns the service-role Admin list read model",
);
check(
  [
    "english_name",
    "location_label",
    "featured",
    "publication_status",
    "published_at",
    "updated_at",
  ].every((field) => adapter.includes(field)),
  "Project list selects clean-schema identity and display fields",
);
check(
  [
    "homepage_order",
    "map_area",
    "implementation_status",
    "list_mode",
  ].every((field) => !adapter.includes(field)),
  "Project list adapter has no removed legacy-column dependency",
);
check(
  adapter.includes("p_project_type: query.filters.projectType"),
  "Project type remains server-scoped in the adapter",
);
check(
  adapter.includes("p_search: query.search") &&
    publishingMigration.includes("v_search_pattern") &&
    publishingMigration.includes("project.arabic_name ilike v_search_pattern") &&
    publishingMigration.includes("project.english_name ilike v_search_pattern") &&
    publishingMigration.includes("project.slug ilike v_search_pattern"),
  "Search delegates escaped identity matching to the authoritative read model",
);
check(
  adapter.includes("p_featured: query.filters.featured") &&
    adapter.includes("p_publication_status: query.filters.publicationStatus") &&
    contract.includes('featured: "all"') &&
    contract.includes('publicationStatus: "all"') &&
    client.includes('paramKey: "featured"') &&
    client.includes('paramKey: "publication_status"'),
  "Featured and publication filters are declared and applied before pagination",
);
check(
  adapter.includes("loadNormalizedAdminEntityListPage") &&
    adapter.includes("loadPage: (page) => loadProjectsPage(query, page)"),
  "Out-of-range pages delegate bounded normalization to Data Runtime",
);
check(
  publishingMigration.includes("p_sort_field = 'publication_status'") &&
    publishingMigration.includes("p_sort_field = 'published_at'") &&
    publishingMigration.includes("project.id desc"),
  "Authoritative sorting covers publication fields with a deterministic id tie-breaker",
);
check(
  contract.includes('"updated_at", direction: "desc"') &&
    contract.includes('"publication_status"') &&
    contract.includes('"published_at"') &&
    !contract.includes("implementation_status") &&
    !contract.includes("list_mode"),
  "Project query contract exposes the clean publication filters and sorts",
);
check(
  types.includes("english_name: string") &&
    types.includes("location_label: string") &&
    types.includes("featured: boolean") &&
    types.includes("publication_status: ProjectPublicationStatus") &&
    types.includes("published_at: string | null"),
  "Project list row type matches the publication-aware schema",
);
check(
  client.includes("useAdminEntityListController") &&
    client.includes("useAdminEntityInstantMutation"),
  "The list keeps the shared Collection and Instant Data owners",
);
check(
  client.includes("withLockedProjectType") &&
    client.includes("constrainQuery,") &&
    residentialPage.includes('key="residential"') &&
    commercialPage.includes('key="commercial"') &&
    dataController.includes("constrainQuery?:") &&
    dataController.includes("const resolved = applyQueryConstraint(candidate)") &&
    dataController.includes("const restored = applyQueryConstraint(normalized)") &&
    dataController.includes("window.history.replaceState"),
  "Residential and Commercial route locks survive all query transitions and Back or Forward restoration",
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
    client.includes("setProjectPublicationAjax") &&
    client.includes("navigator.clipboard.writeText") &&
    !client.includes("bulkProjectsActionAjax") &&
    !client.includes("toggleProjectPublicationAjax"),
  "The shared Project client binds copy, publication, duplicate, featured, and delete without legacy commands",
);
check(
  !client.includes("AdminBulkActionBar") &&
    client.includes('paramKey: "publication_status"') &&
    !client.includes("implementation_status") &&
    !client.includes("list_mode"),
  "The list UI exposes the owned publication filter without legacy workflow filters",
);
check(
    table.includes("AdminDataGridRowActions") &&
    table.includes('href: `/admin/projects/${row.id}`') &&
    table.includes("getProjectPreviewCapability") &&
    table.includes('title: "معلومات المشروع"') &&
    table.includes("copyPublicLink:") &&
    table.includes("visibility:") &&
    table.includes("onVisibility") &&
    table.includes("onToggleFeatured") &&
    table.includes("onDuplicate") &&
    table.includes('archive: { access: "hidden" }'),
  "Rows expose one shared Edit, Preview, Information, Copy Link, Visibility, Featured, Duplicate, and Delete declaration",
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
    '"publication_status"',
    '"featured"',
    '"city"',
    '"main_area"',
    '"sub_area"',
    '"english_name"',
    '"slug"',
    '"published_at"',
    '"updated_at"',
    '"actions"',
  ].every((column) => config.includes(column)) &&
    !config.includes('| "status"') &&
    !config.includes('| "location"'),
  "Column preferences contain the supported publication-aware Project columns",
);
check(
  residentialPage.includes("loadProjectsEntityListResult(initialQuery)") &&
    residentialPage.includes(
      "readAdminColumnPreferences(PROJECTS_RESIDENTIAL_LIST_VIEW_KEY)",
    ) &&
    columnPreferencesOwner.includes("const actor = await requireAdminSession()"),
  "Residential RSC delegates authenticated preferences and hydrates the shared list",
);
check(
  commercialPage.includes("loadProjectsEntityListResult(initialQuery)") &&
    commercialPage.includes(
      "readAdminColumnPreferences(PROJECTS_COMMERCIAL_LIST_VIEW_KEY)",
    ) &&
    columnPreferencesOwner.includes("const actor = await requireAdminSession()"),
  "Commercial RSC delegates authenticated preferences and hydrates the shared list",
);
check(
  !residentialPage.includes("/admin/projects/construction-updates"),
  "Construction updates are excluded from the clean list navigation",
);
check(
  !actions.includes("bulkProjectsActionAjax") &&
    actions.includes("duplicateProjectAjax") &&
    actions.includes("setProjectFeaturedAjax") &&
    actions.includes("setProjectPublicationAjax") &&
    !actions.includes("toggleProjectPublicationAjax") &&
    !actionIndex.includes("bulkProjectsActionAjax") &&
    actionIndex.includes("duplicateProjectAjax") &&
    actionIndex.includes("setProjectFeaturedAjax") &&
    actionIndex.includes("setProjectPublicationAjax") &&
    !actionIndex.includes("toggleProjectPublicationAjax"),
  "Project action boundary exports the approved publication row command and excludes legacy commands",
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
    /\.rpc\(\s*"duplicate_project_admin_entry"/.test(duplication) &&
    duplication.includes('buildCmsAuditAction("project", "duplicate")') &&
    duplication.includes("synchronizeDuplicatedProjectMedia") &&
    duplication.includes("revalidateProjectPaths"),
  "Duplicate command is authenticated, atomic-RPC-owned, audited, media-synchronized, and revalidated",
);
check(
  featuredAction.includes("requireAdminSession") &&
    /\.rpc\(\s*"set_project_featured_admin_entry"/.test(featuredAction) &&
    featuredAction.includes('buildCmsAuditAction("project", "update")') &&
    featuredAction.includes("revalidateProjectPaths"),
  "Featured command writes desired authoritative state through the authenticated audited Project boundary",
);
check(
  publicationAction.includes("requireAdminSession") &&
    publicationAction.includes("assessProjectEntryPayload") &&
    publicationAction.includes("getProjectPublishingReadiness") &&
    /\.rpc\(\s*"set_project_publication_admin_entry"/.test(publicationAction) &&
    publicationAction.includes('buildCmsAuditAction(') &&
    publicationAction.includes("revalidateProjectPaths"),
  "Publication command validates readiness and writes through the authenticated audited Project boundary",
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
  publicLoader.includes('"publication_status", "published_at"') &&
    publicLoader.includes('.eq("publication_status", "published")') &&
    publicMapper.includes("featured: project.featured === true") &&
    publicHelpers.includes("projects.filter((project) => project.featured)") &&
    publicHelpers.includes("return `/projects/${project.slug}`") &&
    publicHelpers.includes("return absoluteUrlWithBase(getProjectHref(project))"),
  "Public Project loader filters authoritative publication before mapping and shared public-link derivation",
);
checkAbsent(
  "scripts/qa-admin-instant-projects.mjs",
  "Obsolete destructive legacy Project QA surface is removed",
);
check(
  migration.includes("drop function if exists public.admin_list_projects") &&
    !migration.includes("create or replace function public.admin_list_projects") &&
    publishingMigration.includes(
      "create or replace function public.admin_list_projects",
    ) &&
    publishingMigration.includes("p_publication_status text default 'all'"),
  "The publishing capability restores a new publication-owned list RPC after the legacy RPC removal",
);

const normalized = normalizeAdminEntityListQuery(
  projectsQueryContract,
  "type=commercial&q=  Nile   Tower  &page=2&limit=20&sort=english_name_asc&featured=yes&publication_status=published",
);
check(
  normalized.filters.projectType === "commercial" &&
    normalized.filters.featured === "yes" &&
    normalized.filters.publicationStatus === "published" &&
    normalized.search === "Nile Tower" &&
    normalized.page === 2 &&
    normalized.pageSize === 20 &&
    normalized.sort.field === "english_name" &&
    normalized.sort.direction === "asc",
  "Project URL state normalizes search, publication filters, paging, type, and sort",
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
    written.get("featured") === "yes" &&
    written.get("publication_status") === "published",
  "Project URL serialization preserves authoritative publication state",
);
let invalidPublicationRejected = false;
try {
  parseAdminEntityListRequestQuery(
    projectsQueryContract,
    "type=residential&publication_status=archived",
  );
} catch {
  invalidPublicationRejected = true;
}
check(
  invalidPublicationRejected,
  "Strict Project request boundary rejects unsupported publication states",
);

if (failures.length > 0) {
  console.error("verify-admin-instant-projects FAILED:");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`verify-admin-instant-projects OK (${passed} checks)`);
