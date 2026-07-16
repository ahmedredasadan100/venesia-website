/**
 * Phase 3A foundation tests — no public CMS activation.
 * Does not mutate DB rows permanently. Does not enable PROJECTS_HUB_CMS on the long-lived server.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

// Load compiled-free TS via dynamic transpile is unavailable — duplicate minimal logic
// by importing through next's resolution is hard. Instead import built helpers via tsx if present,
// else re-implement assertions against source by spawning node with experimental strip.
const require = createRequire(import.meta.url);

async function loadTs(relPath) {
  try {
    return await import(pathToFileURL(resolve(relPath)).href);
  } catch {
    // Fallback: use ts-node/register if available
    require("ts-node/register/transpile-only");
    return require(resolve(relPath));
  }
}

const flagMod = await loadTs("src/lib/projects/projects-hub-cms-flag.ts");
const planMod = await loadTs("src/lib/projects/build-projects-hub-render-plan.ts");
const mapMod = await loadTs("src/lib/projects/map-projects-hub-module-props.ts");
const helpersMod = await loadTs("src/lib/projects/public-helpers.ts");

const { isProjectsHubCmsEnabled } = flagMod;
const { buildProjectsHubRenderPlan } = planMod;
const { applyFeaturedLimit, mapProjectsHubListingProps } = mapMod;
const { getHubFilterOptionsFromProjects, getProjectsByFilter, PROJECT_CATEGORY_LABELS } = helpersMod;

delete process.env.PROJECTS_HUB_CMS;
assert.equal(isProjectsHubCmsEnabled(), false, "missing env => false");
process.env.PROJECTS_HUB_CMS = "false";
assert.equal(isProjectsHubCmsEnabled(), false, "false => false");
process.env.PROJECTS_HUB_CMS = "true";
assert.equal(isProjectsHubCmsEnabled(), true, "true => true");
process.env.NODE_ENV = "production";
process.env.VERCEL = "1";
delete process.env.PROJECTS_HUB_CMS;
assert.equal(isProjectsHubCmsEnabled(), false, "NODE_ENV/VERCEL must not enable");
delete process.env.VERCEL;

function assignment(overrides) {
  return {
    assignmentId: overrides.assignmentId ?? 1,
    templateId: overrides.templateId ?? 1,
    slot: "main",
    sortOrder: overrides.sortOrder ?? 10,
    isVisible: overrides.isVisible ?? true,
    templateSlug: overrides.templateSlug,
    templateVariant: overrides.templateVariant ?? overrides.templateSlug,
    templateStatus: overrides.templateStatus ?? "published",
    config: overrides.config ?? {},
  };
}

const baseComposition = {
  pageId: 36,
  pageSlug: "projects",
  pagePath: "/projects",
  assignments: [
    assignment({
      assignmentId: 120,
      sortOrder: 10,
      templateSlug: "projects-hub-hero",
      config: { selectionMode: "auto_residential_with_media", autoplayMs: 6000, emptyState: null },
    }),
    assignment({
      assignmentId: 121,
      sortOrder: 20,
      templateSlug: "projects-hub-featured",
      config: {
        selectionMode: "featured_flag",
        title: "مشروع مميز",
        subtitle: "اختيار يعكس مسار التنفيذ على الأرض",
        limit: null,
        autoplayMs: 6000,
      },
    }),
    assignment({
      assignmentId: 122,
      sortOrder: 30,
      templateSlug: "projects-hub-listing",
      config: {
        eyebrow: "Projects Index",
        title: "جميع المشروعات",
        defaultFilter: "all",
        visibleFilters: ["all", "residential", "commercial"],
        defaultView: "list",
        pageSize: 6,
        sort: "homepage_order",
      },
    }),
    assignment({
      assignmentId: 123,
      sortOrder: 40,
      templateSlug: "projects-hub-map",
      config: {
        title: "مشروعاتنا على الخريطة",
        mapImage: "/images/projects/beit-elwatan-map1.webp",
        exploreButtonLabel: "استكشف على الخريطة",
        mapPins: [{ code: "B84", district: "الحي الأول", right: "34%", top: "52%" }],
      },
    }),
  ],
};

// 1. Four valid visible assignments
{
  const plan = buildProjectsHubRenderPlan(baseComposition);
  assert.equal(plan.ready, true);
  assert.deepEqual(
    plan.modules.map((m) => [m.sortOrder, m.slug]),
    [
      [10, "projects-hub-hero"],
      [20, "projects-hub-featured"],
      [30, "projects-hub-listing"],
      [40, "projects-hub-map"],
    ],
  );
}

// 2. Reordered mock assignments
{
  const reordered = {
    ...baseComposition,
    assignments: [
      assignment({
        assignmentId: 1,
        sortOrder: 40,
        templateSlug: "projects-hub-hero",
        config: baseComposition.assignments[0].config,
      }),
      assignment({
        assignmentId: 2,
        sortOrder: 10,
        templateSlug: "projects-hub-map",
        config: baseComposition.assignments[3].config,
      }),
      assignment({
        assignmentId: 3,
        sortOrder: 20,
        templateSlug: "projects-hub-listing",
        config: baseComposition.assignments[2].config,
      }),
      assignment({
        assignmentId: 4,
        sortOrder: 30,
        templateSlug: "projects-hub-featured",
        config: baseComposition.assignments[1].config,
      }),
    ],
  };
  const plan = buildProjectsHubRenderPlan(reordered);
  assert.equal(plan.ready, true);
  assert.deepEqual(
    plan.modules.map((m) => m.slug),
    ["projects-hub-map", "projects-hub-listing", "projects-hub-featured", "projects-hub-hero"],
  );
}

// 3. Hidden assignment => incomplete (all-or-nothing) => Static path
{
  const withHidden = {
    ...baseComposition,
    assignments: baseComposition.assignments.map((row) =>
      row.templateSlug === "projects-hub-featured" ? { ...row, isVisible: false } : row,
    ),
  };
  const plan = buildProjectsHubRenderPlan(withHidden);
  assert.equal(plan.ready, false);
  assert.equal(plan.reason, "incomplete_hub_modules");
  assert.ok(plan.skipped.some((s) => s.reason === "hidden"));
  assert.ok(plan.skipped.some((s) => s.reason === "required_module_missing" && s.slug === "projects-hub-featured"));
}

// 4. Unknown module skipped; four valid remain => ready
{
  const withUnknown = {
    ...baseComposition,
    assignments: [
      ...baseComposition.assignments,
      assignment({
        assignmentId: 999,
        sortOrder: 15,
        templateSlug: "unknown-module",
        config: { title: "x" },
      }),
    ],
  };
  const plan = buildProjectsHubRenderPlan(withUnknown);
  assert.equal(plan.ready, true);
  assert.equal(plan.modules.length, 4);
  assert.ok(plan.skipped.some((s) => s.reason === "unsupported_slug"));
}

// 5. Invalid config => incomplete (all-or-nothing)
{
  const withInvalid = {
    ...baseComposition,
    assignments: baseComposition.assignments.map((row) =>
      row.templateSlug === "projects-hub-hero" ? { ...row, config: ["bad"] } : row,
    ),
  };
  const plan = buildProjectsHubRenderPlan(withInvalid);
  assert.equal(plan.ready, false);
  assert.equal(plan.reason, "incomplete_hub_modules");
  assert.ok(plan.skipped.some((s) => s.reason === "config_not_object"));
}

// 5b. Single module only => incomplete
{
  const one = {
    ...baseComposition,
    assignments: [baseComposition.assignments[0]],
  };
  const plan = buildProjectsHubRenderPlan(one);
  assert.equal(plan.ready, false);
  assert.equal(plan.reason, "incomplete_hub_modules");
}

// 5c. Non-main slot ignored => incomplete if that drops a required module
{
  const nonMain = {
    ...baseComposition,
    assignments: baseComposition.assignments.map((row) =>
      row.templateSlug === "projects-hub-map" ? { ...row, slot: "sidebar" } : row,
    ),
  };
  const plan = buildProjectsHubRenderPlan(nonMain);
  assert.equal(plan.ready, false);
  assert.ok(plan.skipped.some((s) => s.reason === "unsupported_slot"));
}

// 6. Missing assignments => not ready
{
  const empty = { ...baseComposition, assignments: [] };
  const plan = buildProjectsHubRenderPlan(empty);
  assert.equal(plan.ready, false);
  assert.equal(plan.reason, "no_assignments");
}

// 7. No visible modules => not ready
{
  const allHidden = {
    ...baseComposition,
    assignments: baseComposition.assignments.map((row) => ({ ...row, isVisible: false })),
  };
  const plan = buildProjectsHubRenderPlan(allHidden);
  assert.equal(plan.ready, false);
  assert.equal(plan.reason, "no_valid_visible_modules");
}

// 8. Featured limit mapper does not mutate source array identity beyond slice
{
  const projects = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const limited = applyFeaturedLimit(projects, 2);
  assert.equal(limited.length, 2);
  assert.equal(projects.length, 3);
}

// 9. Listing mapper preserves filter defaults for shared filter owner
{
  const plan = buildProjectsHubRenderPlan(baseComposition);
  const listing = plan.modules.find((m) => m.slug === "projects-hub-listing");
  const props = mapProjectsHubListingProps(listing);
  assert.equal(props.defaultFilter, "all");
  assert.deepEqual(props.visibleFilters, ["all", "residential", "commercial"]);
  assert.equal(props.showEyebrow, true);
  assert.equal(props.showTitle, true);
  assert.equal(props.showFilterBar, true);
  assert.equal(props.showProjectImage, true);
  assert.equal(props.showProjectCode, true);
  assert.equal(props.showProjectDescription, true);
  assert.equal(props.showProjectType, true);
  assert.equal(props.showProjectLocation, true);
  assert.equal(props.showExploreButton, true);
  assert.equal(props.showViewToggle, true);
  assert.equal(props.showPagination, true);
  assert.equal(props.showProjectCount, true);
  assert.equal(props.pageSize, 6);
  assert.equal(props.defaultView, "list");
}

// 9b. Filter chips derive from present categories; labels from registry
{
  const mixed = [
    { category: "residential", homepageOrder: 1, code: "A" },
    { category: "commercial", homepageOrder: 2, code: "B" },
    { category: "residential", homepageOrder: 3, code: "C" },
  ];
  assert.deepEqual(getHubFilterOptionsFromProjects(mixed), [
    { id: "all", label: "كل المشروعات" },
    { id: "residential", label: PROJECT_CATEGORY_LABELS.residential },
    { id: "commercial", label: PROJECT_CATEGORY_LABELS.commercial },
  ]);
  assert.deepEqual(
    getHubFilterOptionsFromProjects([{ category: "residential", homepageOrder: 1, code: "A" }]),
    [
      { id: "all", label: "كل المشروعات" },
      { id: "residential", label: PROJECT_CATEGORY_LABELS.residential },
    ],
  );
  assert.equal(getProjectsByFilter(mixed, "all").length, 3);
  assert.equal(getProjectsByFilter(mixed, "residential").length, 2);
  assert.equal(getProjectsByFilter(mixed, "commercial").length, 1);
}

// 10. Duplicate supported slug skipped — still ready if four unique remain
{
  const withDup = {
    ...baseComposition,
    assignments: [
      ...baseComposition.assignments,
      assignment({
        assignmentId: 200,
        sortOrder: 11,
        templateSlug: "projects-hub-hero",
        config: baseComposition.assignments[0].config,
      }),
    ],
  };
  const plan = buildProjectsHubRenderPlan(withDup);
  assert.equal(plan.ready, true);
  assert.equal(plan.modules.filter((m) => m.slug === "projects-hub-hero").length, 1);
  assert.ok(plan.skipped.some((s) => s.reason === "duplicate_supported_slug"));
}

console.log(
  JSON.stringify(
    {
      ok: true,
      flagDefaultFalse: true,
      planOrder: true,
      reorder: true,
      visibilityIncomplete: true,
      unknownModule: true,
      invalidConfigIncomplete: true,
      singleModuleIncomplete: true,
      nonMainSlotIncomplete: true,
      missingComposition: true,
      noVisible: true,
      featuredLimitNoMutate: true,
      sharedFilterDefaults: true,
      duplicateSkip: true,
    },
    null,
    2,
  ),
);
