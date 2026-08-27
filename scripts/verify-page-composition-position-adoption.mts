import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  getAssignablePositions,
  getDefaultAssignmentPosition,
  MODULE_POSITION_CAPABILITIES,
} from "../src/lib/page-composition/page-assignment-contract.ts";
import { PAGE_COMPOSITION_POSITIONS } from "../src/lib/page-composition/positions.ts";
import type { PageModuleKind } from "../src/lib/page-blocks/types.ts";

type AdoptionRow = {
  assignmentStore: string;
  policy: "platform-flexible" | "product-fixed";
  editorSource: string;
  editorMarker: string;
  syncSource: string;
  syncMarker: string;
  publicSource: string;
  publicMarker: string;
  rendererSource: string;
  rendererMarker: string;
};

const ROOT = process.cwd();

function read(relativePath: string) {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function sourceFilesBelow(relativeDirectory: string): string[] {
  const directory = path.join(ROOT, relativeDirectory);
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return sourceFilesBelow(relativePath);
    return /\.[cm]?[jt]sx?$/u.test(entry.name) ? [relativePath] : [];
  });
}

function assertSourceMarker(
  kind: PageModuleKind,
  boundary: string,
  relativePath: string,
  marker: string,
) {
  assert.ok(existsSync(path.join(ROOT, relativePath)), `${kind}: missing ${boundary} ${relativePath}`);
  assert.ok(
    read(relativePath).includes(marker),
    `${kind}: ${boundary} does not expose expected adoption marker ${marker}`,
  );
}

const ADOPTION_MATRIX = {
  hero: {
    assignmentStore: "hero_assignments",
    policy: "product-fixed",
    editorSource: "src/app/admin/pages-blocks/blocks/hero/[id]/page.tsx",
    editorMarker: "getHeroModuleAssignmentContext",
    syncSource: "src/app/admin/pages-blocks/blocks/hero/actions.ts",
    syncMarker: '"replace_hero_template"',
    publicSource: "src/lib/load-hero-section.ts",
    publicMarker: 'getDefaultAssignmentPosition("hero")',
    rendererSource: "src/components/page-composition/PageSlotLayout.tsx",
    rendererMarker: "DynamicHeroSection",
  },
  content: {
    assignmentStore: "page_content_block_assignments",
    policy: "platform-flexible",
    editorSource: "src/app/admin/pages-blocks/blocks/content/[id]/page.tsx",
    editorMarker: 'getModuleAssignmentContext("content"',
    syncSource: "src/app/admin/pages-blocks/blocks/content/actions.ts",
    syncMarker: 'syncBlockModulePageAssignments("content"',
    publicSource: "src/lib/page-blocks/load-page-blocks.ts",
    publicMarker: 'blockType: "content"',
    rendererSource: "src/components/page-composition/build-slot-render-plan.ts",
    rendererMarker: "buildSlotModuleNodes",
  },
  cta: {
    assignmentStore: "page_cta_block_assignments",
    policy: "platform-flexible",
    editorSource: "src/app/admin/pages-blocks/blocks/cta/[id]/page.tsx",
    editorMarker: 'getModuleAssignmentContext("cta"',
    syncSource: "src/app/admin/pages-blocks/blocks/cta/actions.ts",
    syncMarker: 'syncBlockModulePageAssignments("cta"',
    publicSource: "src/lib/page-blocks/load-page-blocks.ts",
    publicMarker: 'blockType: "cta"',
    rendererSource: "src/components/page-composition/build-slot-render-plan.ts",
    rendererMarker: "buildSlotModuleNodes",
  },
  cards: {
    assignmentStore: "page_cards_block_assignments",
    policy: "platform-flexible",
    editorSource: "src/app/admin/pages-blocks/blocks/cards/[id]/page.tsx",
    editorMarker: 'getModuleAssignmentContext("cards"',
    syncSource: "src/app/admin/pages-blocks/blocks/cards/actions.ts",
    syncMarker: 'syncBlockModulePageAssignments("cards"',
    publicSource: "src/lib/page-blocks/load-page-blocks.ts",
    publicMarker: 'blockType: "cards"',
    rendererSource: "src/components/page-composition/build-slot-render-plan.ts",
    rendererMarker: "buildSlotModuleNodes",
  },
  breadcrumb: {
    assignmentStore: "page_breadcrumb_block_assignments",
    policy: "platform-flexible",
    editorSource: "src/app/admin/pages-blocks/blocks/breadcrumb/[id]/page.tsx",
    editorMarker: 'getModuleAssignmentContext("breadcrumb"',
    syncSource: "src/app/admin/pages-blocks/blocks/breadcrumb/actions.ts",
    syncMarker: 'syncBlockModulePageAssignments("breadcrumb"',
    publicSource: "src/lib/page-blocks/load-page-blocks.ts",
    publicMarker: 'blockType: "breadcrumb"',
    rendererSource: "src/components/page-composition/build-slot-render-plan.ts",
    rendererMarker: "buildSlotModuleNodes",
  },
  feed: {
    assignmentStore: "page_feed_module_assignments",
    policy: "platform-flexible",
    editorSource: "src/app/admin/pages-blocks/blocks/feed/[id]/page.tsx",
    editorMarker: 'getModuleAssignmentContext("feed"',
    syncSource: "src/app/admin/pages-blocks/blocks/feed/actions.ts",
    syncMarker: 'syncBlockModulePageAssignments("feed"',
    publicSource: "src/lib/page-blocks/load-page-composition.ts",
    publicMarker: 'isAssignmentPositionAllowed("feed", feed.slot)',
    rendererSource: "src/components/page-composition/PageSlotLayout.tsx",
    rendererMarker: "FeedModuleSection",
  },
  "media-sidebar": {
    assignmentStore: "page_media_sidebar_module_assignments",
    policy: "platform-flexible",
    editorSource: "src/app/admin/pages-blocks/blocks/media-sidebar/[id]/page.tsx",
    editorMarker: "getMediaSidebarModuleAssignmentContext",
    syncSource: "src/app/admin/pages-blocks/blocks/media-sidebar/actions.ts",
    syncMarker: "syncMediaSidebarModulePageAssignments",
    publicSource: "src/lib/media-sidebar-modules/load-media-sidebar-modules.ts",
    publicMarker: "slot: normalizeLayoutSlot(row.slot)",
    rendererSource: "src/components/page-composition/PageSlotLayout.tsx",
    rendererMarker: "MediaSidebarWidget",
  },
  "media-hub": {
    assignmentStore: "page_media_hub_module_assignments",
    policy: "platform-flexible",
    editorSource: "src/app/admin/pages-blocks/blocks/media-hub/[id]/page.tsx",
    editorMarker: "getMediaHubModuleAssignmentContext",
    syncSource: "src/app/admin/pages-blocks/blocks/media-hub/actions.ts",
    syncMarker: "syncMediaHubModulePageAssignments",
    publicSource: "src/lib/media-hub-modules/load-media-hub-modules.ts",
    publicMarker: "slot: normalizeLayoutSlot(row.slot)",
    rendererSource: "src/components/page-composition/VenesiaThemeMediaHubLayout.tsx",
    rendererMarker: "renderVenesiaThemeMediaHubNodes",
  },
} as const satisfies Record<PageModuleKind, AdoptionRow>;

const ASSIGNABLE_MODULE_KINDS = Object.keys(
  MODULE_POSITION_CAPABILITIES,
) as PageModuleKind[];

assert.deepEqual(
  Object.keys(ADOPTION_MATRIX).sort(),
  [...ASSIGNABLE_MODULE_KINDS].sort(),
  "Position adoption matrix must cover every assignable Page Module kind",
);
const assignmentTypes = read("src/lib/page-blocks/types.ts");
assert.ok(assignmentTypes.includes("export const PAGE_MODULE_KINDS"));
assert.ok(assignmentTypes.includes('"hero", ...PAGE_BLOCK_TYPES, "media-sidebar", "media-hub"'));
assert.ok(read("src/lib/page-composition/page-assignment-contract.ts").includes("Record<\n  PageModuleKind,"));

for (const kind of ASSIGNABLE_MODULE_KINDS) {
  const row = ADOPTION_MATRIX[kind];
  const capability = MODULE_POSITION_CAPABILITIES[kind];
  assert.equal(
    row.policy,
    capability.mode === "page" ? "platform-flexible" : "product-fixed",
    `${kind}: adoption matrix policy drifted from the canonical contract`,
  );

  const positions = getAssignablePositions(kind);
  assert.ok(positions.length > 0, `${kind}: no assignable Position`);
  assert.equal(getDefaultAssignmentPosition(kind), positions[0]);
  if (row.policy === "platform-flexible") {
    assert.deepEqual(positions, PAGE_COMPOSITION_POSITIONS, `${kind}: local Position narrowing detected`);
  }

  assertSourceMarker(kind, "editor read", row.editorSource, row.editorMarker);
  assertSourceMarker(kind, "editor sync", row.syncSource, row.syncMarker);
  assertSourceMarker(kind, "public read", row.publicSource, row.publicMarker);
  assertSourceMarker(kind, "renderer", row.rendererSource, row.rendererMarker);
}

const pageClient = read("src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx");
const assignmentModal = read("src/app/admin/pages-blocks/pages/[id]/page-blocks/use-page-blocks-assign-modal.ts");
const assignmentModalView = read("src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignModal.tsx");
const assignmentCreate = read("src/app/admin/pages-blocks/pages/page-actions/assignment-create.ts");
const assignmentUpdate = read("src/app/admin/pages-blocks/pages/page-actions/assignment-update.ts");
const assignmentSync = read("src/lib/page-blocks/sync-module-page-assignments.ts");
const adminRead = read("src/lib/page-blocks/admin-queries.ts");
const compositionLoader = read("src/lib/page-blocks/load-page-composition.ts");
const projectsLoader = read("src/lib/projects/load-projects-hub-composition.ts");
const projectsPlan = read("src/lib/projects/build-projects-hub-render-plan.ts");

assert.ok(pageClient.includes("getAssignablePositions(row.module_kind)"));
assert.ok(pageClient.includes("PAGE_COMPOSITION_POSITIONS"));
assert.ok(assignmentModal.includes("getSlotOptions(assignModuleKind)"));
assert.ok(assignmentModalView.includes('name="slot"'));
assert.ok(assignmentCreate.includes("positionPolicyFailure(options.kind, options.slot)"));
assert.ok(
  assignmentCreate.includes('cleanText(formData.get("slot")) || getDefaultAssignmentPosition("media-sidebar")') &&
    assignmentCreate.includes('cleanText(formData.get("slot")) || getDefaultAssignmentPosition("media-hub")'),
  "specialized Media create actions must persist the selected Assignment Position",
);
assert.ok(assignmentUpdate.includes("positionPolicyFailure(kind, slot)"));
assert.ok(assignmentSync.includes("getDefaultAssignmentPosition(moduleKind)"));
assert.doesNotMatch(assignmentSync, /defaultSlotFor|default_slot:\s*["']/u);
assert.ok(adminRead.includes("PAGE_COMPOSITION_POSITIONS.indexOf(normalizeLayoutSlot(slot))"));
assert.doesNotMatch(adminRead, /slot\s*===\s*["']top["']/u);
assert.ok(compositionLoader.includes("PAGE_COMPOSITION_POSITIONS.map"));
assert.ok(compositionLoader.includes("isAssignmentPositionAllowed(block.blockType, block.slot)"));
assert.ok(compositionLoader.includes('isAssignmentPositionAllowed("media-sidebar", widget.slot)'));
assert.ok(compositionLoader.includes("slots[widget.slot].push"));
assert.ok(compositionLoader.includes('isAssignmentPositionAllowed("media-hub", hubModule.slot)'));
assert.ok(compositionLoader.includes("slots[hubModule.slot].push"));
assert.doesNotMatch(
  read("src/lib/media-sidebar-modules/load-media-sidebar-modules.ts"),
  /\.eq\(["']slot["']/u,
);
assert.doesNotMatch(
  read("src/lib/media-hub-modules/load-media-hub-modules.ts"),
  /\.eq\(["']slot["']/u,
);
assert.ok(projectsLoader.includes("slot: normalizeLayoutSlot(row.slot)"));
assert.ok(projectsPlan.includes("position: assignment.slot"));
assert.doesNotMatch(projectsPlan, /slot\s*!==\s*["']main["']/u);

const oldRuntimePolicy = path.join(ROOT, "src/lib/page-composition/route-slot-policy.ts");
assert.equal(existsSync(oldRuntimePolicy), false, "old route-specific Position policy still exists");

const mediaPositionMigration = read(
  "sql/migrations/20260827122828_page_composition_media_position_adoption.sql",
);
for (const constraint of [
  "page_media_hub_module_assignments_slot_check",
  "page_media_sidebar_module_assignments_slot_check",
]) {
  assert.ok(
    mediaPositionMigration.includes(`drop constraint if exists ${constraint}`),
    `${constraint}: legacy visual-Region constraint is not retired`,
  );
}
assert.doesNotMatch(
  mediaPositionMigration,
  /update\s+public\.page_media_(?:hub|sidebar)_module_assignments/iu,
  "Position adoption must preserve existing Assignment data without rebuilding it",
);

const assignmentStores = Object.values(ADOPTION_MATRIX).map((row) => row.assignmentStore);
const directAssignmentConsumers = sourceFilesBelow("src").filter((sourcePath) => {
  const source = read(sourcePath);
  return assignmentStores.some((store) => source.includes(store));
});
assert.ok(directAssignmentConsumers.length > 0, "assignment Consumer inventory is empty");
for (const sourcePath of directAssignmentConsumers) {
  const source = read(sourcePath);
  assert.doesNotMatch(
    source,
    /preferredSlot|layoutMode|getRouteSlotPolicy|isSlotAllowedForRoute/u,
    `${sourcePath}: old Position policy dependency remains`,
  );
  assert.doesNotMatch(
    source,
    /slot\s*:\s*["'](?:main|sidebar|bottom|footer|hero|top)["']|\.eq\(["']slot["']\s*,\s*["']/u,
    `${sourcePath}: direct Assignment Consumer owns a hard-coded Position`,
  );
}

for (const source of [assignmentCreate, assignmentUpdate, assignmentSync]) {
  assert.doesNotMatch(source, /preferredSlot|layoutMode|getRouteSlotPolicy|isSlotAllowedForRoute/u);
}

console.log("Page Composition Position adoption: PASS\n");
console.log("Module kind | Assignment store | Position policy | Adoption");
console.log("--- | --- | --- | ---");
for (const kind of ASSIGNABLE_MODULE_KINDS) {
  const row = ADOPTION_MATRIX[kind];
  const policy = row.policy === "platform-flexible"
    ? `Platform Regions (${getAssignablePositions(kind).join(", ")})`
    : `Product fixed (${getAssignablePositions(kind).join(", ")})`;
  console.log(`${kind} | ${row.assignmentStore} | ${policy} | Full`);
}

console.log("\nNo route-, page-, Template-, Theme-, CSS-, or local Consumer Position policy remains in the audited Assignment paths.");
