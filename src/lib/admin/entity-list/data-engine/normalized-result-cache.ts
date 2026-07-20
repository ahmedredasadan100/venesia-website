import type { QueryClient } from "@tanstack/react-query";

import type {
  AdminEntityListQuery,
  AdminEntityListResult,
} from "./contracts";
import { adminEntityListQueryKeys } from "./query-keys.ts";

export function cacheNormalizedAdminEntityListResult<
  Filters extends Record<string, unknown>,
  SortField extends string,
  Row,
  Metrics,
>(
  queryClient: Pick<QueryClient, "setQueryData">,
  entity: string,
  query: AdminEntityListQuery<Filters, SortField>,
  result: AdminEntityListResult<Row, Metrics>,
): AdminEntityListQuery<Filters, SortField> | null {
  if (result.pagination.page === query.page) return null;

  const normalizedQuery = {
    ...query,
    page: result.pagination.page,
  };
  const normalizedKey = adminEntityListQueryKeys.query(
    entity,
    normalizedQuery as AdminEntityListQuery<Record<string, unknown>, string>,
  );
  queryClient.setQueryData(normalizedKey, result);

  return normalizedQuery;
}
