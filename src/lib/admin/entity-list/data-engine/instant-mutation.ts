"use client";

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import type { AdminEntityListResult } from "./contracts";
import {
  removeAdminEntityRows,
  replaceExistingAdminEntityRows,
} from "./instant-mutation-cache";
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
    removeRows: (ids) => setAll((data) => removeAdminEntityRows(data, ids)),
    // Safe for paginated/sorted caches: replace rows only where they already
    // exist. Inserts require targeted invalidation because their destination
    // page cannot be inferred generically.
    upsertRows: (incoming, getId) => setAll((data) =>
      replaceExistingAdminEntityRows(data, incoming, getId)),
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
