import "server-only";

import { z } from "zod";

import {
  loadSeriesListData,
  seriesListRowSchema,
  type SeriesListRow,
} from "../load-series-list";
import {
  seriesQueryContract,
  type SeriesFilters,
  type SeriesSortField,
} from "../entity-list-contracts/series";
import { createAdminEntityListResultSchema } from "../../entity-list/data-engine/contracts";
import type { AdminEntityListAdapter } from "../../entity-list/data-engine/adapter";

function compareRows(
  left: SeriesListRow,
  right: SeriesListRow,
  field: SeriesSortField,
) {
  if (field === "topics_count") return left.topics_count - right.topics_count;
  if (field === "id") return left.id - right.id;
  if (field === "sort_order") {
    return (left.sort_order ?? 0) - (right.sort_order ?? 0);
  }
  if (field === "category") {
    return (left.category_name ?? "").localeCompare(
      right.category_name ?? "",
      "ar",
    );
  }
  if (field === "created_at" || field === "updated_at") {
    return String(left[field] ?? "").localeCompare(String(right[field] ?? ""));
  }
  return String(left[field] ?? "").localeCompare(
    String(right[field] ?? ""),
    field === "slug" ? "en" : "ar",
  );
}

const seriesMetricsSchema = z.object({
  total: z.number().int().nonnegative(),
  published: z.number().int().nonnegative(),
  topics: z.number().int().nonnegative(),
  categoryOptions: z.array(
    z.object({ value: z.string(), label: z.string() }),
  ),
  categoryDescendantIdsByValue: z.record(z.string(), z.array(z.number().int())),
});

type SeriesMetrics = z.infer<typeof seriesMetricsSchema>;

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
  async load(query) {
    const source = await loadSeriesListData();
    const selectedCategoryIds = new Set(
      query.filters.categoryId
        ? (source.categoryFilterModel.descendantIdsByValue[
            String(query.filters.categoryId)
          ] ?? [query.filters.categoryId])
        : [],
    );
    const search = query.search.toLocaleLowerCase("ar");
    const filtered = source.rows
      .filter((row) => {
        if (
          query.filters.status !== "all" &&
          row.status !== query.filters.status
        ) {
          return false;
        }
        if (
          query.filters.categoryId &&
          (row.category_id === null || !selectedCategoryIds.has(row.category_id))
        ) {
          return false;
        }
        return (
          !search ||
          row.name.toLocaleLowerCase("ar").includes(search) ||
          row.slug.toLocaleLowerCase("en").includes(search)
        );
      })
      .sort((left, right) => {
        const result = compareRows(left, right, query.sort.field);
        return query.sort.direction === "asc" ? result : -result;
      });
    const totalRows = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const from = (page - 1) * query.pageSize;

    return {
      rows: filtered.slice(from, from + query.pageSize),
      pagination: {
        page,
        pageSize: query.pageSize,
        totalRows,
        totalPages,
      },
      metrics: {
        ...source.metrics,
        categoryOptions: source.categoryFilterModel.options,
        categoryDescendantIdsByValue:
          source.categoryFilterModel.descendantIdsByValue,
      },
      meta: {
        generatedAt: new Date().toISOString(),
        mode: query.mode,
      },
    };
  },
};
