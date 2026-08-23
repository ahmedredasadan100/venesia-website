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

function readStructuralTemplateSlugs(source) {
  const declaration = source.match(
    /export const STRUCTURAL_CONTENT_TEMPLATE_SLUGS\s*=\s*\[([\s\S]*?)\]\s*as const/,
  );
  return new Set(
    Array.from(declaration?.[1].matchAll(/"([^"]+)"/g) ?? [], (match) => match[1]),
  );
}

function usesSharedStructuralSlugLock(source) {
  const checksExistingIdentity =
    /isStructuralContentTemplateSlug\(\s*existing\.slug\s*,\s*existing\.variant\s*\)/.test(source);
  const preservesExistingSlug =
    /slugLocked\s*\?\s*existing\.slug\s*:\s*requestedSlug/.test(source);
  return checksExistingIdentity && preservesExistingSlug;
}

const client = read("src/components/admin/page-blocks/ContentModuleEditClient.tsx");
const presentationRegistry = read("src/lib/page-composition/module-registry-metadata.ts");
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
const structuralTemplateSlugs = readStructuralTemplateSlugs(registry);

assert(registry.includes('"about-intro-single-image"'), "Editor registry key missing");
assert(configs.includes("isAboutIntroSingleImageTemplate"), "Config detector missing");
assert(configs.includes("asAboutIntroSingleImageConfig"), "Config parser missing");
assert(configs.includes("AboutIntroSingleImageModuleConfig"), "Config type missing");
assert(client.includes("isAboutIntroSingleImage"), "Single-image editor key wiring missing");
assert(
  presentationRegistry.includes('labelAr: "من نحن — محتوى وصورة واحدة"'),
  "Single-image header metadata missing from the shared registry",
);
assert(client.includes("AboutIntroSingleImageModuleEditor"), "Single-image editor mount missing");
assert(editor.includes('name="image_position"'), "imagePosition field missing");
assert(!editor.includes("image_secondary"), "Single-image editor must not expose secondary image");
assert(!editor.includes('name="config_schema"'), "config_schema must live in ContentModuleEditClient only");
assert(section.includes("aspect-[16/12]"), "Public single-image frame aspect missing");
assert(
  section.includes("slot-editorial-flow") &&
    section.includes("slot-editorial-flow--media-end") &&
    section.includes('data-module-presentation={showImage ? "editorial-flow" : undefined}'),
  "Public single-image module must adopt the shared reversible Presentation contract",
);
assert(!section.includes("lg:grid-cols-2"), "Public module must not restore a local parallel grid owner");
assert(section.includes("if (!content) return null"), "Empty content must return null");
assert(migration.includes("about-intro-single-image"), "Migration slug missing");
assert(migration.includes("where slug = 'about-intro'"), "Migration must look up about-intro by slug");
assert(migration.includes("where not exists"), "Migration must be idempotent");
assert(slots.includes("AboutIntroSingleImageModuleSection"), "Public slot renderer missing");
assert(slots.includes("isAboutIntroSingleImageContentBlock"), "Public detector missing");
assert(!slots.includes("template.id ==="), "Renderer must not hardcode template IDs");
assert(
  slotRegistry.includes("SLOT_MODULE_SLUG_METADATA") &&
    presentationRegistry.includes('"about-intro-single-image"'),
  "Slot registry must delegate slug metadata to the shared registry owner",
);
assert(actions.includes("buildAboutIntroSingleImageConfig"), "Save builder missing");
assert(
  structuralTemplateSlugs.has("about-intro-single-image"),
  "Single-image slug must be registered in the shared structural lock",
);
assert(
  usesSharedStructuralSlugLock(actions),
  "Server update must preserve slugs through the shared structural lock",
);

if (failures.length) {
  console.error("verify-about-intro-single-image FAILED:");
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}

console.log("verify-about-intro-single-image OK");
