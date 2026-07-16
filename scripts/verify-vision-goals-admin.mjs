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
const actions = read("src/app/admin/pages-blocks/blocks/content/actions.ts");

assert(client.includes("const isVisionGoals = editorKey === \"vision-goals\""), "isVisionGoals flag missing");
assert(client.includes('title="الرؤية والأهداف"'), "Vision goals header title missing");
assert(
  client.includes("usesHomeModuleChrome || isAboutIntro || isAboutIntroSingleImage || isVisionGoals"),
  "Vision goals must use unified module chrome",
);
assert(
  client.includes("isAboutIntro || isAboutIntroSingleImage || isVisionGoals ? null") ||
    client.includes("isVisionGoals ? null"),
  "Module hints must be gated for vision-goals",
);
assert(
  client.includes("isAboutIntro || isAboutIntroSingleImage || isVisionGoals") &&
    client.includes("المعرّف التقني للموديول — للقراءة فقط."),
  "Vision goals internal slug must be read-only with helper text",
);
assert(client.includes("تم حفظ موديول الرؤية والأهداف بنجاح."), "Vision goals save notice missing");
assert(
  actions.includes('existing.slug === "vision-goals"') ||
    actions.includes('existing.variant === "vision-goals"'),
  "Vision goals slug must be locked on update",
);

if (failures.length) {
  console.error("verify-vision-goals-admin FAILED:");
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}

console.log("verify-vision-goals-admin OK");
