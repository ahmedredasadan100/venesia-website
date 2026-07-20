import type { AdminEntityListResult } from "./contracts";

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
