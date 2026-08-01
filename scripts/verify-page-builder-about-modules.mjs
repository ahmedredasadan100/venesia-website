/**
 * Verifies page-builder assignment duplicate affordances and about-intro-single-image wiring.
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

const row = read("src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentRow.tsx");
const sharedRowActions = read(
  "src/components/admin/ui/AdminDataGridRowActions.tsx",
);
const action = read("src/app/admin/pages-blocks/pages/page-actions/assignment-duplicate.ts");
const client = read("src/components/admin/page-blocks/ContentModuleEditClient.tsx");
const editor = read(
  "src/components/admin/page-blocks/editors/AboutIntroSingleImageModuleEditor.tsx",
);
const section = read("src/components/modules/AboutIntroSingleImageModuleSection.tsx");
const migration = read("sql/migrations/20250715120000_about_intro_single_image_module.sql");
const registry = read("src/lib/page-blocks/module-edit-registry.ts");
const slots = read("src/components/page-composition/slot-module-nodes.tsx");

assert(
  row.includes("duplicate: manageable") &&
    row.includes("onSelect: onDuplicate") &&
    row.includes("<AdminDataGridRowActions capability={capability}"),
  "Page assignment row must expose duplicate through Shared Row Actions",
);
assert(
  sharedRowActions.includes('dataGridAction: "duplicate"') &&
    sharedRowActions.includes('label: "نسخ"'),
  "Shared duplicate action label missing",
);
assert(action.includes("export async function duplicateAssignedPageModule"), "duplicateAssignedPageModule missing");
assert(action.includes('moduleKind === "hero"'), "Hero duplicate branch missing");
assert(action.includes("is_visible: false"), "Copied assignment must be hidden");
assert(action.includes("deleteTemplateOrphan"), "Orphan template cleanup missing");
assert(client.includes('editorKey === "about-intro-single-image"') || client.includes("isAboutIntroSingleImage"), "Single-image editor key wiring missing");
assert(client.includes('isVisionGoals'), "Vision goals chrome flag missing");
assert(
  client.includes("const usesAboutStructuredChrome =") &&
    client.includes("isAboutIntro || isAboutIntroSingleImage || isVisionGoals") &&
    client.includes("usesUnifiedModuleChrome || usesProjectsHubHeader ? null"),
  "Module hints must be gated for vision-goals / single-image",
);
assert(client.includes('title="الرؤية والأهداف"'), "Vision goals header title missing");
assert(editor.includes('name="image_position"'), "imagePosition field missing");
assert(!editor.includes("image_secondary"), "Single-image editor must not expose secondary image");
assert(section.includes('aspect-[16/12]'), "Public single-image frame aspect missing");
assert(section.includes('dir="ltr"'), "Explicit LTR grid order missing");
assert(migration.includes("about-intro-single-image"), "Migration slug missing");
assert(migration.includes("where slug = 'about-intro'"), "Migration must look up about-intro by slug");
assert(registry.includes('"about-intro-single-image"'), "Editor registry key missing");
assert(slots.includes("AboutIntroSingleImageModuleSection"), "Public slot renderer missing");
assert(slots.includes("isAboutIntroSingleImageContentBlock"), "Public detector missing");

if (failures.length) {
  console.error("verify-page-builder-about-modules FAILED:");
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}

console.log("verify-page-builder-about-modules OK");
