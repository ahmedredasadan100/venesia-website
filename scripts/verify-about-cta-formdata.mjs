/**
 * Prevent about-cta FormData name collisions between public config.description
 * and content_block_templates.description (internal metadata).
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
const editor = read("src/components/admin/page-blocks/editors/AboutCtaModuleEditor.tsx");
const actions = read("src/app/admin/pages-blocks/blocks/content/actions.ts");

assert(client.includes('name="internal_description"'), "Settings must post internal_description");
assert(
  client.includes("usesInternalDescriptionField"),
  "about-cta path must use dedicated internal description field flag",
);
assert(
  client.includes("isAboutCta") && client.includes("usesInternalDescriptionField"),
  "about-cta must be covered by internal description settings",
);
assert(
  /name=["']description["']/.test(editor),
  "About CTA content editor must keep public config field name=description",
);
assert(
  !/name=["']description["']/.test(
    client.slice(
      client.indexOf("usesInternalDescriptionField ?"),
      client.indexOf("usesInternalDescriptionField ?") + 500,
    ),
  ) || client.includes('name="internal_description"'),
  "Structured settings branch must not collide on description",
);

// Ensure settings branch for structured modules does not emit name="description"
const settingsStart = client.indexOf("const settingsTab =");
const settingsChunk = client.slice(settingsStart, settingsStart + 3500);
assert(
  settingsChunk.includes('name="internal_description"'),
  "settingsTab must include internal_description",
);
assert(
  settingsChunk.includes("usesInternalDescriptionField ?"),
  "settingsTab must gate internal_description for structured modules",
);

assert(
  actions.includes("formData.has(\"internal_description\")"),
  "Server must prefer internal_description",
);
assert(
  actions.includes('schema === "about-cta"'),
  "Server must refuse falling back to public description for about-cta",
);
assert(
  actions.includes("description: cleanText(formData.get(\"description\"))"),
  "About CTA config builder must still read public description into config",
);

// Detect duplicate name=\"description\" risk inside AboutCtaModuleEditor + settings together:
// Editor may have description; settings must not when about-cta is active.
assert(
  !settingsChunk.includes('name="description"') ||
    settingsChunk.includes("usesInternalDescriptionField ?"),
  "settingsTab must not blindly emit name=description for about-cta",
);

if (failures.length) {
  console.error("verify-about-cta-formdata FAILED:");
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}

console.log("verify-about-cta-formdata OK");
