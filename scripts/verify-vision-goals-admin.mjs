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
  client.includes("usesLockedInternalSlug") &&
    /<ModuleEditorTechnicalIdentity\s+mode="hidden"/.test(client) &&
    client.includes("!usesLockedInternalSlug"),
  "Vision goals internal slug must remain hidden while editable identities keep the shared field",
);
assert(client.includes("تم حفظ موديول الرؤية والأهداف بنجاح."), "Vision goals save notice missing");
assert(
  actions.includes("isStructuralContentTemplateSlug(existing.slug, existing.variant)"),
  "Vision goals slug must be locked on update via structural helper",
);

if (failures.length) {
  console.error("verify-vision-goals-admin FAILED:");
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}

console.log("verify-vision-goals-admin OK");
