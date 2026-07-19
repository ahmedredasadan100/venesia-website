import { strict as assert } from "node:assert";
import { z } from "zod";

import {
  normalizeAdminEntityListQuery,
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

console.log("verify-admin-data-engine-contracts passed (7 assertions).");
