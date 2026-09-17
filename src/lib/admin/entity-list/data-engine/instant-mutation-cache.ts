import type { QueryClient, QueryKey } from "@tanstack/react-query";

import type { AdminEntityListQuery, AdminEntityListResult } from "./contracts.ts";
import {
  isSameAdminEntityListScope,
  parseAdminEntityListQueryFromKey,
} from "./contracts.ts";
import { adminEntityListQueryKeys } from "./query-keys.ts";

/** Mark stale by default; optionally await active reads, never replay the write. */
export async function invalidateAdminEntityListCaches(
  queryClient: Pick<QueryClient, "cancelQueries" | "invalidateQueries">,
  entities: readonly string[],
  refetchType: "none" | "active" = "none",
) {
  const outcomes = await Promise.allSettled(
    [...new Set(entities)].map(async (entity) => {
      const queryKey = adminEntityListQueryKeys.entity(entity);
      // An older in-flight response must not make the pre-save data fresh again.
      await queryClient.cancelQueries({ queryKey });
      if (refetchType === "active") {
        await queryClient.invalidateQueries(
          { queryKey, refetchType },
          { throwOnError: true },
        );
      } else {
        await queryClient.invalidateQueries({ queryKey, refetchType: "none" });
      }
    }),
  );
  const failure = outcomes.find((outcome) => outcome.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
}

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
