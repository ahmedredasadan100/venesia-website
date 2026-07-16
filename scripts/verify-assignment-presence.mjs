/**
 * Verifies assignment-presence vs renderable composition flags (Phase 1B).
 * Source-level only — no DB writes.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const failures = [];

function read(relPath) {
  const full = resolve(root, relPath);
  if (!existsSync(full)) {
    failures.push(`Missing file: ${relPath}`);
    return "";
  }
  return readFileSync(full, "utf8");
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const blocks = read("src/lib/page-blocks/load-page-blocks.ts");
const composition = read("src/lib/page-blocks/load-page-composition.ts");
const types = read("src/lib/page-blocks/page-composition-types.ts");
const feeds = read("src/lib/feed-modules/load-feed-modules.ts");
const topics = read("src/app/(site)/topics/page.tsx");
const homePlan = read("src/components/home/build-home-main-render-plan.ts");

assert(types.includes("hasAnyAssignmentRows"), "PageComposition must expose hasAnyAssignmentRows");
assert(types.includes("hasRenderableModules"), "PageComposition must expose hasRenderableModules");
assert(types.includes("hasCompositionError"), "PageComposition must expose hasCompositionError");
assert(blocks.includes("hasAnyAssignmentRows"), "PageBlockLoadResult must expose hasAnyAssignmentRows");
assert(blocks.includes("assignmentRowCount"), "Block loader must count assignment rows before filters");
assert(blocks.includes("hasCompositionError"), "Block loader must surface query errors");
assert(
  blocks.includes("hasAssignments: hasRenderableModules"),
  "hasAssignments must alias hasRenderableModules for compatibility",
);
assert(feeds.includes("loadFeedModuleStateForPageSlug"), "Feed state loader missing");
assert(feeds.includes("hasAnyAssignmentRows"), "Feed state must expose hasAnyAssignmentRows");
assert(composition.includes("hasAnyAssignmentRows"), "Composition must OR block+feed presence");
assert(
  topics.includes("hasAnyAssignmentRows") && topics.includes("hasCompositionError"),
  "Topics must gate CMS layout on presence OR composition error",
);
assert(
  !topics.includes("composition.hasAssignments"),
  "Topics must not use post-filter hasAssignments as CMS vs static gate",
);
assert(
  homePlan.includes("hiddenHomeModuleSlugs") || homePlan.includes("hiddenHomeSlugs"),
  "Home hide-suppress path must remain intact",
);

if (failures.length) {
  console.error("verify-assignment-presence FAILED:");
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}

console.log("verify-assignment-presence OK");
