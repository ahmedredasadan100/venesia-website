"use client";

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import type { AdminEntityListResult } from "./contracts";
import { adminEntityListQueryKeys } from "./query-keys";

export type AdminEntityMutationError = {
  ok: false;
  code: string;
  message: string;
};
export type AdminEntityMutationSuccess<Payload = Record<string, never>> = Payload & {
  ok: true;
  message: string;
};

type PendingAction = { rowId: number | string; action: string } | null;
type CacheSnapshot<Row, Metrics> = Array<[
  QueryKey,
  AdminEntityListResult<Row, Metrics> | undefined,
]>;

export type AdminInstantMutationPatch<Row> = {
  patchRows: (updater: (row: Row) => Row) => void;
  removeRows: (ids: ReadonlySet<number | string>) => void;
  upsertRows: (rows: Row[], getId: (row: Row) => number | string) => void;
};

export function useAdminEntityInstantMutation<
  Row extends { id: number | string }, Metrics = unknown,
>(entity: string) {
  const queryClient = useQueryClient();
  const [rowPending, setRowPending] = useState<PendingAction>(null);
  const [bulkPending, setBulkPending] = useState<string | null>(null);

  const setAll = useCallback((updater: (
    value: AdminEntityListResult<Row, Metrics>,
  ) => AdminEntityListResult<Row, Metrics>) => {
    queryClient.setQueriesData<AdminEntityListResult<Row, Metrics>>(
      { queryKey: adminEntityListQueryKeys.queries(entity) },
      (data) => data ? updater(data) : data,
    );
  }, [entity, queryClient]);

  const helpers: AdminInstantMutationPatch<Row> = {
    patchRows: (updater) => setAll((data) => ({ ...data, rows: data.rows.map(updater) })),
    removeRows: (ids) => setAll((data) => {
      const rows = data.rows.filter((row) => !ids.has(row.id));
      // The deleted entity count is global for this entity list, not local to
      // whichever cached page happens to contain a row. Every cached query
      // therefore receives the same total adjustment while row removal stays
      // scoped to pages where the row is actually present.
      const totalRows = Math.max(0, data.pagination.totalRows - ids.size);
      return { ...data, rows, pagination: { ...data.pagination, totalRows,
        totalPages: Math.max(1, Math.ceil(totalRows / data.pagination.pageSize)) } };
    }),
    upsertRows: (incoming, getId) => setAll((data) => {
      const replacements = new Map(incoming.map((row) => [getId(row), row]));
      const rows = data.rows.map((row) => replacements.get(getId(row)) ?? row);
      const existing = new Set(rows.map(getId));
      const inserted = incoming.filter((row) => !existing.has(getId(row)));
      const totalRows = data.pagination.totalRows + inserted.length;
      return { ...data, rows: [...inserted, ...rows], pagination: { ...data.pagination,
        totalRows, totalPages: Math.max(1, Math.ceil(totalRows / data.pagination.pageSize)) } };
    }),
  };

  const mutation = useMutation({
    mutationFn: async (request: {
      rowId?: number | string;
      action: string;
      bulk?: boolean;
      optimistic: (cache: AdminInstantMutationPatch<Row>) => void;
      execute: () => Promise<AdminEntityMutationSuccess<Record<string, unknown>> | AdminEntityMutationError>;
    }) => {
      const result = await request.execute();
      if (!result.ok) throw Object.assign(new Error(result.message), result);
      return result;
    },
    onMutate: async (request) => {
      if (request.bulk) setBulkPending(request.action);
      else if (request.rowId != null) setRowPending({ rowId: request.rowId, action: request.action });
      await queryClient.cancelQueries({ queryKey: adminEntityListQueryKeys.entity(entity) });
      const snapshot = queryClient.getQueriesData<AdminEntityListResult<Row, Metrics>>({
        queryKey: adminEntityListQueryKeys.queries(entity),
      });
      request.optimistic(helpers);
      return { snapshot } as { snapshot: CacheSnapshot<Row, Metrics> };
    },
    onError: (_error, _request, context) => {
      context?.snapshot.forEach(([key, value]) => queryClient.setQueryData(key, value));
    },
    onSuccess: () => queryClient.invalidateQueries({
      queryKey: adminEntityListQueryKeys.entity(entity), refetchType: "active",
    }),
    onSettled: () => { setRowPending(null); setBulkPending(null); },
  });

  return { mutateAsync: mutation.mutateAsync, rowPending, bulkPending, error: mutation.error };
}
