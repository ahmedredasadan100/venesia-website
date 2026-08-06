/**
 * Verifies About Intro (content block #2 / about-intro) admin editor invariants.
 * Source-level checks only — no DB writes.
 */

import { readFileSync, existsSync } from "node:fs";
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
const presentation = read("src/components/admin/page-blocks/ModuleEditorPresentation.tsx");
const presentationRegistry = read("src/lib/page-composition/module-registry-metadata.ts");
const editor = read("src/components/admin/page-blocks/editors/AboutIntroModuleEditor.tsx");
const actions = read("src/app/admin/pages-blocks/blocks/content/actions.ts");
const whoWeAre = read("src/components/modules/WhoWeAreModuleSection.tsx");
const mapper = read("src/components/about/about-cms-mappers.ts");

assert(client.includes('isAboutIntro = editorKey === "about-intro"'), "about-intro chrome flag missing");
assert(presentation.includes("AdminPageContextHeader"), "unified AdminPageContextHeader owner missing");
assert(
  presentationRegistry.includes('"about-intro"') && presentationRegistry.includes('labelAr: "من نحن — المقدمة"'),
  "Arabic about-intro header metadata missing from the shared registry",
);
assert(
  !client.includes("ModuleDependencyHintsPanel"),
  "legacy ModuleDependencyHintsPanel must remain retired",
);
assert(presentation.includes("معرّف بنيوي للقراءة فقط"), "shared structural slug helper missing");
assert(
  client.includes("usesLockedInternalSlug"),
  "about-intro slug must be read-only like home modules",
);
assert(client.includes('saveLabel="حفظ التعديلات"'), "about-intro save label missing");

assert(editor.includes('toolbarMode="minimal"'), "AdminRichTextEditor minimal toolbar missing");
assert(editor.includes("enableTextAlign"), "AdminRichTextEditor text align missing");
assert(editor.includes('toolbarPlacement="top"'), "AdminRichTextEditor top toolbar missing");
assert(editor.includes('name="body"'), "body rich text field missing");
assert(!/eyebrow:\s*"Eyebrow"/.test(editor), "English Eyebrow label still present");
assert(!/Badge \/ Number/.test(editor), "English Badge/Number label still present");
assert(editor.includes('subtitle: "العنوان الفرعي"'), "Arabic subtitle label missing for about-intro");

assert(actions.includes("normalizeRichTextContent"), "actions must normalize rich text body");
assert(actions.includes("slugLocked"), "actions must lock structured about module slugs");
assert(
  actions.includes("isStructuralContentTemplateSlug(existing.slug, existing.variant)") &&
    actions.includes("slugLocked ? existing.slug : requestedSlug"),
  "about-intro slug must not be overwritten from request",
);

assert(whoWeAre.includes("RichTextContent"), "public WhoWeAre must use RichTextContent");
assert(whoWeAre.includes('mode="rich"'), "public WhoWeAre RichTextContent must use rich mode");
assert(mapper.includes("description: config.body ?? \"\""), "mapper must pass raw body string");

assert(!client.includes("Who We Are MODULE"), "legacy WHO WE ARE MODULE eyebrow should be retired for CONTENT MODULE");

if (failures.length) {
  console.error("verify-about-intro-admin FAILED:");
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}

console.log("verify-about-intro-admin OK");
