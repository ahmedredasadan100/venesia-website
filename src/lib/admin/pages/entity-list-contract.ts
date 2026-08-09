import { z } from "zod";

import {
  createAdminEntityListResultSchema,
  type AdminEntityListQueryContract,
} from "../entity-list/data-engine/contracts";

export const pageSortFields = [
  "id",
  "title",
  "path",
  "slug",
  "moduleCount",
  "updatedAt",
  "status",
] as const;
export type PageSortField = (typeof pageSortFields)[number];
export const legacyPageSortFields = [
  "id",
  "title",
  "status",
] as const satisfies readonly PageSortField[];
export type PageFilters = Record<string, never>;

export const pageEntityListRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  slug: z.string(),
  path: z.string(),
  page_type: z.string(),
  status: z.string(),
  moduleCount: z.number().int().nonnegative(),
  updatedAt: z.string().nullable(),
  seoScore: z.number().int().min(0).max(100).nullable(),
  seoLabel: z.string().nullable(),
  seoBlockingErrors: z.number().int().nonnegative().nullable(),
});
export type PageEntityListRow = z.infer<typeof pageEntityListRowSchema>;

export const pageEntityListMetricsSchema = z.object({
  readModelContractVersion: z.number().int().positive(),
  supportedSortFields: z.array(z.enum(pageSortFields)),
});
export type PageEntityListMetrics = z.infer<
  typeof pageEntityListMetricsSchema
>;

export const pagesEntityListResultSchema =
  createAdminEntityListResultSchema(
    pageEntityListRowSchema,
    pageEntityListMetricsSchema,
  );

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
