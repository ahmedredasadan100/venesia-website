import type { z } from "zod";

import type {
  AdminEntityListQuery,
  AdminEntityListQueryContract,
  AdminEntityListResult,
} from "./contracts";

export type AdminEntityListAdapter<
  Entity extends string,
  Filters extends Record<string, unknown>,
  SortField extends string,
  Row,
  Metrics = unknown,
> = {
  entity: Entity;
  queryContract: AdminEntityListQueryContract<Filters, SortField>;
  resultSchema: z.ZodType<AdminEntityListResult<Row, Metrics>>;
  staleTimeMs: number;
  mutationInvalidation: "entity" | "query";
  load: (
    query: AdminEntityListQuery<Filters, SortField>,
  ) => Promise<AdminEntityListResult<Row, Metrics>>;
};

export type AnyAdminEntityListAdapter = AdminEntityListAdapter<
  string,
  Record<string, unknown>,
  string,
  unknown,
  unknown
>;

export function toAdminEntityListResult<Row, Metrics>(
  rows: Row[],
  query: AdminEntityListQuery<Record<string, unknown>, string>,
  totalRows: number,
  metrics?: Metrics,
): AdminEntityListResult<Row, Metrics> {
  return {
    rows,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalRows,
      totalPages: Math.max(1, Math.ceil(totalRows / query.pageSize)),
    },
    ...(metrics === undefined ? {} : { metrics }),
    meta: {
      generatedAt: new Date().toISOString(),
      mode: query.mode,
    },
  };
}
