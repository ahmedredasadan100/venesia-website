import { z } from "zod";

import type { AdminEntityListQueryContract } from "../entity-list/data-engine/contracts";

export const pageSortFields = ["id", "title", "status"] as const;
export type PageSortField = (typeof pageSortFields)[number];
export type PageFilters = Record<string, never>;

export const pagesQueryContract: AdminEntityListQueryContract<PageFilters, PageSortField> = {
  mode: "server-page",
  filtersSchema: z.strictObject({}),
  sortFields: pageSortFields,
  defaultSort: { field: "id", direction: "asc" },
  defaultPageSize: 10,
  pageSizeOptions: [10, 20, 30],
  maxPageSize: 30,
  searchMinLength: 1,
  rawFilterSchemas: {},
  parseFilters: () => ({}),
  writeFilters: () => {},
};
