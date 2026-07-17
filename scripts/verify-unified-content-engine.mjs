/**
 * Static and pure-behavior guardrails for the Unified Content Engine.
 *
 * This intentionally avoids network access so it can run in CI. Live schema
 * contracts are covered separately by verify-unified-content-database.mjs.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function read(path) {
  return readFileSync(resolve(ROOT, path), "utf8");
}

function check(label, condition) {
  if (!condition) failures.push(label);
}

function containsAll(source, values) {
  return values.every((value) => source.includes(value));
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function loadPureTypeScriptModule(path) {
  const output = ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const commonJsModule = { exports: {} };
  Function("exports", "module", output)(commonJsModule.exports, commonJsModule);
  return commonJsModule.exports;
}

const requiredRoutes = [
  "src/app/admin/content/topics/page.tsx",
  "src/app/admin/content/topics/new/page.tsx",
  "src/app/admin/content/topics/[id]/page.tsx",
  "src/app/admin/content/topics/[id]/preview/page.tsx",
  "src/app/admin/content/categories/page.tsx",
  "src/app/admin/content/series/page.tsx",
];
requiredRoutes.forEach((path) => check(`Missing canonical route: ${path}`, existsSync(resolve(ROOT, path))));

for (const legacyRoot of [
  "src/app/admin/topics",
  "src/app/admin/content/articles",
  "src/app/admin/content/media",
  "src/app/admin/media-center",
]) {
  check(
    `Legacy admin engine still has files: ${legacyRoot}`,
    walk(resolve(ROOT, legacyRoot)).length === 0,
  );
}

const adminShell = read("src/components/admin/AdminShell.tsx");
check(
  "Admin navigation must expose the three canonical content links",
  containsAll(adminShell, [
    'href: "/admin/content/topics"',
    'href: "/admin/content/categories"',
    'href: "/admin/content/series"',
  ]),
);
check(
  "Admin navigation must not expose an independent Media Center",
  !adminShell.includes("/admin/media-center") && !adminShell.includes("/admin/content/media"),
);

const contentTypes = loadPureTypeScriptModule("src/lib/admin/content/content-types.ts");
check(
  "Unified registry must contain every supported content_type exactly once",
  JSON.stringify(contentTypes.CONTENT_TYPES) ===
    JSON.stringify(["article", "news", "press", "site_update", "video", "gallery"]),
);
check("Article must resolve to the article editor", contentTypes.resolveContentEditor("article") === "article");
check("News must resolve to the text media editor", contentTypes.resolveContentEditor("news") === "text-media");
check("Press must resolve to the text media editor", contentTypes.resolveContentEditor("press") === "text-media");
check("Site updates must resolve to the text media editor", contentTypes.resolveContentEditor("site_update") === "text-media");
check("Video must resolve to the video editor", contentTypes.resolveContentEditor("video") === "video");
check("Gallery must resolve to the gallery editor", contentTypes.resolveContentEditor("gallery") === "gallery");
check("Unknown content types must not fall back to an editor", contentTypes.resolveContentEditor("unknown") === null);

const editorRoute = read("src/app/admin/content/topics/[id]/page.tsx");
check(
  "Unified editor route must resolve by content_type",
  editorRoute.includes("resolveContentEditor(topic.content_type)"),
);
check(
  "Unified editor route must not resolve by category slug",
  !/resolveContentEditor\s*\([^)]*category/i.test(editorRoute),
);

const hierarchy = loadPureTypeScriptModule("src/lib/admin/content/category-hierarchy.ts");
const hierarchyFixture = [
  { id: 1, name: "Root", slug: "root", parent_id: null, sort_order: 1, is_active: true },
  { id: 2, name: "Child", slug: "child", parent_id: 1, sort_order: 1, is_active: true },
  { id: 3, name: "Grandchild", slug: "grandchild", parent_id: 2, sort_order: 1, is_active: true },
  { id: 4, name: "Other", slug: "other", parent_id: null, sort_order: 2, is_active: true },
];
check(
  "Parent category filtering must include all descendants",
  JSON.stringify(hierarchy.getCategoryAndDescendantIds(hierarchyFixture, 1).sort()) ===
    JSON.stringify([1, 2, 3]),
);
check(
  "Child category filtering must remain scoped to its own branch",
  JSON.stringify(hierarchy.getCategoryAndDescendantIds(hierarchyFixture, 3)) === JSON.stringify([3]),
);
check(
  "Category hierarchy must retain arbitrary depth",
  hierarchy.flattenAdminCategoryTree(hierarchy.buildAdminCategoryTree(hierarchyFixture))[2]?.depth === 2,
);

const loader = read("src/lib/admin/content/load-unified-content.ts");
check("Unified query must use the admin read model", loader.includes('.from("admin_content_topics")'));
check(
  "Search must target title only",
  loader.includes('.ilike("title"') &&
    !loader.includes('.ilike("slug"') &&
    !loader.includes('.ilike("excerpt"') &&
    !loader.includes('.ilike("category_name"'),
);
check(
  "Hierarchical filter must resolve descendant IDs",
  loader.includes("getCategoryAndDescendantIds(categories, filters.categoryId)"),
);
check(
  "Sorting must happen before pagination",
  loader.indexOf("applySort(") < loader.indexOf(").range(from, to)"),
);
check(
  "Sort values must be explicitly allow-listed",
  containsAll(loader, [
    '"id_asc"',
    '"id_desc"',
    '"title_asc"',
    '"title_desc"',
    '"category_asc"',
    '"category_desc"',
    '"views_asc"',
    '"views_desc"',
    '"created_at_asc"',
    '"created_at_desc"',
    '"updated_at_asc"',
    '"updated_at_desc"',
    '"created_by_asc"',
    '"created_by_desc"',
  ]),
);
check(
  "Metrics must query the complete non-deleted topics dataset",
  loader.includes('supabase.from("topics")') &&
    loader.includes('.is("deleted_at", null)') &&
    !/loadUnifiedContentMetrics[\s\S]*?\.range\(/.test(loader),
);

const filters = read("src/components/admin/content/UnifiedContentFilters.tsx");
const searchRoute = read("src/app/admin/content/topics/search/route.ts");
check("Search debounce must be 300–400ms", filters.includes("}, 350)"));
check("Autocomplete requests must be abortable", filters.includes("new AbortController()"));
check("Enter must apply search immediately", filters.includes("onEnter={() => navigate({}, values.q)}"));
check("Autocomplete must support keyboard navigation", containsAll(filters, ['event.key === "ArrowDown"', 'event.key === "ArrowUp"', 'event.key === "Enter"']));
check("Escape must close autocomplete", filters.includes("onEscape={() =>"));
check("Filters must auto-apply and reset pagination", filters.includes('params.delete("page")'));
check("Reset must clear every unified filter", containsAll(filters, ['"q"', '"content_type"', '"category"', '"series"', '"status"', '"featured"', '"page"']));
check(
  "Autocomplete payload must not expose slugs",
  searchRoute.includes('.select("id,title,category_name")') && !searchRoute.includes("slug,"),
);

const columns = read("src/components/admin/content/unified-content-columns.tsx");
check(
  "Required optional columns must be available",
  containsAll(columns, ['key: "id"', 'key: "views"', 'key: "created_at"', 'key: "updated_at"', 'key: "created_by"']),
);
check(
  "Title and actions columns must be fixed",
  /key: "title"[\s\S]*?hideable: false/.test(columns) &&
    /key: "actions"[\s\S]*?hideable: false/.test(columns),
);
check(
  "The title must stay a single-line ellipsis link",
  containsAll(columns, ["min-w-0", "flex-1", "truncate", "whitespace-nowrap"]) &&
    columns.includes("adminContentTopicPath(row.id"),
);
check("The list must not render topic slugs", !columns.includes("row.slug"));
check(
  "Default columns must be title, category, status, and actions",
  /key: "title"[\s\S]*?defaultVisible: true/.test(columns) &&
    /key: "category"[\s\S]*?defaultVisible: true/.test(columns) &&
    /key: "status"[\s\S]*?defaultVisible: true/.test(columns) &&
    /key: "actions"[\s\S]*?defaultVisible: true/.test(columns),
);

const list = read("src/components/admin/content/UnifiedContentList.tsx");
const preferences = read("src/components/admin/ui/AdminColumnVisibilityMenu.tsx");
const dataGrid = read("src/components/admin/ui/AdminDataGrid.tsx");
const rowActions = read("src/components/admin/content/UnifiedContentRowActions.tsx");
const activity = read("src/components/admin/content/AdminContentActivityPopover.tsx");
const actions = read("src/app/admin/content/topics/actions.ts");
check(
  "Table overflow must remain inside its shared container",
  list.includes("<AdminDataGrid") && dataGrid.includes("overflow-x-auto"),
);
check("Bulk actions must use the shared select", list.includes("AdminBulkActionSelect"));
check(
  "Column preferences must persist through the shared menu contract",
  list.includes("onPersist={saveContentTablePreferences}") &&
    preferences.includes("onPersist(next)"),
);
check(
  "Actions must use the shared row action shell and sticky grid capability",
  rowActions.includes("<AdminDataGridActionsCell compact>") &&
    list.includes("AdminDataGridStickyActionsCell"),
);
check(
  "Activity must be click-only",
  activity.includes("onClick={() => setIsOpen") &&
    !activity.includes("onMouseEnter") &&
    !activity.includes("onMouseLeave"),
);
check(
  "Publish failures must use shared feedback with an editor action",
  list.includes("<AdminNotice") &&
    list.includes("فتح المحتوى واستكمال البيانات") &&
    actions.includes('"تعذر نشر المحتوى"'),
);
check(
  "Preferences must be isolated to the authenticated admin",
  actions.includes("admin_user_id: actor.id") &&
    actions.includes('view_key: CONTENT_LIST_VIEW_KEY'),
);
check(
  "Fixed columns must survive preference sanitization",
  list.includes("UNIFIED_CONTENT_COLUMNS.filter(") &&
    list.includes("!column.hideable") &&
    list.includes("visible.push(fixed.key)"),
);

const categoryActions = read("src/app/admin/content/categories/actions.ts");
const colorPicker = read("src/components/admin/content/CategoryColorPicker.tsx");
check("Category colors must be persisted", categoryActions.includes("color_token"));
check("Category color picker must use semantic tones", colorPicker.includes("ADMIN_TONE_PALETTE"));
const tonePalette = loadPureTypeScriptModule("src/lib/admin/content/admin-tone-palette.ts");
check(
  "Database and UI semantic tone allowlists must stay aligned",
  tonePalette.ADMIN_TONE_TOKENS.every((token) =>
    migrationTokenSource().includes(`'${token}'`),
  ),
);

const articleCreate = read("src/app/admin/content/topics/article-actions/create.ts");
const articleUpdate = read("src/app/admin/content/topics/article-actions/update.ts");
const mediaCreate = read("src/app/admin/content/topics/media-actions/create.ts");
const mediaUpdate = read("src/app/admin/content/topics/media-actions/update.ts");
check(
  "Create actions must capture stable actor IDs",
  containsAll(articleCreate, ["created_by: actor.id", "updated_by: actor.id"]) &&
    containsAll(mediaCreate, ["created_by: actor.id", "updated_by: actor.id"]),
);
check(
  "Update actions must capture stable actor IDs",
  articleUpdate.includes("updated_by: actor.id") && mediaUpdate.includes("updated_by: actor.id"),
);
check(
  "Draft saves must not assign a publisher",
  articleCreate.includes('status === "published" ? actor.id : null') &&
    mediaCreate.includes('payload.status === "published" ? actor.id : null'),
);

const migration = read("sql/migrations/20260717070000_unified_content_engine_foundation.sql");
check(
  "Migration must define category colors, actors, preferences, read model, and view counter",
  containsAll(migration, [
    "color_token",
    "created_by",
    "updated_by",
    "published_by",
    "views_count",
    "admin_user_preferences",
    "admin_content_topics",
    "increment_topic_view",
  ]),
);
check("Views must be non-negative", migration.includes("check (views_count >= 0)"));
check(
  "View increments must be atomic and published-only",
  migration.includes("set views_count = views_count + 1") &&
    migration.includes("status = 'published'") &&
    migration.includes("deleted_at is null"),
);

const viewRoute = read("src/app/api/content/topics/[id]/view/route.ts");
const viewTracker = read("src/components/content/TopicViewTracker.tsx");
check("Public view route must accept only a topic ID", viewRoute.includes('rpc("increment_topic_view"'));
check(
  "Client view tracking must deduplicate by session",
  viewTracker.includes("window.sessionStorage.getItem") &&
    viewTracker.includes("window.sessionStorage.setItem"),
);
check(
  "Blocked session storage must not suppress a valid public view",
  !viewTracker.includes("catch {\n      return;"),
);
check(
  "Admin and preview routes must not mount view tracking",
  !editorRoute.includes("TopicViewTracker") &&
    !read("src/app/admin/content/topics/[id]/preview/page.tsx").includes("TopicViewTracker"),
);

const presets = read("src/lib/admin/content-workflow/content-template-presets.ts");
check("Article series must not appear as templates", !presets.includes("من حقك تفهم") && !presets.includes("حكاية بيت"));

const mediaValidation = read("src/app/admin/content/topics/media-actions/validation.ts");
check(
  "Existing inactive media categories must remain editable",
  mediaValidation.includes("currentCategoryId?: number | null") &&
    mediaValidation.includes("normalizedId !== currentCategoryId") &&
    mediaUpdate.includes("currentTopic.category_id"),
);
check(
  "Existing inactive article categories must remain editable",
  editorRoute.includes("category.slug === topic.category_slug") &&
    editorRoute.includes("{ ...category, is_active: true }"),
);

check(
  "Unified bulk action matrix must remain implemented",
  containsAll(actions, [
    'action === "publish"',
    'action === "unpublish"',
    'action === "archive"',
    'action === "delete"',
    'action === "move_category"',
    'action === "feature"',
    'action === "unfeature"',
  ]),
);

const oldAdminRoutePattern = /\/admin\/(?:topics|content\/articles|content\/media|media-center)(?:[/?#"'`]|\b)/;
for (const file of walk(resolve(ROOT, "src"))) {
  if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file)) continue;
  if (oldAdminRoutePattern.test(readFileSync(file, "utf8"))) {
    failures.push(`Old admin route reference in ${relative(ROOT, file).split(sep).join("/")}`);
  }
}

if (failures.length) {
  console.error("FAIL: Unified Content Engine guardrails failed.");
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log("OK: Unified Content Engine architecture and behavior guardrails passed.");

function migrationTokenSource() {
  return read("sql/migrations/20260717070000_unified_content_engine_foundation.sql");
}
