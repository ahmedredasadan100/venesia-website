/**
 * Verify About Intro Single Image module wiring only.
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

const client = read("src/components/admin/page-blocks/ContentModuleEditClient.tsx");
const editor = read(
  "src/components/admin/page-blocks/editors/AboutIntroSingleImageModuleEditor.tsx",
);
const section = read("src/components/modules/AboutIntroSingleImageModuleSection.tsx");
const migration = read("sql/migrations/20250715120000_about_intro_single_image_module.sql");
const registry = read("src/lib/page-blocks/module-edit-registry.ts");
const configs = read("src/lib/page-blocks/configs.ts");
const slots = read("src/components/page-composition/slot-module-nodes.tsx");
const actions = read("src/app/admin/pages-blocks/blocks/content/actions.ts");
const slotRegistry = read("src/lib/page-composition/slot-module-registry.ts");

assert(registry.includes('"about-intro-single-image"'), "Editor registry key missing");
assert(configs.includes("isAboutIntroSingleImageTemplate"), "Config detector missing");
assert(configs.includes("asAboutIntroSingleImageConfig"), "Config parser missing");
assert(configs.includes("AboutIntroSingleImageModuleConfig"), "Config type missing");
assert(client.includes("isAboutIntroSingleImage"), "Single-image editor key wiring missing");
assert(client.includes('title="من نحن — محتوى وصورة واحدة"'), "Single-image header title missing");
assert(client.includes("AboutIntroSingleImageModuleEditor"), "Single-image editor mount missing");
assert(editor.includes('name="image_position"'), "imagePosition field missing");
assert(!editor.includes("image_secondary"), "Single-image editor must not expose secondary image");
assert(!editor.includes('name="config_schema"'), "config_schema must live in ContentModuleEditClient only");
assert(section.includes("aspect-[16/12]"), "Public single-image frame aspect missing");
assert(section.includes('dir="ltr"'), "Explicit LTR grid order missing");
assert(section.includes("if (!content) return null"), "Empty content must return null");
assert(migration.includes("about-intro-single-image"), "Migration slug missing");
assert(migration.includes("where slug = 'about-intro'"), "Migration must look up about-intro by slug");
assert(migration.includes("where not exists"), "Migration must be idempotent");
assert(slots.includes("AboutIntroSingleImageModuleSection"), "Public slot renderer missing");
assert(slots.includes("isAboutIntroSingleImageContentBlock"), "Public detector missing");
assert(!slots.includes("template.id ==="), "Renderer must not hardcode template IDs");
assert(slotRegistry.includes('"about-intro-single-image"'), "Slot registry slug missing");
assert(actions.includes("buildAboutIntroSingleImageConfig"), "Save builder missing");
assert(
  actions.includes('existing.slug === "about-intro-single-image"'),
  "Single-image slug must be locked on update",
);

if (failures.length) {
  console.error("verify-about-intro-single-image FAILED:");
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}

console.log("verify-about-intro-single-image OK");
