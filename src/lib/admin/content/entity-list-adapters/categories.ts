import "server-only";

import { z } from "zod";

import {
  categoryListRowSchema,
  loadCategoriesListData,
  type CategoryListRow,
} from "../load-categories-list";
import {
  categoriesQueryContract,
  type CategoryFilters,
  type CategorySortField,
} from "../entity-list-contracts/categories";
import { createAdminEntityListResultSchema } from "../../entity-list/data-engine/contracts";
import type { AdminEntityListAdapter } from "../../entity-list/data-engine/adapter";

function compareRows(
  left: CategoryListRow,
  right: CategoryListRow,
  field: CategorySortField,
) {
  if (field === "count") return left.totalCount - right.totalCount;
  if (field === "status") {
    return Number(Boolean(left.is_active)) - Number(Boolean(right.is_active));
  }
  if (field === "id") return left.id - right.id;
  if (field === "parent") {
    return (left.parent_name ?? "").localeCompare(right.parent_name ?? "", "ar");
  }
  if (field === "sort_order") {
    return (left.sort_order ?? 0) - (right.sort_order ?? 0);
  }
  if (field === "created_at" || field === "updated_at") {
    return String(left[field] ?? "").localeCompare(String(right[field] ?? ""));
  }
  return left.name.localeCompare(right.name, "ar");
}

export const categoriesEntityListAdapter: AdminEntityListAdapter<
  "categories",
  CategoryFilters,
  CategorySortField,
  CategoryListRow,
  {
    parentOptions: Array<{ id: number; name: string; level: number }>;
    total: number;
    published: number;
    topics: number;
  }
> = {
  entity: "categories",
  queryContract: categoriesQueryContract,
  resultSchema: createAdminEntityListResultSchema(
    categoryListRowSchema,
    z.object({
      parentOptions: z.array(
        z.object({
          id: z.number().int().positive(),
          name: z.string(),
          level: z.number().int().nonnegative(),
        }),
      ),
      total: z.number().int().nonnegative(),
      published: z.number().int().nonnegative(),
      topics: z.number().int().nonnegative(),
    }),
  ),
  staleTimeMs: 30_000,
  mutationInvalidation: "entity",
  async load(query) {
    const source = await loadCategoriesListData();
    const rowById = new Map(source.rows.map((row) => [row.id, row]));
    const matchingIds = new Set<number>();
    const search = query.search.toLocaleLowerCase("ar");

    source.rows.forEach((row) => {
      const statusMatches =
        query.filters.status === "all" ||
        (query.filters.status === "published" && Boolean(row.is_active)) ||
        (query.filters.status === "hidden" && !row.is_active);
      if (
        statusMatches &&
        (!search || row.name.toLocaleLowerCase("ar").includes(search))
      ) {
        matchingIds.add(row.id);
      }
    });
    matchingIds.forEach((id) => {
      let parentId = rowById.get(id)?.parent_id ?? null;
      const visited = new Set<number>();
      while (parentId && !visited.has(parentId)) {
        visited.add(parentId);
        matchingIds.add(parentId);
        parentId = rowById.get(parentId)?.parent_id ?? null;
      }
    });

    let filtered = source.rows.filter((row) => matchingIds.has(row.id));
    if (query.sort.field !== "tree") {
      filtered = [...filtered].sort((left, right) => {
        const result = compareRows(left, right, query.sort.field);
        return query.sort.direction === "asc" ? result : -result;
      });
    }

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
        parentOptions: source.parentOptions,
        total: source.rows.length,
        published: source.rows.filter((row) => Boolean(row.is_active)).length,
        topics: source.rows.reduce((sum, row) => sum + row.ownCount, 0),
      },
      meta: {
        generatedAt: new Date().toISOString(),
        mode: query.mode,
      },
    };
  },
};
