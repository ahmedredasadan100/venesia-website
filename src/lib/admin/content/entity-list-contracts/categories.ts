import { z } from "zod";

import type { AdminEntityListQueryContract } from "../../entity-list/data-engine/contracts";

export const categorySortFields = [
  "tree",
  "name",
  "count",
  "status",
  "id",
  "parent",
  "sort_order",
  "published_at",
  "created_at",
  "updated_at",
] as const;
export type CategorySortField = (typeof categorySortFields)[number];
export type CategoryFilters = {
  status: "all" | "published" | "unpublished";
};

export const categoriesQueryContract: AdminEntityListQueryContract<
  CategoryFilters,
  CategorySortField
> = {
  mode: "server-page",
  filtersSchema: z.strictObject({
    status: z.enum(["all", "published", "unpublished"]),
  }),
  sortFields: categorySortFields,
  defaultSort: { field: "tree", direction: "asc" },
  defaultPageSize: 10,
  pageSizeOptions: [10, 20, 30, 50],
  maxPageSize: 50,
  searchMinLength: 0,
  rawFilterSchemas: {
    status: z.enum(["all", "published", "unpublished"]),
  },
  parseFilters(params) {
    const status = params.get("status");
    return {
      status:
        status === "published" || status === "unpublished" ? status : "all",
    };
  },
  writeFilters(filters, params) {
    params.delete("status");
    if (filters.status !== "all") params.set("status", filters.status);
  },
};
