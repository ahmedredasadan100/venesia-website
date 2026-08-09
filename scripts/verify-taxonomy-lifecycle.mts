import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0;

function read(path: string) {
  return readFileSync(resolve(ROOT, path), "utf8").replace(/\r\n?/gu, "\n");
}

function check(label: string, condition: unknown) {
  if (!condition) throw new Error(`FAIL: ${label}`);
  passed += 1;
  console.log(`PASS: ${label}`);
}

function hasActiveFilter(source: string, table: string) {
  const tableIndex = source.indexOf(`.from("${table}")`);
  if (tableIndex < 0) return false;
  const nextQuery = source.indexOf(".from(", tableIndex + 1);
  const slice = source.slice(
    tableIndex,
    nextQuery < 0 ? source.length : nextQuery,
  );
  return slice.includes('.is("deleted_at", null)');
}

const migration = read(
  "sql/migrations/20260808120000_taxonomy_lifecycle_contract.sql",
);
const mutations = read("src/lib/admin/content/taxonomy-mutations.ts");
const categoryActions = read("src/app/admin/content/categories/actions.ts");
const seriesActions = read("src/app/admin/content/series/actions.ts");
const categoryContract = read(
  "src/lib/admin/content/entity-list-contracts/categories.ts",
);
const seriesContract = read(
  "src/lib/admin/content/entity-list-contracts/series.ts",
);
const categoryAdapter = read(
  "src/lib/admin/content/entity-list-adapters/categories.ts",
);
const seriesAdapter = read(
  "src/lib/admin/content/entity-list-adapters/series.ts",
);
const categoryClient = read(
  "src/app/admin/content/categories/CategoriesListClient.tsx",
);
const seriesClient = read(
  "src/app/admin/content/series/SeriesTableClient.tsx",
);
const topicsClient = read("src/components/admin/content/TopicsListClient.tsx");
const trashHeader = read(
  "src/components/admin/entity-list/AdminEntityTrashHeader.tsx",
);

check(
  "Category lifecycle adds deleted_at and its lookup index",
  migration.includes(
    "alter table public.topic_categories\n  add column if not exists deleted_at",
  ) && migration.includes("topic_categories_deleted_at_idx"),
);
check(
  "Category and Series list owners expose active/trash view separation",
  migration.includes("p_view text default 'active'") &&
    migration.includes("p_view must be active or trash") &&
    categoryAdapter.includes("p_view: query.filters.view") &&
    seriesAdapter.includes("p_view: query.filters.view"),
);
check(
  "Both query contracts round-trip only active or trash",
  [categoryContract, seriesContract].every(
    (source) =>
      source.includes('z.enum(["active", "trash"])') &&
      source.includes('params.set("view", "trash")'),
  ),
);

const lifecycleRpcs = [
  "admin_move_topic_categories_to_trash",
  "admin_restore_topic_categories",
  "admin_permanently_delete_topic_categories",
  "admin_move_topic_series_to_trash",
  "admin_restore_topic_series",
  "admin_permanently_delete_topic_series",
];
for (const rpc of lifecycleRpcs) {
  check(
    `${rpc} is defined once and adopted by the Taxonomy mutation owner`,
    migration.includes(`function public.${rpc}`) && mutations.includes(`"${rpc}"`),
  );
}

check(
  "Legacy hard-delete RPCs are retired and no longer called",
  migration.includes(
    "drop function if exists public.admin_delete_topic_category",
  ) &&
    migration.includes(
      "drop function if exists public.admin_delete_topic_series",
    ) &&
    !mutations.includes('"admin_delete_topic_category"') &&
    !mutations.includes('"admin_delete_topic_series"'),
);
check(
  "Lifecycle never transfers, detaches, cascades, or writes Topic relationships",
  !migration.includes("update public.topics") &&
    !migration.includes("delete from public.topics") &&
    migration.includes("categories still have linked topics") &&
    migration.includes("categories still have linked series") &&
    migration.includes("categories still have child categories") &&
    migration.includes("series still have linked topics"),
);
check(
  "Only permanent lifecycle RPCs delete taxonomy rows",
  (migration.match(/delete from public\.topic_categories/g) ?? []).length === 1 &&
    (migration.match(/delete from public\.topic_series/g) ?? []).length === 1 &&
    migration.includes("deleted_at = statement_timestamp()"),
);
check(
  "Restore is unpublished and validates slug and parent/category availability",
  migration.includes("status = 'unpublished'") &&
    migration.includes("category restore slug conflict") &&
    migration.includes("series restore slug conflict") &&
    migration.includes("category restore parent is unavailable") &&
    migration.includes("series restore category is unavailable"),
);
check(
  "Category and Series server actions route every lifecycle operation through the canonical owner",
  categoryActions.includes("moveTopicCategoriesToTrashAtomically") &&
    categoryActions.includes("restoreTopicCategoriesAtomically") &&
    categoryActions.includes("permanentlyDeleteTopicCategoriesAtomically") &&
    seriesActions.includes("moveTopicSeriesToTrashAtomically") &&
    seriesActions.includes("restoreTopicSeriesAtomically") &&
    seriesActions.includes("permanentlyDeleteTopicSeriesAtomically"),
);
check(
  "Permanent delete requires explicit confirmation and Empty Trash verifies count",
  categoryActions.includes("if (!confirmPermanent)") &&
    seriesActions.includes("if (!confirmPermanent)") &&
    categoryActions.includes("categories.length !== input.expectedCount") &&
    seriesActions.includes("seriesRows.length !== input.expectedCount"),
);
check(
  "Categories, Series, and Topics adopt one shared Trash header",
  [categoryClient, seriesClient, topicsClient].every((source) =>
    source.includes("AdminEntityTrashHeader"),
  ) &&
    trashHeader.includes("floating.openConfirmation") &&
    trashHeader.includes("useAdminFeedback"),
);
check(
  "Taxonomy Trash supports restore and permanent-delete bulk actions",
  [categoryClient, seriesClient].every(
    (source) =>
      source.includes('value: "restore"') &&
      source.includes('value: "permanent_delete"') &&
      source.includes("getBulkConfirmation"),
  ),
);
const categoryLifecycleClient = categoryClient.slice(
  categoryClient.indexOf("const runLifecycleMutation"),
  categoryClient.indexOf("const remove", categoryClient.indexOf("const runLifecycleMutation")),
);
const seriesLifecycleClient = seriesClient.slice(
  seriesClient.indexOf("const runLifecycleMutation"),
  seriesClient.indexOf("const deleteSeries", seriesClient.indexOf("const runLifecycleMutation")),
);
check(
  "Taxonomy row lifecycle delegates the single success invalidation to the Instant Runtime",
  [categoryLifecycleClient, seriesLifecycleClient].every(
    (source) =>
      source.includes("instant.mutateAsync({") &&
      !source.includes("controller.invalidate()"),
  ),
);
check(
  "Taxonomy cache invalidation stays inside the original owning paths",
  categoryActions.includes('revalidatePath("/admin/content/categories")') &&
    categoryActions.includes('revalidatePath("/admin/content/topics")') &&
    !categoryActions.includes('revalidatePath("/admin/content/series")') &&
    seriesActions.includes('revalidatePath("/admin/content/series")') &&
    seriesActions.includes('revalidatePath("/admin/content/topics")') &&
    !seriesActions.includes('revalidatePath("/admin/content/categories")'),
);
check(
  "Retired category delete adapter files are absent",
  !existsSync(
    resolve(
      ROOT,
      "src/app/admin/content/categories/CategoryDeleteButton.tsx",
    ),
  ) &&
    !existsSync(
      resolve(ROOT, "src/lib/admin/content/category-delete-guard.ts"),
    ) &&
    !existsSync(
      resolve(ROOT, "src/lib/admin/entity-list/pre-delete-validation.ts"),
    ),
);

const activeReadFiles: Array<[string, string]> = [
  ["src/lib/admin/content/load-taxonomy-form-data.ts", "topic_categories"],
  ["src/lib/admin/content/load-taxonomy-form-data.ts", "topic_series"],
  ["src/app/admin/content/topics/page.tsx", "topic_categories"],
  ["src/app/admin/content/topics/page.tsx", "topic_series"],
  ["src/lib/feed-modules/load-topic-filter-options.ts", "topic_categories"],
  ["src/lib/feed-modules/load-topic-filter-options.ts", "topic_series"],
  ["src/lib/admin/links/providers/resources.ts", "topic_categories"],
  ["src/lib/admin/links/providers/resources.ts", "topic_series"],
];
for (const [path, table] of activeReadFiles) {
  check(
    `${path} hides trashed ${table} rows`,
    hasActiveFilter(read(path), table),
  );
}

console.log(`Taxonomy lifecycle verification passed (${passed} checks).`);
