/**
 * Verify Projects Hub all-or-nothing readiness policy (source-level).
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

const planSrc = read("src/lib/projects/build-projects-hub-render-plan.ts");
const pageSrc = read("src/app/(site)/projects/page.tsx");
const phaseTest = read("scripts/projects-hub-cms-phase3a-test.mjs");
const listingSrc = read("src/components/projects/ProjectsListSection.tsx");
const filtersSrc = read("src/components/projects/ProjectsHubFilters.tsx");

assert(planSrc.includes("incomplete_hub_modules"), "all-or-nothing incomplete reason missing");
assert(planSrc.includes("required_module_missing"), "required module missing markers absent");
assert(planSrc.includes("PROJECTS_HUB_LOAD_ERROR_REASONS"), "load error reason export missing");
assert(planSrc.includes("unsupported_slot"), "non-main slot must be skipped");
assert(planSrc.includes("All-or-nothing") || planSrc.includes("all-or-nothing") || planSrc.includes("all four"), "policy comment must describe all-or-nothing");
assert(pageSrc.includes("isProjectsHubLoadErrorReason"), "projects page must distinguish load errors");
assert(pageSrc.includes("تعذر تحميل صفحة المشروعات"), "safe Arabic load error required");
assert(!pageSrc.includes("PROJECTS_HUB_CMS=true"), "must not hardcode enabling the flag");
assert(phaseTest.includes("incomplete_hub_modules"), "phase3a test must expect incomplete for partial sets");
assert(phaseTest.includes("Single module only") || phaseTest.includes("single module"), "phase3a must cover single-module incomplete case");
assert(
  (listingSrc.match(/<ProjectListingEnglishName/g) ?? []).length === 2,
  "list and card views must share one English-name presentation owner",
);
assert(
  listingSrc.includes("min-w-0 truncate font-en text-lg font-bold leading-tight") &&
    listingSrc.includes("md:text-xl") &&
    /function ProjectListingEnglishName[\s\S]*?return \([\s\S]*?<span\b/.test(listingSrc),
  "listing project names must remain compact, bold, one-line, and ellipsized",
);
assert(
  listingSrc.includes('aria-pressed={viewMode === "list"}') &&
    listingSrc.includes('aria-pressed={viewMode === "cards"}') &&
    listingSrc.includes("<ListViewIcon />") &&
    listingSrc.includes("<CardsViewIcon />"),
  "view-mode runtime must remain accessible behind icon-only controls",
);
assert(
  listingSrc.includes('setViewMode("list")') && listingSrc.includes('setViewMode("cards")'),
  "icon controls must preserve the existing view-mode runtime",
);
assert(
  !filtersSrc.includes("إعادة تعيين الفلاتر") &&
    filtersSrc.includes("visibleFilters") &&
    filtersSrc.includes("options[0]?.id ?? \"all\""),
  "projects filters must consume configured visibility without a parallel reset action",
);

if (failures.length) {
  console.error("verify-projects-hub-readiness FAILED:");
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}

console.log("verify-projects-hub-readiness OK");
