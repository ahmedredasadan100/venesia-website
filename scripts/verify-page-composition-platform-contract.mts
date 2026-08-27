import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  PAGE_COMPOSITION_POSITIONS,
  isPageCompositionPosition,
} from "../src/lib/page-composition/positions.ts";
import {
  MODULE_POSITION_CAPABILITIES,
  getAssignablePositions,
} from "../src/lib/page-composition/page-assignment-contract.ts";

const root = resolve(process.cwd());
const read = (path: string) =>
  readFileSync(resolve(root, path), "utf8").replace(/\r\n?/gu, "\n");
const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");
const importSources = (source: string) =>
  [...source.matchAll(/from\s+["']([^"']+)["']/gu)].map((match) => match[1]);

const positionInventory = read("src/lib/page-composition/positions.ts");
const assignmentContract = read("src/lib/page-composition/page-assignment-contract.ts");
const assignmentTypes = read("src/lib/page-blocks/types.ts");
const assignmentQueries = read("src/lib/page-blocks/admin-queries.ts");
const assignmentCreate = read("src/app/admin/pages-blocks/pages/page-actions/assignment-create.ts");
const assignmentUpdate = read("src/app/admin/pages-blocks/pages/page-actions/assignment-update.ts");
const compositionTypes = read("src/lib/page-blocks/page-composition-types.ts");
const compositionLoader = read("src/lib/page-blocks/load-page-composition.ts");
const moduleMetadata = read("src/lib/page-composition/module-registry-metadata.ts");
const venisiaThemeOrder = read("src/components/page-composition/venisia-theme-regions.ts");
const venisiaThemeRenderer = read("src/components/page-composition/PageSlotLayout.tsx");
const projectsThemeRenderer = read("src/components/projects/ProjectsHubModulesRenderer.tsx");

assert.deepEqual(PAGE_COMPOSITION_POSITIONS, ["main", "sidebar", "bottom", "footer", "hero"]);
assert.equal(new Set(PAGE_COMPOSITION_POSITIONS).size, PAGE_COMPOSITION_POSITIONS.length);
for (const position of PAGE_COMPOSITION_POSITIONS) {
  assert.match(position, /^[a-z][a-z0-9-]*$/u, `${position} is not a stable Region identifier`);
  assert.equal(isPageCompositionPosition(position), true);
}
assert.equal(isPageCompositionPosition("right-column"), false);
assert.equal(isPageCompositionPosition("mobile-drawer"), false);

assert.deepEqual(importSources(positionInventory), [], "Region inventory must have no upstream owner");
assert.deepEqual(
  importSources(assignmentContract).sort(),
  ["../page-blocks/types.ts", "./positions.ts"].sort(),
  "Position Contract may depend only on Region identifiers and semantic Module kinds",
);

const executablePlatformSource = withoutComments(`${positionInventory}\n${assignmentContract}`);
assert.doesNotMatch(
  executablePlatformSource,
  /Venesia|pageSlug|routeName|templateSlug|templateVariant|preferredSlot|layoutMode|className|grid|columns?|breakpoint|(?:sm|md|lg|xl|2xl):|direction|inline-start|inline-end|left|right|drawer|width|height/iu,
  "Platform Position executable contract leaked Theme, Template, CSS, geometry, direction, or responsive details",
);
assert.ok(!moduleMetadata.includes("preferredSlot"), "Template metadata must not recommend Position");

for (const [kind, capability] of Object.entries(MODULE_POSITION_CAPABILITIES)) {
  const positions = getAssignablePositions(kind);
  if (capability.mode === "page") {
    assert.deepEqual(positions, PAGE_COMPOSITION_POSITIONS, `${kind} narrowed the platform Regions`);
  } else {
    assert.ok(capability.reasonAr, `${kind} Product-fixed Position is missing its Product reason`);
    assert.deepEqual(positions, capability.positions, `${kind} Product-fixed Position drifted`);
  }
}

for (const field of ["page_id", "template_id", "slot", "sort_order", "is_visible"]) {
  assert.ok(assignmentTypes.includes(`${field}:`), `Assignment read model is missing ${field}`);
}
assert.ok(
  assignmentQueries.includes("id,page_id,template_id,slot,sort_order,is_visible,updated_at"),
  "Assignment query must persist and read Position, visibility, and order",
);
for (const mutationSource of [assignmentCreate, assignmentUpdate]) {
  assert.ok(mutationSource.includes("slot"));
  assert.ok(mutationSource.includes("sort_order"));
  assert.ok(mutationSource.includes("is_visible"));
  assert.ok(!mutationSource.includes('formData.get("presentation")'));
}

assert.ok(compositionTypes.includes("slots: Record<PageLayoutSlot, SlotEntry[]>"));
assert.ok(!compositionTypes.includes("layoutMode"), "CMS composition must not carry Theme layout state");
assert.ok(!compositionLoader.includes("layoutMode"));
assert.ok(!compositionLoader.includes("pageSlug,"), "Slug must not enter Position validation");

assert.ok(venisiaThemeOrder.includes("VENISIA_THEME_REGION_RENDER_ORDER"));
assert.ok(venisiaThemeOrder.includes('"hero"'));
assert.ok(venisiaThemeRenderer.includes("xl:grid-cols-[minmax(0,1fr)_340px]"));
assert.ok(venisiaThemeRenderer.includes("xl:[direction:ltr]"));
assert.ok(projectsThemeRenderer.includes("VENISIA_THEME_REGION_RENDER_ORDER"));
assert.ok(projectsThemeRenderer.includes("data-layout-slot={position}"));
for (const themeSource of [venisiaThemeOrder, venisiaThemeRenderer, projectsThemeRenderer]) {
  assert.ok(!themeSource.includes("mutatePageComposition"));
  assert.ok(!themeSource.includes("getSupabase"));
}

assert.ok(!assignmentContract.includes("venisia-theme-regions"));
assert.ok(!positionInventory.includes("venisia-theme-regions"));
assert.ok(!assignmentContract.includes("components/"));
assert.ok(!positionInventory.includes("components/"));

console.log(
  "PASS Page Composition Platform Contract: semantic Region identifiers/order and Assignment Position/visibility/order are CMS-owned; Theme names, Templates, CSS, Grid/Columns, direction, breakpoints, geometry, and visual Region rendering are downstream-only. A Theme replacement consumes the same Regions and Assignments without changing the contract or rebuilding data.",
);
