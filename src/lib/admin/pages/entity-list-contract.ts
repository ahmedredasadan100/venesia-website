import { z } from "zod";

import {
  createAdminEntityListResultSchema,
  type AdminEntityListQueryContract,
} from "../entity-list/data-engine/contracts";

export const pageSortFields = [
  "id",
  "title",
  "slug",
  "moduleCount",
  "status",
] as const;
export type PageSortField = (typeof pageSortFields)[number];
export type PageFilters = Record<string, never>;

export const pageEntityListRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  slug: z.string(),
  path: z.string(),
  page_type: z.string(),
  status: z.string(),
  moduleCount: z.number().int().nonnegative(),
});
export type PageEntityListRow = z.infer<typeof pageEntityListRowSchema>;

export const pagesEntityListResultSchema =
  createAdminEntityListResultSchema(pageEntityListRowSchema);

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
