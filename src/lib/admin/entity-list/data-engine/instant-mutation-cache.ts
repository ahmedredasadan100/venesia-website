import type { QueryClient, QueryKey } from "@tanstack/react-query";

import type { AdminEntityListQuery, AdminEntityListResult } from "./contracts.ts";
import {
  isSameAdminEntityListScope,
  parseAdminEntityListQueryFromKey,
} from "./contracts.ts";
import { adminEntityListQueryKeys } from "./query-keys.ts";

export function removeAdminEntityRows<
  Row extends { id: number | string },
  Metrics,
>(
  data: AdminEntityListResult<Row, Metrics>,
  ids: ReadonlySet<number | string>,
): AdminEntityListResult<Row, Metrics> {
  const rows = data.rows.filter((row) => !ids.has(row.id));
  const totalRows = Math.max(0, data.pagination.totalRows - ids.size);

  return {
    ...data,
    rows,
    pagination: {
      ...data.pagination,
      totalRows,
      totalPages: Math.max(
        1,
        Math.ceil(totalRows / data.pagination.pageSize),
      ),
    },
  };
}

export function replaceExistingAdminEntityRows<Row, Metrics>(
  data: AdminEntityListResult<Row, Metrics>,
  incoming: readonly Row[],
  getId: (row: Row) => number | string,
): AdminEntityListResult<Row, Metrics> {
  const replacements = new Map(incoming.map((row) => [getId(row), row]));

  return {
    ...data,
    rows: data.rows.map((row) => replacements.get(getId(row)) ?? row),
  };
}

export function matchesAdminEntityListScope(
  queryKey: QueryKey,
  scope: AdminEntityListQuery<Record<string, unknown>, string>,
) {
  const cached = parseAdminEntityListQueryFromKey(queryKey);
  return cached != null && isSameAdminEntityListScope(cached, scope);
}

/** Patch only caches that share the active list scope (not every entity query). */
export function setAdminEntityListCachesInScope<Row, Metrics>(
  queryClient: Pick<QueryClient, "setQueriesData">,
  entity: string,
  scope: AdminEntityListQuery<Record<string, unknown>, string>,
  updater: (
    value: AdminEntityListResult<Row, Metrics>,
  ) => AdminEntityListResult<Row, Metrics>,
) {
  queryClient.setQueriesData<AdminEntityListResult<Row, Metrics>>(
    {
      queryKey: adminEntityListQueryKeys.queries(entity),
      predicate: (query) => matchesAdminEntityListScope(query.queryKey, scope),
    },
    (data) => (data ? updater(data) : data),
  );
}
