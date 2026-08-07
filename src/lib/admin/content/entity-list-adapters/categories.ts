import "server-only";

import { z } from "zod";

import {
  categoryListRowSchema,
  type CategoryListRow,
} from "../load-categories-list";
import {
  categoriesQueryContract,
  type CategoryFilters,
  type CategorySortField,
} from "../entity-list-contracts/categories";
import {
  createAdminEntityListResultSchema,
  type AdminEntityListQuery,
} from "../../entity-list/data-engine/contracts";
import type { AdminEntityListAdapter } from "../../entity-list/data-engine/adapter";

import { getSupabaseAdmin } from "../../../supabase-admin";

const categoryMetricsSchema = z.strictObject({
  parentOptions: z.array(
    z.strictObject({
      id: z.number().int().positive(),
      name: z.string(),
      level: z.number().int().nonnegative(),
    }),
  ),
  total: z.coerce.number().int().nonnegative().finite(),
  published: z.coerce.number().int().nonnegative().finite(),
  unpublished: z.coerce.number().int().nonnegative().finite(),
  topics: z.coerce.number().int().nonnegative().finite(),
  series: z.coerce.number().int().nonnegative().finite(),
});

type CategoryMetrics = z.output<typeof categoryMetricsSchema>;

const categoriesReadModelSchema = z.strictObject({
  rows: z.array(categoryListRowSchema.strict()),
  total_count: z.coerce.number().int().nonnegative().finite(),
  page: z.coerce.number().int().positive().finite(),
  metrics: categoryMetricsSchema,
});

export class CategoriesEntityListDatabaseError extends Error {
  readonly code: string | null;
  readonly details: string | null;
  readonly hint: string | null;

  constructor(error: {
    message: string;
    code?: string | null;
    details?: string | null;
    hint?: string | null;
  }) {
    super(error.message);
    this.name = "CategoriesEntityListDatabaseError";
    this.code = error.code ?? null;
    this.details = error.details ?? null;
    this.hint = error.hint ?? null;
  }
}

export async function loadCategoriesEntityListResult(
  query: AdminEntityListQuery<CategoryFilters, CategorySortField>,
) {
  const { data, error } = await getSupabaseAdmin().rpc(
    "admin_list_categories",
    {
      p_page: query.page,
      p_page_size: query.pageSize,
      p_sort_field: query.sort.field,
      p_sort_direction: query.sort.direction,
      p_search: query.search,
      p_status: query.filters.status,
    },
  );
  if (error) throw new CategoriesEntityListDatabaseError(error);

  const readModel = categoriesReadModelSchema.parse(data);
  const totalRows = readModel.total_count;
  const totalPages = Math.max(1, Math.ceil(totalRows / query.pageSize));

  return {
    rows: readModel.rows,
    pagination: {
      page: readModel.page,
      pageSize: query.pageSize,
      totalRows,
      totalPages,
    },
    metrics: readModel.metrics,
    meta: { generatedAt: new Date().toISOString(), mode: query.mode },
  };
}

export const categoriesEntityListAdapter: AdminEntityListAdapter<
  "categories",
  CategoryFilters,
  CategorySortField,
  CategoryListRow,
  CategoryMetrics
> = {
  entity: "categories",
  queryContract: categoriesQueryContract,
  resultSchema: createAdminEntityListResultSchema(
    categoryListRowSchema,
    categoryMetricsSchema,
  ),
  staleTimeMs: 30_000,
  mutationInvalidation: "entity",
  load: loadCategoriesEntityListResult,
};
