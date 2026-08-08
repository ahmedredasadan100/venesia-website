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
  view: "active" | "trash";
  status: "all" | "published" | "unpublished";
};

export const categoriesQueryContract: AdminEntityListQueryContract<
  CategoryFilters,
  CategorySortField
> = {
  mode: "server-page",
  filtersSchema: z.strictObject({
    view: z.enum(["active", "trash"]),
    status: z.enum(["all", "published", "unpublished"]),
  }),
  sortFields: categorySortFields,
  defaultSort: { field: "tree", direction: "asc" },
  defaultPageSize: 10,
  pageSizeOptions: [10, 20, 30, 50],
  maxPageSize: 50,
  searchMinLength: 0,
  rawFilterSchemas: {
    view: z.enum(["active", "trash"]),
    status: z.enum(["all", "published", "unpublished"]),
  },
  parseFilters(params) {
    const view = params.get("view");
    const status = params.get("status");
    return {
      view: view === "trash" ? "trash" : "active",
      status:
        status === "published" || status === "unpublished" ? status : "all",
    };
  },
  writeFilters(filters, params) {
    params.delete("view");
    params.delete("status");
    if (filters.view === "trash") params.set("view", "trash");
    if (filters.status !== "all") params.set("status", filters.status);
  },
};
