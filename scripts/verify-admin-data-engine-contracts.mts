import { strict as assert } from "node:assert";
import { QueryClient } from "@tanstack/react-query";
import { z } from "zod";

import {
  AdminEntityListQueryValidationError,
  isSameAdminEntityListScope,
  normalizeAdminEntityListQuery,
  parseAdminEntityListRequestQuery,
  serializeAdminEntityListQuery,
  writeAdminEntityListQuery,
  type AdminEntityListQueryContract,
  type AdminEntityListResult,
} from "../src/lib/admin/entity-list/data-engine/contracts.ts";
import { adminEntityListQueryKeys } from "../src/lib/admin/entity-list/data-engine/query-keys.ts";
import {
  removeAdminEntityRows,
  replaceExistingAdminEntityRows,
  setAdminEntityListCachesInScope,
} from "../src/lib/admin/entity-list/data-engine/instant-mutation-cache.ts";
import { cacheNormalizedAdminEntityListResult } from "../src/lib/admin/entity-list/data-engine/normalized-result-cache.ts";

type Filters = { status: "all" | "published"; category: number | null };
type SortField = "title" | "created_at";

const contract: AdminEntityListQueryContract<Filters, SortField> = {
  mode: "server-page",
  filtersSchema: z.strictObject({
    status: z.enum(["all", "published"]),
    category: z.number().int().positive().nullable(),
  }),
  sortFields: ["title", "created_at"],
  defaultSort: { field: "title", direction: "asc" },
  defaultPageSize: 10,
  pageSizeOptions: [10, 20, 50],
  maxPageSize: 50,
  searchMinLength: 2,
  rawFilterSchemas: {
    status: z.enum(["all", "published"]),
    category: z.string().regex(/^[1-9]\d{0,8}$/),
  },
  parseFilters(params) {
    const category = Number(params.get("category"));
    return {
      status: params.get("status") === "published" ? "published" : "all",
      category: Number.isInteger(category) && category > 0 ? category : null,
    };
  },
  writeFilters(filters, params) {
    params.delete("status");
    params.delete("category");
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.category) params.set("category", String(filters.category));
  },
};

const normalized = normalizeAdminEntityListQuery(
  contract,
  "z=preserved&status=invalid&category=-1&sort=unsafe_desc&page=-2&limit=999&q=%20+a%20",
);
assert.deepEqual(normalized, {
  search: "",
  filters: { status: "all", category: null },
  sort: { field: "title", direction: "asc" },
  page: 1,
  pageSize: 10,
  mode: "server-page",
});

const equivalent = normalizeAdminEntityListQuery(
  contract,
  "limit=10&page=1&sort=title_asc",
);
assert.equal(
  serializeAdminEntityListQuery(normalized),
  serializeAdminEntityListQuery(equivalent),
);
assert.deepEqual(
  adminEntityListQueryKeys.query("example", normalized),
  adminEntityListQueryKeys.query("example", equivalent),
);

const populated = normalizeAdminEntityListQuery(
  contract,
  "q=hello++world&status=published&category=4&sort=created_at_desc&page=3&limit=20",
);
const url = writeAdminEntityListQuery(
  contract,
  populated,
  new URLSearchParams("notice=saved"),
);
assert.equal(
  url.toString(),
  "category=4&limit=20&notice=saved&page=3&q=hello+world&sort=created_at_desc&status=published",
);
assert.deepEqual(normalizeAdminEntityListQuery(contract, url), populated);

// Strict request-boundary parsing: invalid raw input must be rejected,
// never silently defaulted.
function assertRejected(label: string, raw: string) {
  assert.throws(
    () => parseAdminEntityListRequestQuery(contract, raw),
    AdminEntityListQueryValidationError,
    `expected rejection for ${label}: ${raw}`,
  );
}

assertRejected("invalid page", "page=abc");
assertRejected("zero page", "page=0");
assertRejected("negative page", "page=-2");
assertRejected("invalid limit", "limit=abc");
assertRejected("unsupported limit", "limit=15");
assertRejected("oversized limit", "limit=9999");
assertRejected("invalid sort field", "sort=unsafe_desc");
assertRejected("invalid sort direction", "sort=title_up");
assertRejected("invalid status", "status=bogus");
assertRejected("malformed category id", "category=-1");
assertRejected("non-numeric category id", "category=abc");
assertRejected("unknown parameter", "table=admin_users");
assertRejected("repeated parameter", "page=1&page=2");

// Valid raw queries pass through to canonical normalization.
assert.deepEqual(
  parseAdminEntityListRequestQuery(contract, "page=2&limit=20&sort=created_at_desc&status=published&category=4&q=hello"),
  normalizeAdminEntityListQuery(contract, "page=2&limit=20&sort=created_at_desc&status=published&category=4&q=hello"),
);
// Omitted params fall back to canonical defaults.
assert.deepEqual(parseAdminEntityListRequestQuery(contract, ""), normalized);
// Canonical URL writer emits only strict-parseable output (round trip).
assert.deepEqual(
  parseAdminEntityListRequestQuery(contract, writeAdminEntityListQuery(contract, populated)),
  populated,
);
// Canonical defaults do not pollute the URL.
assert.equal(writeAdminEntityListQuery(contract, normalized).toString(), "");

const cachedPages = [
  {
    rows: [
      { id: 1, title: "One" },
      { id: 2, title: "Two" },
      { id: 3, title: "Three" },
    ],
    pagination: { page: 1, pageSize: 3, totalRows: 4, totalPages: 2 },
    meta: { generatedAt: "2026-07-20T00:00:00.000Z", mode: "server-page" as const },
  },
  {
    rows: [{ id: 4, title: "Four" }],
    pagination: { page: 2, pageSize: 3, totalRows: 4, totalPages: 2 },
    meta: { generatedAt: "2026-07-20T00:00:00.000Z", mode: "server-page" as const },
  },
];

const replacedPages = cachedPages.map((page) =>
  replaceExistingAdminEntityRows(
    page,
    [
      { id: 4, title: "Four updated" },
      { id: 99, title: "Must not be inserted" },
    ],
    (row) => row.id,
  ));
assert.deepEqual(replacedPages[0].rows, cachedPages[0].rows);
assert.deepEqual(replacedPages[1].rows, [{ id: 4, title: "Four updated" }]);
assert.ok(replacedPages.every((page) => !page.rows.some((row) => row.id === 99)));
assert.deepEqual(
  replacedPages.map((page) => page.pagination.totalRows),
  [4, 4],
);

const afterLastPageRowDelete = cachedPages.map((page) =>
  removeAdminEntityRows(page, new Set([4])));
assert.deepEqual(afterLastPageRowDelete[0].rows, cachedPages[0].rows);
assert.deepEqual(afterLastPageRowDelete[1].rows, []);
assert.deepEqual(
  afterLastPageRowDelete.map((page) => page.pagination.totalRows),
  [3, 3],
);
assert.deepEqual(
  afterLastPageRowDelete.map((page) => page.pagination.totalPages),
  [1, 1],
);

const pageOneQuery = { ...normalized, page: 1, pageSize: 3 };
const pageTwoQuery = { ...normalized, page: 2, pageSize: 3 };
const differentSortQuery = {
  ...normalized,
  page: 1,
  pageSize: 3,
  sort: { field: "created_at" as const, direction: "desc" as const },
};
const differentPageSizeQuery = {
  ...normalized,
  page: 1,
  pageSize: 2,
};
const unrelatedSearchQuery = {
  ...normalized,
  search: "other",
  page: 1,
  pageSize: 3,
};
const unrelatedFilterQuery = {
  ...normalized,
  page: 1,
  pageSize: 3,
  filters: { status: "published" as const, category: null },
};
const unrelatedModeQuery = {
  ...normalized,
  page: 1,
  pageSize: 3,
  mode: "bounded-client" as const,
};
assert.equal(isSameAdminEntityListScope(pageOneQuery, pageTwoQuery), true);
assert.equal(isSameAdminEntityListScope(pageOneQuery, differentSortQuery), true);
assert.equal(isSameAdminEntityListScope(pageOneQuery, differentPageSizeQuery), true);
assert.equal(isSameAdminEntityListScope(pageOneQuery, unrelatedSearchQuery), false);
assert.equal(isSameAdminEntityListScope(pageOneQuery, unrelatedFilterQuery), false);
assert.equal(isSameAdminEntityListScope(pageOneQuery, unrelatedModeQuery), false);

type ScopeRow = { id: number; title: string };
const scopeMeta = {
  generatedAt: "2026-07-20T00:00:00.000Z",
  mode: "server-page" as const,
};
const scopeClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
});
scopeClient.setQueryData(
  adminEntityListQueryKeys.query("pages", pageOneQuery),
  {
    rows: [
      { id: 1, title: "One" },
      { id: 2, title: "Two" },
      { id: 3, title: "Three" },
    ],
    pagination: { page: 1, pageSize: 3, totalRows: 4, totalPages: 2 },
    meta: scopeMeta,
  } satisfies AdminEntityListResult<ScopeRow>,
);
scopeClient.setQueryData(
  adminEntityListQueryKeys.query("pages", pageTwoQuery),
  {
    rows: [{ id: 4, title: "Four" }],
    pagination: { page: 2, pageSize: 3, totalRows: 4, totalPages: 2 },
    meta: scopeMeta,
  } satisfies AdminEntityListResult<ScopeRow>,
);
scopeClient.setQueryData(
  adminEntityListQueryKeys.query("pages", differentSortQuery),
  {
    rows: [
      { id: 4, title: "Four" },
      { id: 3, title: "Three" },
      { id: 2, title: "Two" },
    ],
    pagination: { page: 1, pageSize: 3, totalRows: 4, totalPages: 2 },
    meta: scopeMeta,
  } satisfies AdminEntityListResult<ScopeRow>,
);
scopeClient.setQueryData(
  adminEntityListQueryKeys.query("pages", differentPageSizeQuery),
  {
    rows: [
      { id: 1, title: "One" },
      { id: 2, title: "Two" },
    ],
    pagination: { page: 1, pageSize: 2, totalRows: 4, totalPages: 2 },
    meta: scopeMeta,
  } satisfies AdminEntityListResult<ScopeRow>,
);
scopeClient.setQueryData(
  adminEntityListQueryKeys.query("pages", unrelatedSearchQuery),
  {
    rows: [{ id: 4, title: "Four" }],
    pagination: { page: 1, pageSize: 3, totalRows: 1, totalPages: 1 },
    meta: scopeMeta,
  } satisfies AdminEntityListResult<ScopeRow>,
);
scopeClient.setQueryData(
  adminEntityListQueryKeys.query("pages", unrelatedFilterQuery),
  {
    rows: [{ id: 4, title: "Four" }],
    pagination: { page: 1, pageSize: 3, totalRows: 2, totalPages: 1 },
    meta: scopeMeta,
  } satisfies AdminEntityListResult<ScopeRow>,
);
const relatedSnapshot = scopeClient.getQueriesData<AdminEntityListResult<ScopeRow>>({
  queryKey: adminEntityListQueryKeys.queries("pages"),
  predicate: (query) =>
    isSameAdminEntityListScope(
      JSON.parse(String(query.queryKey[3])) as typeof pageOneQuery,
      pageOneQuery,
    ),
});
assert.equal(relatedSnapshot.length, 4);
setAdminEntityListCachesInScope<ScopeRow, unknown>(
  scopeClient,
  "pages",
  pageOneQuery,
  (data) => removeAdminEntityRows(data, new Set([4])),
);
const readScoped = (query: typeof pageOneQuery) =>
  scopeClient.getQueryData<AdminEntityListResult<ScopeRow>>(
    adminEntityListQueryKeys.query("pages", query),
  )?.pagination;
assert.deepEqual(
  [
    readScoped(pageOneQuery)?.totalRows,
    readScoped(pageTwoQuery)?.totalRows,
    readScoped(differentSortQuery)?.totalRows,
    readScoped(differentPageSizeQuery)?.totalRows,
  ],
  [3, 3, 3, 3],
);
assert.deepEqual(
  [
    readScoped(pageOneQuery)?.totalPages,
    readScoped(pageTwoQuery)?.totalPages,
    readScoped(differentSortQuery)?.totalPages,
    readScoped(differentPageSizeQuery)?.totalPages,
  ],
  // pageSize 3 → ceil(3/3)=1; pageSize 2 → ceil(3/2)=2
  [1, 1, 1, 2],
);
assert.equal(readScoped(unrelatedSearchQuery)?.totalRows, 1);
assert.equal(readScoped(unrelatedFilterQuery)?.totalRows, 2);
relatedSnapshot.forEach(([key, value]) => scopeClient.setQueryData(key, value));
assert.deepEqual(
  [
    readScoped(pageOneQuery)?.totalRows,
    readScoped(pageTwoQuery)?.totalRows,
    readScoped(differentSortQuery)?.totalRows,
    readScoped(differentPageSizeQuery)?.totalRows,
  ],
  [4, 4, 4, 4],
);
assert.deepEqual(
  [
    readScoped(pageOneQuery)?.totalPages,
    readScoped(pageTwoQuery)?.totalPages,
    readScoped(differentSortQuery)?.totalPages,
    readScoped(differentPageSizeQuery)?.totalPages,
  ],
  [2, 2, 2, 2],
);
assert.equal(readScoped(unrelatedSearchQuery)?.totalRows, 1);
assert.equal(readScoped(unrelatedFilterQuery)?.totalRows, 2);
scopeClient.clear();

const controllerQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
});
const requestedOutOfRangeQuery = { ...normalized, page: 999 };
const normalizedResult = {
  rows: [{ id: 4, title: "Last page row" }],
  pagination: { page: 2, pageSize: 10, totalRows: 11, totalPages: 2 },
  meta: { generatedAt: "2026-07-20T00:00:00.000Z", mode: "server-page" as const },
};
let clientEndpointRequests = 0;
let reconciledPage: number | null = null;
await controllerQueryClient.fetchQuery({
  queryKey: adminEntityListQueryKeys.query("pages", requestedOutOfRangeQuery),
  queryFn: async () => {
    clientEndpointRequests += 1;
    const reconciledQuery = cacheNormalizedAdminEntityListResult(
      controllerQueryClient,
      "pages",
      requestedOutOfRangeQuery,
      normalizedResult,
    );
    reconciledPage = reconciledQuery?.page ?? null;
    return normalizedResult;
  },
});
assert.equal(reconciledPage, 2);
const normalizedCacheResult = await controllerQueryClient.fetchQuery({
  queryKey: adminEntityListQueryKeys.query("pages", {
    ...requestedOutOfRangeQuery,
    page: 2,
  }),
  queryFn: async () => {
    clientEndpointRequests += 1;
    throw new Error("Normalized query must reuse the transferred result.");
  },
});
assert.equal(clientEndpointRequests, 1);
assert.deepEqual(normalizedCacheResult, normalizedResult);
controllerQueryClient.clear();

console.log("verify-admin-data-engine-contracts passed (52 assertions).");
console.log(`out-of-range client endpoint request count: ${clientEndpointRequests}`);
