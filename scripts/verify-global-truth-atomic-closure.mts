import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION = "sql/migrations/20260805180000_global_truth_atomic_operations_closure.sql";
const failures: string[] = [];

function read(path: string) {
  return readFileSync(resolve(ROOT, path), "utf8");
}

function check(condition: unknown, message: string) {
  if (!condition) failures.push(message);
}

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const manifest = JSON.parse(read("src/lib/admin/media-catalog/write-adoption-manifest.json")) as {
  globalClosure?: boolean;
  owners?: Array<{ classification?: string }>;
};
check(manifest.globalClosure === true, "Media adoption manifest must set globalClosure=true.");
check(
  !(manifest.owners ?? []).some((owner) => owner.classification === "tooling_unadopted"),
  "Media adoption manifest must contain zero tooling_unadopted owners.",
);

const retiredProjectOwners = [
  "src/config/projects-data.ts",
  "src/lib/projects/seed-from-static-data.ts",
  "src/lib/projects/static-reimport-policy.ts",
];
for (const path of retiredProjectOwners) {
  check(!existsSync(resolve(ROOT, path)), `Static Project owner must be removed: ${path}`);
}

const sourceFiles = [resolve(ROOT, "src"), resolve(ROOT, "scripts")]
  .flatMap(walk)
  .filter((path) => new Set([".ts", ".tsx", ".js", ".mjs", ".mts"]).has(extname(path)))
  .filter((path) => relative(ROOT, path).replaceAll("\\", "/") !== "scripts/verify-global-truth-atomic-closure.mts");

const assignmentTables = new Set([
  "page_content_block_assignments",
  "page_cta_block_assignments",
  "page_cards_block_assignments",
  "page_breadcrumb_block_assignments",
  "page_feed_module_assignments",
  "page_media_sidebar_module_assignments",
  "page_media_hub_module_assignments",
  "hero_assignments",
]);
const mutationNames = new Set(["insert", "update", "upsert", "delete"]);

function tableFromReceiver(node: ts.Node): string | null {
  if (
    ts.isCallExpression(node)
    && ts.isPropertyAccessExpression(node.expression)
    && node.expression.name.text === "from"
    && node.arguments.length === 1
    && ts.isStringLiteralLike(node.arguments[0])
  ) {
    return node.arguments[0].text;
  }
  let result: string | null = null;
  ts.forEachChild(node, (child) => {
    if (result === null) result = tableFromReceiver(child);
  });
  return result;
}

for (const absolutePath of sourceFiles) {
  const source = readFileSync(absolutePath, "utf8");
  const relativePath = relative(ROOT, absolutePath).replaceAll("\\", "/");
  const sourceFile = ts.createSourceFile(
    absolutePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    absolutePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      check(
        !/projects-data|seed-from-static-data|static-reimport-policy/.test(node.moduleSpecifier.text),
        `Static Project import remains in ${relativePath}.`,
      );
    }
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && mutationNames.has(node.expression.name.text)
    ) {
      const table = tableFromReceiver(node.expression.expression);
      if (table && assignmentTables.has(table)) {
        failures.push(`Direct Page Composition writer remains in ${relativePath} (${table}).`);
      }
      if (table === "menu_items") {
        const allowedVisibilityOwner = relativePath === "src/app/admin/pages-blocks/menus/menu-actions/items-status.ts";
        const payload = node.arguments[0];
        const visibilityOnly = payload && ts.isObjectLiteralExpression(payload)
          && payload.properties.every((property) => {
            if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) return false;
            return new Set(["is_visible", "updated_at"]).has(property.name.getText(sourceFile));
          });
        check(
          allowedVisibilityOwner && visibilityOnly,
          `Non-atomic Menu structural writer remains in ${relativePath}.`,
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

const migration = read(MIGRATION);
const catalogMatch = migration.match(/v_projects constant jsonb :=\s*\$projects_json\$([\s\S]*?)\$projects_json\$::jsonb/);
check(Boolean(catalogMatch), "Project transfer catalog is missing from the closure migration.");
if (catalogMatch) {
  const catalog = JSON.parse(catalogMatch[1]) as Array<Record<string, unknown>>;
  check(catalog.length === 13, "Project transfer catalog must contain exactly 13 projects.");
  check(new Set(catalog.map((project) => project.slug)).size === 13, "Project transfer slugs must be unique.");
  check(new Set(catalog.map((project) => project.code)).size === 13, "Project transfer codes must be unique.");
  check(catalog.every((project) => project.code && project.slug && project.image && project.heroImage), "Every transferred Project must preserve root identity and media.");
  check(
    catalog.filter((project) => project.category === "residential").every((project) => {
      const details = project.residentialDetails as Record<string, unknown> | undefined;
      return details?.availableAreas && details?.deliverySpecs && details?.executionJourney && details?.location;
    }),
    "Every residential Project must preserve plans, delivery, execution, and location relations.",
  );
}

for (const marker of [
  "add column if not exists code",
  "save_project_admin_entry_core",
  "create or replace function public.mutate_menu_tree",
  "menu_item_atomic_contract_guard",
  "menu_items_menu_parent_order_unique_idx",
  "create or replace function public.mutate_page_composition",
  "sync_template_pages",
  "page_composition_atomic_guard",
  "page_composition_assignments",
  "pg_advisory_xact_lock",
  "page_composition.legacy_page_sections_removed",
  "drop table public.page_sections",
  "global_truth_atomic_closure_health",
  "grant execute on function public.mutate_menu_tree",
  "grant execute on function public.mutate_page_composition",
]) {
  check(migration.includes(marker), `Closure migration is missing required marker: ${marker}`);
}

const menuActionSources = [
  "items-save.ts", "items-delete.ts", "duplicate.ts", "import.ts", "bulk.ts", "delete.ts", "reorder.ts",
].map((name) => read(`src/app/admin/pages-blocks/menus/menu-actions/${name}`)).join("\n");
check(menuActionSources.includes("mutateMenuTree"), "Menu actions must adopt the atomic owner.");
check(menuActionSources.includes("revalidateNavigation"), "Menu actions must preserve cache/revalidation ownership.");

const pageActionSources = [
  "assignment-create.ts", "assignment-update.ts", "assignment-delete.ts", "assignment-status.ts",
  "assignment-duplicate.ts", "assignment-reorder.ts", "bulk.ts", "page-duplicate.ts", "page-delete.ts",
].map((name) => read(`src/app/admin/pages-blocks/pages/page-actions/${name}`)).join("\n");
check(pageActionSources.includes("mutatePageComposition"), "Page actions must adopt the aggregate atomic owner.");
check(pageActionSources.includes("revalidatePageBlocksPath"), "Page actions must preserve cache/revalidation ownership.");
check(
  read("src/lib/page-blocks/sync-module-page-assignments.ts").includes('.rpc("mutate_page_composition"'),
  "Template-to-page assignment sync must adopt mutate_page_composition.",
);

const closure = {
  media_global_write_adoption_closed: failures.length === 0 && manifest.globalClosure === true,
  hardcoded_project_truth_closed: failures.length === 0,
  menu_atomic_operations_closed: failures.length === 0,
  page_composition_atomic_operations_closed: failures.length === 0,
};

if (failures.length) {
  console.error("Global truth/atomic closure guard failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Global truth/atomic closure guard passed.");
console.log(JSON.stringify(closure, null, 2));
