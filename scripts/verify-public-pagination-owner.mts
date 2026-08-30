import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildPublicPaginationHref,
  buildPublicPaginationItems,
} from "../src/components/pagination-model.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0;

function read(path: string) {
  return readFileSync(resolve(ROOT, path), "utf8");
}

function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

function sourceFiles(path: string): string[] {
  return readdirSync(resolve(ROOT, path), { withFileTypes: true }).flatMap(
    (entry) => {
      const entryPath = resolve(ROOT, path, entry.name);
      if (entry.isDirectory()) {
        return sourceFiles(relative(ROOT, entryPath));
      }
      return [".ts", ".tsx"].includes(extname(entry.name))
        ? [relative(ROOT, entryPath).replaceAll("\\", "/")]
        : [];
    },
  );
}

function pageLabels(currentPage: number, totalPages: number) {
  return buildPublicPaginationItems(currentPage, totalPages).map((item) =>
    item.type === "page" ? item.page : `${item.position}-ellipsis`,
  );
}

const owner = read("src/components/Pagination.tsx");
const model = read("src/components/pagination-model.ts");
const topics = read("src/components/topics/TopicsListingContent.tsx");
const media = read("src/components/media-center/MediaListingContent.tsx");
const tracking = read("src/components/track/ProjectTrackingExperience.tsx");
const trackingRoute = read("src/app/(site)/track-your-project/[slug]/page.tsx");
const projectsRenderer = read("src/components/projects/ProjectsHubModulesRenderer.tsx");
const projectsListing = read("src/components/projects/ProjectsListSection.tsx");
const architecture = read("AI_ARCHITECTURE_PRINCIPLES.md");
const currentState = read("docs/CURRENT_PROJECT_STATE.md");
const packageJson = read("package.json");

const contractMatch = model.match(
  /export type PublicPaginationContract = Readonly<\{([\s\S]*?)\}>;/u,
);
check("Public Pagination exports one formal current-needs contract", contractMatch);
const contract = contractMatch?.[1] ?? "";
for (const field of [
  "currentPage",
  "totalPages",
  "basePath",
  "query",
  "pageParam",
  "previousLabel",
  "nextLabel",
  "ariaLabel",
]) {
  check(`contract declares ${field}`, contract.includes(`${field}`));
}
for (const forbidden of [
  "items",
  "pageSize",
  "totalCount",
  "search",
  "filter",
  "sort",
  "cursor",
  "loadMore",
]) {
  check(
    `contract excludes ${forbidden} business/read ownership`,
    !contract.includes(forbidden),
  );
}

check(
  "UI owner consumes the formal contract and both canonical model functions",
  owner.includes("type PublicPaginationContract") &&
    owner.includes("buildPublicPaginationItems") &&
    owner.includes("buildPublicPaginationHref") &&
    !owner.includes("type PaginationProps") &&
    !owner.includes("function buildHref"),
);
check(
  "Owner boundary contains no read, Listing, Admin, cursor, infinite, or Load More logic",
  !/(supabase|loadPublic|CollectionListing|AdminTablePagination|cursorPagination|cursorToken|infiniteScroll|loadMore)/u.test(
    `${owner}\n${model}`,
  ),
);
check(
  "URL navigation remains centralized in the pure owner model",
  model.includes("new URLSearchParams()") && !owner.includes("new URLSearchParams()"),
);
check(
  "Next Link navigation, accessibility, and viewport retention behavior remain present",
  owner.includes('import Link from "next/link"') &&
    owner.includes("scroll={false}") &&
    owner.includes("onNavigate={retainViewportPosition}") &&
    owner.includes('aria-current={isActive ? "page" : undefined}') &&
    owner.includes("useLayoutEffect") &&
    owner.includes("window.scrollBy(0, delta)") &&
    owner.includes("if (totalPages <= 1)") &&
    owner.includes('previousLabel = "السابق"') &&
    owner.includes('nextLabel = "التالي"'),
);
check(
  "one presentation contract owns every Public Pagination visual state",
  owner.includes("export const PUBLIC_PAGINATION_PRESENTATION") &&
    owner.includes("root:") &&
    owner.includes("navigationControl:") &&
    owner.includes("navigationInteractive:") &&
    owner.includes("navigationDisabled:") &&
    owner.includes("pageControl:") &&
    owner.includes("pageActive:") &&
    owner.includes("pageInteractive:") &&
    owner.includes("ellipsis:") &&
    owner.includes("getPublicPaginationNavigationClassName") &&
    owner.includes("getPublicPaginationPageClassName"),
);
check(
  "presentation contract covers spacing, borders, radius, typography, size, hover, active, disabled, focus, and responsive behavior",
  [
    "flex-wrap",
    "gap-2",
    "border-white/10",
    "rounded-xl",
    "text-sm",
    "h-10",
    "min-w-10",
    "hover:border-[#D8B87A]/35",
    "pageActive",
    "navigationDisabled",
    "focus-visible:ring-2",
    "motion-reduce:transition-none",
    "sm:min-w-8",
  ].every((token) => owner.includes(token)),
);
check(
  "canonical URL renderer consumes only the shared presentation contract",
  owner.includes("className={PUBLIC_PAGINATION_PRESENTATION.root}") &&
    owner.includes("className={PUBLIC_PAGINATION_PRESENTATION.ellipsis}") &&
    (owner.match(/getPublicPaginationNavigationClassName\(/gu)?.length ?? 0) ===
      5 &&
    (owner.match(/getPublicPaginationPageClassName\(/gu)?.length ?? 0) === 2 &&
    !owner.includes('className="rounded-full border'),
);

check("small page window behavior is unchanged", JSON.stringify(pageLabels(1, 5)) === JSON.stringify([1, 2, 3, 4, 5]));
check(
  "middle page window behavior is unchanged",
  JSON.stringify(pageLabels(10, 20)) ===
    JSON.stringify([1, "start-ellipsis", 9, 10, 11, "end-ellipsis", 20]),
);
for (let currentPage = 1; currentPage <= 100; currentPage += 1) {
  const items = buildPublicPaginationItems(currentPage, 100);
  const pages = items.flatMap((item) => (item.type === "page" ? [item.page] : []));
  assert.ok(items.length <= 7, "page window must remain bounded");
  assert.ok(pages.includes(currentPage), "page window must retain the active page");
}
passed += 1;
console.log("PASS bounded page window retains every active page");

check(
  "default page URL behavior is unchanged",
  buildPublicPaginationHref("/topics", 1, { sort: "latest", empty: undefined }) ===
    "/topics?sort=latest",
);
check(
  "numbered page URL behavior is unchanged",
  buildPublicPaginationHref("/topics", 3, { sort: "oldest" }) ===
    "/topics?sort=oldest&page=3",
);
check(
  "custom page parameter preserves selection query and omits page one",
  buildPublicPaginationHref(
    "/track-your-project/i87",
    1,
    { stage: 8, stagePage: 4, itemPage: 2 },
    "stagePage",
  ) === "/track-your-project/i87?stage=8&itemPage=2",
);

const productionSources = sourceFiles("src");
const consumerImportPattern =
  /import PublicPagination from ["'][^"']*\/Pagination["'];/u;
const consumerFiles = productionSources
  .filter((path) => consumerImportPattern.test(read(path)))
  .sort();
const expectedConsumers = [
  "src/components/media-center/MediaListingContent.tsx",
  "src/components/topics/TopicsListingContent.tsx",
  "src/components/track/ProjectTrackingExperience.tsx",
].sort();
check(
  "all and only the three approved consumers adopt the canonical owner",
  JSON.stringify(consumerFiles) === JSON.stringify(expectedConsumers),
);
check(
  "Topics adopts once as a Listing consumer",
  topics.includes("<TopicsListingModule") &&
    (topics.match(/<PublicPagination/gu)?.length ?? 0) === 1,
);
check(
  "Media adopts once as a Listing consumer",
  topics.includes("<TopicsListingModule") &&
    media.includes("<CollectionListingPresentation") &&
    (media.match(/<PublicPagination/gu)?.length ?? 0) === 1,
);
check(
  "Project Tracking adopts five times as a true non-Listing consumer",
  (tracking.match(/<PublicPagination/gu)?.length ?? 0) === 5 &&
    !/(CollectionListingPresentation|TopicsListingModule|ProjectsHubModulesRenderer)/u.test(
      tracking,
    ) &&
    trackingRoute.includes("loadProjectTrackingDetail") &&
    !/(loadPageCompositionBySlug|ListingModule|ProjectsHubModulesRenderer)/u.test(
      trackingRoute,
    ),
);
check(
  "adopted consumers contain no parallel page-window or page-state owner",
  [topics, media, tracking].every(
    (source) =>
      !source.includes("buildPublicPaginationItems") &&
      !source.includes("Array.from({ length: totalPages") &&
      !source.includes("setCurrentPage("),
  ),
);
check(
  "Projects Listing adopts the one presentation contract while retaining local behavior",
  projectsRenderer.includes('module.slug === "projects-hub-listing"') &&
    projectsListing.includes("const [currentPage, setCurrentPage] = useState(1)") &&
    projectsListing.includes("Array.from({ length: totalPages") &&
    projectsListing.includes("setCurrentPage(page)") &&
    projectsListing.includes('behavior: "smooth"') &&
    projectsListing.includes("PUBLIC_PAGINATION_PRESENTATION") &&
    projectsListing.includes("getPublicPaginationNavigationClassName") &&
    projectsListing.includes("getPublicPaginationPageClassName") &&
    projectsListing.includes('aria-current={currentPage === page ? "page" : undefined}') &&
    !consumerImportPattern.test(projectsListing) &&
    !projectsListing.includes("<PublicPagination"),
);
const projectsPaginationStart = projectsListing.indexOf(
  "{showPagination && totalPages > 1",
);
const projectsPaginationEnd = projectsListing.indexOf(
  "</nav>",
  projectsPaginationStart,
);
const projectsPaginationPresentation = projectsListing.slice(
  projectsPaginationStart,
  projectsPaginationEnd,
);
check(
  "Projects Listing contains no local Pagination classes or alternate visual contract",
  projectsPaginationStart >= 0 &&
    projectsPaginationEnd > projectsPaginationStart &&
    !projectsPaginationPresentation.includes('className="') &&
    !projectsPaginationPresentation.includes("className={`"),
);
const localPublicPaginationFiles = productionSources.filter((path) => {
  if (!path.startsWith("src/components/") || path.includes("/admin/")) {
    return false;
  }
  return read(path).includes("Array.from({ length: totalPages");
});
check(
  "no other Public Pagination implementation exists outside the owner and the presentation-only Projects adapter",
  JSON.stringify(localPublicPaginationFiles) ===
    JSON.stringify(["src/components/projects/ProjectsListSection.tsx"]),
);
check(
  "no production source bypasses the UI owner to import its page model",
  productionSources.filter(
    (path) =>
      path !== "src/components/Pagination.tsx" &&
      /from ["'][^"']*pagination-model["']/u.test(read(path)),
  ).length === 0,
);
check(
  "official architecture declares the bounded Platform owner",
  architecture.includes("## 7.14 Public Pagination Owner") &&
    architecture.includes("`PublicPaginationContract`") &&
    architecture.includes("one canonical Public Pagination design") &&
    architecture.includes("presentation contract only") &&
    currentState.includes("Public Pagination Platform Owner"),
);
check(
  "the owner guard is part of verify and CI",
  packageJson.includes('"verify:public-pagination"') &&
    (packageJson.match(/npm run verify:public-pagination/gu)?.length ?? 0) === 2,
);

console.log(`Public Pagination Platform Owner verification passed (${passed} checks).`);
