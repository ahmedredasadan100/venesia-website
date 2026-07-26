/**
 * Source-level checks that project child reads fail closed (no silent empty arrays).
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

const queries = read("src/lib/projects/queries.ts");
const publicLoad = read("src/lib/projects/load-published-projects.ts");
const sync = read("src/lib/admin/projects/project-children-sync.ts");
const validation = read("src/app/admin/projects/project-actions/validation.ts");
const duplicate = read("src/app/admin/projects/project-actions/duplicate.ts");
const construction = read("src/lib/admin/projects/construction-updates-query.ts");

assert(queries.includes("floorPlansError"), "getProjectEditBundle must check floor plan errors");
assert(queries.includes("CHILD_LOAD_FAILED_AR") || queries.includes("تعذر تحميل بيانات المشروع الفرعية"), "edit bundle must throw safe Arabic error");
assert(publicLoad.includes("floorPlansError"), "queryProjectBySlug must check child errors");
assert(publicLoad.includes("throw new Error"), "public child failure must throw, not empty map");
assert(sync.includes("plansError") && sync.includes("mediaError"), "sync pre-read must check errors");
assert(!sync.includes("preserveImage"), "an explicitly cleared project child image must not fall back to the previous reference");
assert(sync.includes('plan_image: (images[index] ?? "").trim()'), "floor-plan image removal must remain explicit in the Domain payload");
assert(sync.includes("pre-read failed") || sync.includes("قبل الحفظ"), "sync must abort with clear message");
assert(validation.includes("mediaError") || validation.includes("floorPlansError"), "publish input must check child errors");
assert(validation.includes("throw new Error"), "publish load failure must not count as zero");
assert(duplicate.includes("floorPlansSelectError"), "duplicate must check child selects");
assert(
  duplicate.indexOf("floorPlansSelectError") < duplicate.indexOf('.insert({\n      ...projectFields') ||
    duplicate.indexOf("floorPlansSelectError") < duplicate.indexOf("publication_status: \"draft\""),
  "duplicate must select children before parent insert",
);
assert(construction.includes("projectsError") && construction.includes("siteUpdatesError"), "construction planning must check errors");
assert(construction.includes("throw new Error"), "construction planning must fail closed");

if (failures.length) {
  console.error("verify-project-child-fail-closed FAILED:");
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}

console.log("verify-project-child-fail-closed OK");
