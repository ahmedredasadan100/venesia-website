import { z } from "zod";

import type { AdminEntityListQueryContract } from "../../entity-list/data-engine/contracts";

export const seriesSortFields = [
  "name",
  "topics_count",
  "status",
  "id",
  "slug",
  "category",
  "sort_order",
  "created_at",
  "updated_at",
] as const;
export type SeriesSortField = (typeof seriesSortFields)[number];
export type SeriesFilters = {
  view: "active" | "trash";
  status: "all" | "published" | "unpublished";
  categoryId: number | null;
};

export const seriesQueryContract: AdminEntityListQueryContract<
  SeriesFilters,
  SeriesSortField
> = {
  mode: "server-page",
  filtersSchema: z.strictObject({
    view: z.enum(["active", "trash"]),
    status: z.enum(["all", "published", "unpublished"]),
    categoryId: z.number().int().positive().nullable(),
  }),
  sortFields: seriesSortFields,
  defaultSort: { field: "name", direction: "asc" },
  defaultPageSize: 10,
  pageSizeOptions: [10, 20, 30, 50],
  maxPageSize: 50,
  searchMinLength: 0,
  rawFilterSchemas: {
    view: z.enum(["active", "trash"]),
    status: z.enum(["all", "published", "unpublished"]),
    category: z.string().regex(/^[1-9]\d{0,8}$/),
  },
  parseFilters(params) {
    const view = params.get("view");
    const status = params.get("status");
    const categoryId = Number(params.get("category"));
    return {
      view: view === "trash" ? "trash" : "active",
      status:
        status &&
        ["published", "unpublished"].includes(status)
          ? status
          : "all",
      categoryId:
        Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null,
    };
  },
  writeFilters(filters, params) {
    params.delete("view");
    params.delete("status");
    params.delete("category");
    if (filters.view === "trash") params.set("view", "trash");
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.categoryId) params.set("category", String(filters.categoryId));
  },
};
