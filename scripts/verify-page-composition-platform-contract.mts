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
import { VENISIA_THEME_REGION_RENDER_ORDER } from "../src/components/page-composition/venisia-theme-regions.ts";

const root = resolve(process.cwd());
const read = (path: string) =>
  readFileSync(resolve(root, path), "utf8").replace(/\r\n?/gu, "\n");
const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");
const importSources = (source: string) =>
  [...source.matchAll(/from\s+["']([^"']+)["']/gu)].map((match) => match[1]);

type SpaceOwner = "page_composition" | "theme" | "module";
type SpaceOwnershipContract = Readonly<Record<SpaceOwner, readonly string[]>>;

function markdownBullets(source: string) {
  return [...source.matchAll(/^\s*-\s+(.+?)[.;]?\s*$/gmu)].map((match) =>
    match[1].trim(),
  );
}

function spaceOwnershipFailures(
  reference: SpaceOwnershipContract,
  candidate: SpaceOwnershipContract,
) {
  const ownershipFailures = (
    Object.entries(reference) as Array<[SpaceOwner, readonly string[]]>
  ).flatMap(([expectedOwner, concerns]) =>
    concerns.flatMap((concern) => {
      const actualOwners = (
        Object.entries(candidate) as Array<[SpaceOwner, readonly string[]]>
      )
        .filter(([, ownedConcerns]) => ownedConcerns.includes(concern))
        .map(([owner]) => owner);
      return actualOwners.length === 1 && actualOwners[0] === expectedOwner
        ? []
        : [
            `${concern}:expected=${expectedOwner}:actual=${actualOwners.join("+") || "missing"}`,
          ];
    }),
  );
  const referenceConcerns = new Set(Object.values(reference).flat());
  const unexpectedConcerns = (
    Object.entries(candidate) as Array<[SpaceOwner, readonly string[]]>
  ).flatMap(([owner, concerns]) =>
    concerns
      .filter((concern) => !referenceConcerns.has(concern))
      .map((concern) => `${concern}:expected=absent:actual=${owner}`),
  );
  return [...ownershipFailures, ...unexpectedConcerns];
}

function sourceBetween(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `Missing ownership marker: ${startMarker}`);
  assert.ok(end > start, `Missing ownership marker: ${endMarker}`);
  return source.slice(start, end);
}

function regionInventoryFailures(
  expected: readonly string[],
  candidate: readonly string[],
) {
  const expectedSet = new Set(expected);
  const candidateSet = new Set(candidate);
  return [
    ...expected.filter((region) => !candidateSet.has(region)).map(
      (region) => `${region}:missing`,
    ),
    ...candidate.filter((region) => !expectedSet.has(region)).map(
      (region) => `${region}:unknown`,
    ),
    ...(candidateSet.size === candidate.length ? [] : ["duplicate_region"]),
  ];
}

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
const constitution = read("AI_ARCHITECTURE_PRINCIPLES.md");
const ownershipSection = sourceBetween(
  constitution,
  "## 12.7 Page Composition Space and Module Presentation Ownership",
  "\n---",
);
const declaredSpaceOwnership = {
  page_composition: markdownBullets(
    sourceBetween(
      ownershipSection,
      "Page Composition MUST own only the semantic composition contract",
      "Page Composition MUST NOT own or prescribe",
    ),
  ),
  theme: markdownBullets(
    sourceBetween(
      ownershipSection,
      "The active Theme MUST own the outer rendering contract",
      "A Theme MUST consume the complete Page Composition Region and assignment contract",
    ),
  ),
  module: markdownBullets(
    sourceBetween(
      ownershipSection,
      "A module presenter MUST own its internal Presentation",
      "A module MUST adapt to the actual size of its Theme-owned container",
    ),
  ),
} as const satisfies SpaceOwnershipContract;
const adr027 = sourceBetween(
  constitution,
  "## ADR-027 — Page Composition Owns Semantic Regions and Assignments; Theme Owns Outer Layout; Modules Own Presentation",
  "\n---",
);
const adrDecision = sourceBetween(
  adr027,
  "**Decision:**",
  "\n**Consequences:**",
);
const adrOwnerLabels = {
  "Page Composition": "page_composition",
  Theme: "theme",
  Module: "module",
} as const satisfies Readonly<Record<string, SpaceOwner>>;
function adrOwnershipContract(source: string): SpaceOwnershipContract {
  const ownership = {
    page_composition: [] as string[],
    theme: [] as string[],
    module: [] as string[],
  };
  for (const match of source.matchAll(
    /^- \*\*(Page Composition|Theme|Module):\*\* (.+)\.$/gmu,
  )) {
    const owner = adrOwnerLabels[match[1] as keyof typeof adrOwnerLabels];
    ownership[owner] = match[2]
      .split(";")
      .map((concern) => concern.trim())
      .filter(Boolean);
  }
  return ownership;
}
const adrSpaceOwnership = adrOwnershipContract(adrDecision);
const operationalOwnershipMap = read("docs/SYSTEMS_RUNTIMES_CAPABILITIES.md");
const pageCompositionOwnershipRow = operationalOwnershipMap
  .split("\n")
  .find((line) => line.startsWith("| Page Composition and Menus"));
assert.ok(
  pageCompositionOwnershipRow,
  "The operational ownership map must retain its Page Composition and Menus row.",
);
function inlineOwnershipContract(source: string): SpaceOwnershipContract {
  const ownership = {
    page_composition: [] as string[],
    theme: [] as string[],
    module: [] as string[],
  };
  for (const match of source.matchAll(
    /\*\*(Page Composition|Theme|Module):\*\*\s*(.+?)(?=\s+\*\*(?:Page Composition|Theme|Module):\*\*|\s+\|)/gu,
  )) {
    const owner = adrOwnerLabels[match[1] as keyof typeof adrOwnerLabels];
    ownership[owner] = match[2]
      .replace(/[.;]\s*$/u, "")
      .split(";")
      .map((concern) => concern.trim())
      .filter(Boolean);
  }
  return ownership;
}
const operationalSpaceOwnership = inlineOwnershipContract(
  pageCompositionOwnershipRow,
);

assert.ok(PAGE_COMPOSITION_POSITIONS.length > 0, "Region inventory must not be empty");
assert.equal(new Set(PAGE_COMPOSITION_POSITIONS).size, PAGE_COMPOSITION_POSITIONS.length);
for (const position of PAGE_COMPOSITION_POSITIONS) {
  assert.match(position, /^[a-z][a-z0-9-]*$/u, `${position} is not a stable Region identifier`);
  assert.equal(isPageCompositionPosition(position), true);
}
assert.equal(isPageCompositionPosition("right-column"), false);
assert.equal(isPageCompositionPosition("mobile-drawer"), false);

assert.deepEqual(
  spaceOwnershipFailures(adrSpaceOwnership, declaredSpaceOwnership),
  [],
  "Constitution section 12.7 and ADR-027 disagree on Page Composition, Theme, or Module ownership",
);
assert.deepEqual(
  spaceOwnershipFailures(declaredSpaceOwnership, operationalSpaceOwnership),
  [],
  "The operational ownership map contradicts Constitution section 12.7.",
);
assert.match(
  adrDecision,
  /defined normatively in Section 12\.7/u,
  "ADR-027 must identify section 12.7 as the normative concern-level ownership contract",
);
const reversedOwnershipFixture = {
  page_composition: declaredSpaceOwnership.theme,
  theme: declaredSpaceOwnership.page_composition,
  module: declaredSpaceOwnership.module,
} as const satisfies SpaceOwnershipContract;
const reversedOwnershipFailures = spaceOwnershipFailures(
  adrSpaceOwnership,
  reversedOwnershipFixture,
);
const extraConcernOwnershipFailures = spaceOwnershipFailures(
  adrSpaceOwnership,
  {
    ...adrSpaceOwnership,
    theme: [...adrSpaceOwnership.theme, "negative fixture extra concern"],
  },
);
const semanticConcern = adrSpaceOwnership.page_composition[0];
const layoutConcern = adrSpaceOwnership.theme[0];
assert.ok(
  semanticConcern !== undefined &&
    layoutConcern !== undefined &&
    reversedOwnershipFailures.some((failure) =>
      failure.startsWith(
        `${semanticConcern}:expected=page_composition:actual=theme`,
      ),
    ) &&
    reversedOwnershipFailures.some((failure) =>
      failure.startsWith(
        `${layoutConcern}:expected=theme:actual=page_composition`,
      ),
    ),
  "Negative fixture must reject Theme ownership of semantic composition and Page Composition ownership of outer layout",
);
assert.ok(
  extraConcernOwnershipFailures.includes(
    "negative fixture extra concern:expected=absent:actual=theme",
  ),
  "Negative fixture must reject ownership concerns that exist outside the normative contract",
);

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
assert.deepEqual(
  regionInventoryFailures(
    PAGE_COMPOSITION_POSITIONS,
    VENISIA_THEME_REGION_RENDER_ORDER,
  ),
  [],
  "The Venisia Theme must consume every canonical Region exactly once without redefining the inventory.",
);
const regionFixture = PAGE_COMPOSITION_POSITIONS[0];
assert.ok(regionFixture, "Region completeness fixtures require one canonical Region.");
assert.deepEqual(
  regionInventoryFailures(
    PAGE_COMPOSITION_POSITIONS,
    VENISIA_THEME_REGION_RENDER_ORDER.filter(
      (region) => region !== regionFixture,
    ),
  ),
  [`${regionFixture}:missing`],
  "Negative fixture must reject a Theme that narrows the canonical Region contract.",
);
assert.ok(
  regionInventoryFailures(PAGE_COMPOSITION_POSITIONS, [
    ...VENISIA_THEME_REGION_RENDER_ORDER,
    regionFixture,
  ]).includes("duplicate_region"),
  "Negative fixture must reject a duplicate Theme Region.",
);
assert.ok(
  regionInventoryFailures(PAGE_COMPOSITION_POSITIONS, [
    ...VENISIA_THEME_REGION_RENDER_ORDER,
    "negative-fixture-region",
  ]).includes("negative-fixture-region:unknown"),
  "Negative fixture must reject a Theme-defined Region outside the canonical contract.",
);
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
