import { strict as assert } from "node:assert";
import { z } from "zod";

import {
  AdminEntityListQueryValidationError,
  normalizeAdminEntityListQuery,
  parseAdminEntityListRequestQuery,
  serializeAdminEntityListQuery,
  writeAdminEntityListQuery,
  type AdminEntityListQueryContract,
} from "../src/lib/admin/entity-list/data-engine/contracts.ts";
import { adminEntityListQueryKeys } from "../src/lib/admin/entity-list/data-engine/query-keys.ts";

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

console.log("verify-admin-data-engine-contracts passed (24 assertions).");
