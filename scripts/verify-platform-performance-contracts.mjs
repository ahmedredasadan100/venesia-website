import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const rootLayout = read("src/app/layout.tsx");
const hero = read("src/components/sections/DynamicHeroSection.tsx");
const adminAccess = read("src/components/admin/AdminAccessLayout.tsx");
const adminAuthenticated = read("src/components/admin/AdminAuthenticatedLayout.tsx");
const projects = read("src/lib/projects/load-published-projects.ts");
const adminBoundaries = [
  "src/app/admin/error.tsx",
  "src/app/admin/loading.tsx",
  "src/app/admin/not-found.tsx",
].map(read);

const ibmFontOwner = rootLayout.slice(
  rootLayout.indexOf("const ibmArabic"),
  rootLayout.indexOf("const inter"),
);
assert.ok(
  ibmFontOwner.includes("preload: false"),
  "The multi-weight Arabic font must not preload every weight globally",
);

assert.ok(
  hero.includes("TRANSPARENT_IMAGE_FALLBACK") &&
    hero.includes("src={TRANSPARENT_IMAGE_FALLBACK}") &&
    hero.includes('fetchPriority: priority ? ("high" as const)') &&
    hero.includes('loading: priority ? ("eager" as const)'),
  "Art-directed hero images must not fetch the opposite breakpoint fallback",
);
assert.ok(
  hero.includes("preparedSlideIndexes") &&
    hero.includes("index === safeIndex || preparedSlideIndexes.has(index)") &&
    !hero.includes("Math.abs(index - safeIndex) <= 1"),
  "Home hero must defer inactive slide images until after the first render",
);

assert.ok(
  adminAccess.includes('dynamic(') &&
    adminAccess.includes('import("./AdminAuthenticatedLayout")') &&
    adminAccess.includes("ssr: false") &&
    !adminAccess.includes('from "./AdminShell"') &&
    !adminAccess.includes('from "./AdminFeedbackProvider"') &&
    !adminAccess.includes('from "./entity-list/AdminEntityListQueryProvider"'),
  "Admin auth routes must not include the authenticated shell in their initial client graph",
);
assert.ok(
  adminAuthenticated.includes("<AdminEntityListQueryProvider>") &&
    adminAuthenticated.includes("<AdminFeedbackProvider>") &&
    adminAuthenticated.includes("<AdminShell"),
  "Authenticated Admin routes must retain the established shared owners",
);
assert.ok(
  adminBoundaries.every(
    (source) =>
      !source.includes('from "../../components/admin/ui"') &&
      source.includes("ui/AdminPageContextHeader") &&
      source.includes("ui/AdminPageExperience"),
  ),
  "Root Admin boundaries must not pull the full Admin UI barrel into every route",
);

for (const relation of [
  "projects_governorate_id_fkey",
  "projects_city_id_fkey",
  "projects_main_area_id_fkey",
  "projects_sub_area_id_fkey",
  "project_location_points",
  "project_features",
  "project_floor_plans",
  "project_floor_plan_details",
  "project_delivery_items",
  "project_media",
  "project_videos",
]) {
  assert.ok(
    projects.includes(relation),
    `Project aggregate query must embed ${relation}`,
  );
}
const aggregateMapper = projects.slice(
  projects.indexOf("function mapLoadedProjectAggregate"),
  projects.indexOf("async function queryProjectBySlug"),
);
assert.ok(
  !aggregateMapper.includes("Promise.all") &&
    !aggregateMapper.includes('.from("project_'),
  "Project detail mapping must not reintroduce multi-request child reads",
);

console.log("Platform performance contracts passed.");
