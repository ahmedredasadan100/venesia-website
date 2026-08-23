/**
 * Verifies composite slot render-plan wiring and prevents cross-family Content sources.
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

const layout = read("src/components/page-composition/PageSlotLayout.tsx");
const plan = read("src/components/page-composition/build-slot-render-plan.ts");
const nodes = read("src/components/page-composition/slot-module-nodes.tsx");

assert(layout.includes("buildSlotRenderPlan"), "PageSlotLayout must use buildSlotRenderPlan");
assert(
  !layout.includes("blocks={[entry.block]}"),
  "PageSlotLayout must not render singleton block arrays (breaks peer composites)",
);
assert(plan.includes("SLOT_COMPOSITE_RELATIONSHIPS"), "Composite relationships catalog missing");
assert(plan.includes("contact-office-form"), "Contact composite relationship missing");
assert(
  !plan.includes("about-intro-beats") && !plan.includes("about-documentary-beats"),
  "Content composition must not declare a Cards template as an About intro data peer",
);
assert(nodes.includes('slug === "contact-form-office" || slug === "contact-form"'), "Contact pairing missing");
assert(nodes.includes('bySlug.get("contact-form-office")'), "Contact office peer lookup missing");
assert(
  nodes.includes("mapAboutIntroBeatsFromBlock(block)") &&
    !nodes.includes('bySlug.get("about-documentary-beats")') &&
    !nodes.includes("mapAboutDocumentaryBeatsBlock"),
  "About intro beats must come only from the Content template config",
);
assert(nodes.includes("consumed.add"), "Peer consumption via consumed set missing");
assert(plan.includes("buildSlotModuleNodes(blocks"), "Plan must batch blocks into buildSlotModuleNodes");
assert(plan.includes('kind: "feed"'), "Plan must keep feed items separate");

if (failures.length) {
  console.error("verify-composite-slot-rendering FAILED:");
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}

console.log("verify-composite-slot-rendering OK");
