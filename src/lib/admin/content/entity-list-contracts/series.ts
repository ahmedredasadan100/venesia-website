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
  status: "all" | "published" | "unpublished" | "draft" | "archived";
  categoryId: number | null;
};

export const seriesQueryContract: AdminEntityListQueryContract<
  SeriesFilters,
  SeriesSortField
> = {
  mode: "server-page",
  filtersSchema: z.strictObject({
    status: z.enum(["all", "published", "unpublished", "draft", "archived"]),
    categoryId: z.number().int().positive().nullable(),
  }),
  sortFields: seriesSortFields,
  defaultSort: { field: "name", direction: "asc" },
  defaultPageSize: 10,
  pageSizeOptions: [10, 20, 30, 50],
  maxPageSize: 50,
  searchMinLength: 0,
  rawFilterSchemas: {
    status: z.enum(["all", "published", "unpublished", "draft", "archived"]),
    category: z.string().regex(/^[1-9]\d{0,8}$/),
  },
  parseFilters(params) {
    const status = params.get("status");
    const categoryId = Number(params.get("category"));
    return {
      status:
        status &&
        ["published", "unpublished", "draft", "archived"].includes(status)
          ? status
          : "all",
      categoryId:
        Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null,
    };
  },
  writeFilters(filters, params) {
    params.delete("status");
    params.delete("category");
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.categoryId) params.set("category", String(filters.categoryId));
  },
};
