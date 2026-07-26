"use client";

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useRef, useState } from "react";

import type {
  AdminEntityListQuery,
  AdminEntityListResult,
} from "./contracts";
import {
  matchesAdminEntityListScope,
  removeAdminEntityRows,
  replaceExistingAdminEntityRows,
  setAdminEntityListCachesInScope,
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
  feedbackStatus?: "success" | "warning";
};

type PendingAction = { rowId: number | string; action: string } | null;
type CacheSnapshot<Row, Metrics> = Array<[
  QueryKey,
  AdminEntityListResult<Row, Metrics> | undefined,
]>;

type AdminEntityMutationResult =
  | AdminEntityMutationSuccess<Record<string, unknown>>
  | AdminEntityMutationError;

export type AdminEntityMutationRequest<Row> = {
  rowId?: number | string;
  action: string;
  bulk?: boolean;
  optimistic: (cache: AdminInstantMutationPatch<Row>) => void;
  execute: () => Promise<AdminEntityMutationResult>;
  reconcileSuccess?: (
    result: AdminEntityMutationSuccess<Record<string, unknown>>,
    tools: {
      cache: AdminInstantMutationPatch<Row>;
      restoreSnapshot: () => void;
    },
  ) => void;
};

export type AdminInstantMutationPatch<Row> = {
  patchRows: (updater: (row: Row) => Row) => void;
  removeRows: (ids: ReadonlySet<number | string>) => void;
  upsertRows: (rows: Row[], getId: (row: Row) => number | string) => void;
};

export function useAdminEntityInstantMutation<
  Row extends { id: number | string }, Metrics = unknown,
>(
  entity: string,
  scopeQuery: AdminEntityListQuery<Record<string, unknown>, string>,
) {
  const queryClient = useQueryClient();
  const inFlightRef = useRef(false);
  const [rowPending, setRowPending] = useState<PendingAction>(null);
  const [bulkPending, setBulkPending] = useState<string | null>(null);

  const helpers: AdminInstantMutationPatch<Row> = {
    patchRows: (updater) => setAdminEntityListCachesInScope<Row, Metrics>(
      queryClient,
      entity,
      scopeQuery,
      (data) => ({ ...data, rows: data.rows.map(updater) }),
    ),
    removeRows: (ids) => setAdminEntityListCachesInScope<Row, Metrics>(
      queryClient,
      entity,
      scopeQuery,
      (data) => removeAdminEntityRows(data, ids),
    ),
    // Safe for paginated/sorted caches: replace rows only where they already
    // exist. Inserts require targeted invalidation because their destination
    // page cannot be inferred generically.
    upsertRows: (incoming, getId) => setAdminEntityListCachesInScope<Row, Metrics>(
      queryClient,
      entity,
      scopeQuery,
      (data) => replaceExistingAdminEntityRows(data, incoming, getId),
    ),
  };

  function restoreSnapshot(snapshot: CacheSnapshot<Row, Metrics>) {
    snapshot.forEach(([key, value]) => queryClient.setQueryData(key, value));
  }

  const mutation = useMutation({
    mutationFn: async (request: AdminEntityMutationRequest<Row>) => {
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
        predicate: (query) => matchesAdminEntityListScope(query.queryKey, scopeQuery),
      });
      request.optimistic(helpers);
      return { snapshot } as { snapshot: CacheSnapshot<Row, Metrics> };
    },
    onError: (_error, _request, context) => {
      if (context) restoreSnapshot(context.snapshot);
    },
    onSuccess: (result, request, context) => {
      if (request.reconcileSuccess && context) {
        request.reconcileSuccess(result, {
          cache: helpers,
          restoreSnapshot: () => restoreSnapshot(context.snapshot),
        });
      }
      return queryClient.invalidateQueries({
        queryKey: adminEntityListQueryKeys.entity(entity),
        refetchType: "active",
      });
    },
    onSettled: () => { setRowPending(null); setBulkPending(null); },
  });

  async function mutateAsync(request: AdminEntityMutationRequest<Row>) {
    if (inFlightRef.current) {
      throw Object.assign(
        new Error("انتظر انتهاء العملية الحالية ثم حاول مرة أخرى."),
        { ok: false as const, code: "mutation_in_flight" },
      );
    }

    inFlightRef.current = true;
    try {
      return await mutation.mutateAsync(request);
    } finally {
      inFlightRef.current = false;
    }
  }

  return { mutateAsync, rowPending, bulkPending, error: mutation.error };
}
