/**
 * Verify structural content template slugs stay read-only in UI + server.
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

const registry = read("src/lib/page-blocks/module-edit-registry.ts");
const client = read("src/components/admin/page-blocks/ContentModuleEditClient.tsx");
const actions = read("src/app/admin/pages-blocks/blocks/content/actions.ts");

const required = [
  "about-intro",
  "about-intro-single-image",
  "vision-goals",
  "about-cta",
  "about-principles",
  "about-approach",
  "home-story",
  "home-contact",
  "home-trust",
  "home-projects",
];

for (const slug of required) {
  assert(
    registry.includes(`"${slug}"`),
    `STRUCTURAL_CONTENT_TEMPLATE_SLUGS must include ${slug}`,
  );
}

assert(
  registry.includes("export function isStructuralContentTemplateSlug"),
  "Shared slug lock helper missing",
);
assert(client.includes("usesLockedInternalSlug"), "UI locked slug flag missing");
assert(
  client.includes("المعرّف التقني للموديول — للقراءة فقط."),
  "Read-only slug helper text missing",
);
assert(
  actions.includes("isStructuralContentTemplateSlug(existing.slug, existing.variant)"),
  "Server update must lock structural slugs via shared helper",
);

// Public URL slug surfaces must remain editable — smoke check these files still accept slug edits.
const topicHelpers = read("src/app/admin/content/topics/article-actions/helpers.ts");
assert(
  topicHelpers.includes("slug") && !topicHelpers.includes("isStructuralContentTemplateSlug"),
  "Topic slugs must stay outside content-template structural lock",
);

if (failures.length) {
  console.error("verify-internal-slug-locks FAILED:");
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}

console.log("verify-internal-slug-locks OK");
