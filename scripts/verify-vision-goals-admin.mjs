/**
 * Verify Vision Goals admin chrome unification only.
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
const presentationRegistry = read("src/lib/page-composition/module-registry-metadata.ts");
const actions = read("src/app/admin/pages-blocks/blocks/content/actions.ts");

assert(client.includes("const isVisionGoals = editorKey === \"vision-goals\""), "isVisionGoals flag missing");
assert(
  presentationRegistry.includes('"vision-goals"') && presentationRegistry.includes('labelAr: "الرؤية والأهداف"'),
  "Vision goals header metadata missing from the shared registry",
);
assert(
  client.includes("usesAboutStructuredChrome") && client.includes("usesUnifiedModuleChrome"),
  "Vision goals must use unified module chrome via about structured chrome",
);
assert(
  !client.includes("ModuleDependencyHintsPanel"),
  "legacy module hints must remain retired",
);
assert(
  client.includes('<input type="hidden" name="slug" value={block.slug}') &&
    !client.includes("ModuleEditorTechnicalIdentity"),
  "Vision goals internal slug must remain preserved and hidden from Product UI",
);
assert(client.includes("تم حفظ موديول الرؤية والأهداف بنجاح."), "Vision goals save notice missing");
function preservesStructuralSlug(source) {
  return /isStructuralContentTemplateSlug\(\s*existing\.slug\s*,\s*existing\.variant\s*,?\s*\)/.test(source)
    && /const\s+slug\s*=\s*slugLocked\s*\?\s*existing\.slug\s*:\s*requestedSlug/.test(source);
}
assert(preservesStructuralSlug(actions), "Vision goals slug must remain locked through the canonical helper");
assert(!preservesStructuralSlug(actions.replace(/isStructuralContentTemplateSlug/g, "unrelatedHelper")), "Slug guard must reject a missing canonical owner");
assert(!preservesStructuralSlug(actions.replace(/slugLocked\s*\?\s*existing\.slug/, "slugLocked ? requestedSlug")), "Slug guard must reject overwriting a structural slug");

if (failures.length) {
  console.error("verify-vision-goals-admin FAILED:");
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}

console.log("verify-vision-goals-admin OK");
