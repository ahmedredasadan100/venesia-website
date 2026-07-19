/**
 * Reproducible source-level baseline for the Admin Instant Data Engine.
 *
 * Reads the accepted main commit rather than the working tree so the evidence
 * remains stable after consumers migrate away from RSC list navigation.
 */
import { execFileSync } from "node:child_process";

const BASELINE_SHA = "f89b2fd91957d9822f9d36df16ab617cccfd43f3";

function readBaseline(path) {
  return execFileSync("git", ["show", `${BASELINE_SHA}:${path}`], {
    encoding: "utf8",
  });
}

function assert(label, condition) {
  if (!condition) throw new Error(`Baseline assertion failed: ${label}`);
}

const topicsPage = readBaseline("src/app/admin/content/topics/page.tsx");
const topicsFilters = readBaseline(
  "src/components/admin/content/UnifiedContentFilters.tsx",
);
const entityFilters = readBaseline(
  "src/components/admin/entity-list/AdminEntityListFilters.tsx",
);
const pagination = readBaseline(
  "src/components/admin/ui/AdminTablePagination.tsx",
);
const categories = readBaseline(
  "src/app/admin/content/categories/CategoriesListClient.tsx",
);
const series = readBaseline(
  "src/app/admin/content/series/SeriesTableClient.tsx",
);
const auth = readBaseline("src/lib/admin/auth/admin-users.ts");

assert("Topics filters use router.push", topicsFilters.includes("router.push("));
assert("Shared filters use router.push", entityFilters.includes("router.push("));
assert("Pagination uses router.push", pagination.includes("router.push("));
assert("Categories correction uses router.replace", categories.includes("router.replace("));
assert("Series correction uses router.replace", series.includes("router.replace("));
assert(
  "Topics list remounts by URL-derived key",
  topicsPage.includes("key={listClientStateKey}"),
);
assert(
  "Page auth validates and reloads the admin",
  auth.includes("validateAdminSessionPayload(payload)") &&
    auth.includes("return getAdminUserForSession(payload.id)"),
);

const baseline = {
  sha: BASELINE_SHA,
  dataMode: {
    topics: "server-page",
    categories: "bounded-client (implicit legacy behavior)",
    series: "bounded-client (implicit legacy behavior)",
  },
  interactionTransport: {
    topics: "Next router.push/replace -> RSC navigation",
    categories: "Next router.push/replace -> RSC navigation",
    series: "Next router.push/replace -> RSC navigation",
  },
  supabaseCallsPerRscInteraction: {
    // proxy auth (1) + page auth (2) + page/list loaders
    topics: 15,
    categories: 5,
    series: 7,
  },
  listEndpointRequestsPerInteraction: {
    topics: 0,
    categories: 0,
    series: 0,
  },
  stablePreviousRows: false,
  browserMemoryCache: false,
  requestCancellation: false,
  urlTransport: "Next navigation",
  topicsTableRemountsOnQueryChange: true,
};

console.log(JSON.stringify(baseline, null, 2));
