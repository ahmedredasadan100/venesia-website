import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST } from "../src/lib/admin/form-system/adoption-manifest.ts";
import {
  ADMIN_COLLECTION_SURFACE_ADOPTION,
  ADMIN_INTERACTION_COLLECTION_RUNTIME_GAPS,
} from "../src/lib/admin/interaction-system/adoption-manifest.ts";
import { PAGE_COMPOSITION_COLUMN_PREFERENCES } from "../src/lib/page-blocks/admin-collection-columns.ts";
import {
  collectExecutableSourceGraph,
  graphUsesExecutableBinding,
} from "./lib/typescript-executable-graph.mts";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const FORM_RUNTIME_BINDING = [
  {
    sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx",
    exportNames: ["default", "AdminFormRuntime"],
  },
] as const;
const MODAL_BINDING = [
  {
    sourceFile: "src/components/admin/VenesiaModal.tsx",
    exportNames: ["default"],
  },
] as const;
const COLUMN_BINDINGS = [
  {
    sourceFile: "src/components/admin/ui/AdminColumnVisibilityMenu.tsx",
    exportNames: ["default"],
  },
  {
    sourceFile: "src/app/admin/pages-blocks/column-preferences.ts",
    exportNames: ["savePageCompositionColumnPreferences"],
  },
] as const;
const BOUNDED_PAGINATION_BINDING = [
  {
    sourceFile:
      "src/lib/admin/entity-list/bounded-client-pagination.ts",
    exportNames: ["useAdminBoundedClientPagination"],
  },
] as const;

const inScopeFormIds = new Set([
  "pages-quick-create",
  "menu-quick-create",
  "company-identity-settings",
  "users-create-edit",
  "block-template-create-modals",
]);
const inScopeFormEntries = ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.filter((entry) =>
  inScopeFormIds.has(entry.id),
);
assert.equal(
  inScopeFormEntries.length,
  inScopeFormIds.size,
  "Every bounded legacy Form consumer must have one manifest entry.",
);
const registeredFormClassifications = new Set<string>(
  ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.map((entry) => entry.classification),
);
assert.equal(
  registeredFormClassifications.has("legacy_generic_gap"),
  false,
  "The Form Runtime ledger cannot retain a generic legacy gap.",
);

for (const entry of inScopeFormEntries) {
  assert.equal(
    entry.classification,
    "shared_adopter",
    `${entry.id} must be a shared adopter.`,
  );
  assert.ok(entry.sourceFiles.length > 0, `${entry.id} has no source binding.`);
  for (const sourceFile of entry.sourceFiles) {
    assert.ok(
      existsSync(join(ROOT, sourceFile)),
      `${entry.id} registers missing source ${sourceFile}.`,
    );
  }
  const graph = collectExecutableSourceGraph({
    root: ROOT,
    entrySourceFiles: entry.sourceFiles,
  });
  assert.ok(
    graphUsesExecutableBinding({
      root: ROOT,
      graph,
      bindings: FORM_RUNTIME_BINDING,
    }),
    `${entry.id} cannot reach AdminFormRuntime.`,
  );
  if (entry.capabilityAudit.decisions.modal.state === "adopted") {
    assert.ok(
      graphUsesExecutableBinding({ root: ROOT, graph, bindings: MODAL_BINDING }),
      `${entry.id} declares Modal adoption without an executable VenesiaModal binding.`,
    );
  }
}

const preferenceEntries = Object.entries(PAGE_COMPOSITION_COLUMN_PREFERENCES);
assert.equal(
  new Set(preferenceEntries.map(([, config]) => config.viewKey)).size,
  preferenceEntries.length,
  "Page Composition preference view keys must be unique.",
);
for (const [id, config] of preferenceEntries) {
  assert.ok(
    config.columns.some((column) => !column.hideable),
    `${id} must declare an immutable required column.`,
  );
  assert.ok(
    config.consumerSourceFiles.length > 0,
    `${id} has no explicit consumer source registration.`,
  );
  const graph = collectExecutableSourceGraph({
    root: ROOT,
    entrySourceFiles: config.consumerSourceFiles,
  });
  for (const binding of COLUMN_BINDINGS) {
    assert.ok(
      graphUsesExecutableBinding({ root: ROOT, graph, bindings: [binding] }),
      `${id} cannot reach ${binding.sourceFile}.`,
    );
  }
  assert.equal(
    graphUsesExecutableBinding({
      root: ROOT,
      graph,
      bindings: BOUNDED_PAGINATION_BINDING,
    }),
    config.boundedClientPagination,
    `${id} bounded-pagination declaration does not match executable adoption.`,
  );
}

const usersSurface = ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces.find(
  (surface) => surface.id === "users-and-roles",
);
assert.ok(usersSurface, "Admin Users Collection registration is missing.");
assert.equal(usersSurface.workflowClassification, "full_collection_adoption");
assert.deepEqual(usersSurface.dataRegistryEntities, ["admin_users"]);
assert.equal(usersSurface.columnVisibility, "shared_optional_columns");
assert.equal(usersSurface.rowActionsState, "adopted");
assert.equal(usersSurface.paginationState, "adopted");
assert.deepEqual(
  ADMIN_INTERACTION_COLLECTION_RUNTIME_GAPS,
  [],
  "Generic Collection runtime adoption cannot retain a registered gap.",
);

console.log(
  `PASS executable Shared Legacy adoption: ${inScopeFormEntries.length} Form consumers, ${preferenceEntries.length} Page Composition column contracts, and Admin Users Collection.`,
);
