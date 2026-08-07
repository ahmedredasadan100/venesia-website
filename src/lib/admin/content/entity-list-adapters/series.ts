import "server-only";

import { z } from "zod";

import {
  seriesListRowSchema,
  type SeriesListRow,
} from "../load-series-list";
import {
  seriesQueryContract,
  type SeriesFilters,
  type SeriesSortField,
} from "../entity-list-contracts/series";
import {
  createAdminEntityListResultSchema,
  type AdminEntityListQuery,
} from "../../entity-list/data-engine/contracts";
import type { AdminEntityListAdapter } from "../../entity-list/data-engine/adapter";

import { getSupabaseAdmin } from "../../../supabase-admin";

const seriesMetricsSchema = z.strictObject({
  total: z.coerce.number().int().nonnegative().finite(),
  published: z.coerce.number().int().nonnegative().finite(),
  unpublished: z.coerce.number().int().nonnegative().finite(),
  topics: z.coerce.number().int().nonnegative().finite(),
  averageTopics: z.coerce.number().nonnegative().finite(),
  categoryOptions: z.array(
    z.strictObject({
      value: z.string(),
      label: z.string(),
      depth: z.number().int().nonnegative().optional(),
      parentValue: z.string().optional(),
    }),
  ),
  categoryDescendantIdsByValue: z.record(z.string(), z.array(z.number().int())),
});

type SeriesMetrics = z.infer<typeof seriesMetricsSchema>;

const seriesReadModelSchema = z.strictObject({
  rows: z.array(seriesListRowSchema.strict()),
  total_count: z.coerce.number().int().nonnegative().finite(),
  page: z.coerce.number().int().positive().finite(),
  metrics: seriesMetricsSchema,
});

export class SeriesEntityListDatabaseError extends Error {
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
    this.name = "SeriesEntityListDatabaseError";
    this.code = error.code ?? null;
    this.details = error.details ?? null;
    this.hint = error.hint ?? null;
  }
}

export async function loadSeriesEntityListResult(
  query: AdminEntityListQuery<SeriesFilters, SeriesSortField>,
) {
  const { data, error } = await getSupabaseAdmin().rpc("admin_list_series", {
    p_page: query.page,
    p_page_size: query.pageSize,
    p_sort_field: query.sort.field,
    p_sort_direction: query.sort.direction,
    p_search: query.search,
    p_status: query.filters.status,
    p_category_id: query.filters.categoryId,
  });
  if (error) throw new SeriesEntityListDatabaseError(error);

  const readModel = seriesReadModelSchema.parse(data);
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

export const seriesEntityListAdapter: AdminEntityListAdapter<
  "series",
  SeriesFilters,
  SeriesSortField,
  SeriesListRow,
  SeriesMetrics
> = {
  entity: "series",
  queryContract: seriesQueryContract,
  resultSchema: createAdminEntityListResultSchema(
    seriesListRowSchema,
    seriesMetricsSchema,
  ),
  staleTimeMs: 30_000,
  mutationInvalidation: "entity",
  load: loadSeriesEntityListResult,
};
