"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import {
  resolveAdminInstantMutationInteraction,
  type AdminInstantMutationBulkInteraction,
  type AdminInstantMutationPendingAction,
  type AdminInstantMutationRowInteraction,
} from "./interaction-state";

export type {
  AdminInstantMutationBulkInteraction,
  AdminInstantMutationRowInteraction,
} from "./interaction-state";

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
  transformActiveRows: (updater: (rows: Row[]) => Row[]) => void;
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
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const pendingRowsRef = useRef(new Map<number | string, string>());
  const bulkPendingRef = useRef<string | null>(null);
  const [rowPendingActions, setRowPendingActions] = useState<AdminInstantMutationPendingAction[]>([]);
  const [bulkPending, setBulkPending] = useState<string | null>(null);

  const helpers: AdminInstantMutationPatch<Row> = {
    patchRows: (updater) => setAdminEntityListCachesInScope<Row, Metrics>(
      queryClient,
      entity,
      scopeQuery,
      (data) => ({ ...data, rows: data.rows.map(updater) }),
    ),
    transformActiveRows: (updater) =>
      queryClient.setQueryData<AdminEntityListResult<Row, Metrics>>(
        adminEntityListQueryKeys.query(entity, scopeQuery),
        (data) => (data ? { ...data, rows: updater(data.rows) } : data),
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
  });

  async function mutateAsync(request: AdminEntityMutationRequest<Row>) {
    const isRowRequest = !request.bulk && request.rowId != null;
    const rowId = request.rowId as number | string;
    const conflictsWithPending = isRowRequest
      ? bulkPendingRef.current !== null || pendingRowsRef.current.has(rowId)
      : bulkPendingRef.current !== null || pendingRowsRef.current.size > 0;

    if (conflictsWithPending) {
      throw Object.assign(
        new Error("انتظر انتهاء العملية الحالية ثم حاول مرة أخرى."),
        { ok: false as const, code: "mutation_in_flight" },
      );
    }

    if (isRowRequest) {
      pendingRowsRef.current.set(rowId, request.action);
      setRowPendingActions(
        Array.from(pendingRowsRef.current, ([pendingRowId, action]) => ({
          rowId: pendingRowId,
          action,
        })),
      );
    } else {
      bulkPendingRef.current = request.action;
      setBulkPending(request.action);
    }

    const queuedMutation = queueRef.current.then(() =>
      mutation.mutateAsync(request),
    );
    queueRef.current = queuedMutation.catch(() => undefined);

    try {
      return await queuedMutation;
    } finally {
      if (isRowRequest) {
        pendingRowsRef.current.delete(rowId);
        setRowPendingActions(
          Array.from(pendingRowsRef.current, ([pendingRowId, action]) => ({
            rowId: pendingRowId,
            action,
          })),
        );
      } else {
        bulkPendingRef.current = null;
        setBulkPending(null);
      }
    }
  }

  const getRowInteraction = useCallback(
    (rowId: number | string): AdminInstantMutationRowInteraction =>
      resolveAdminInstantMutationInteraction({
        rowId,
        rowPendingActions,
        bulkPendingAction: bulkPending,
      }).row,
    [bulkPending, rowPendingActions],
  );
  const bulkInteraction = useMemo<AdminInstantMutationBulkInteraction>(
    () =>
      resolveAdminInstantMutationInteraction({
        rowId: "__bulk_scope__",
        rowPendingActions,
        bulkPendingAction: bulkPending,
      }).bulk,
    [bulkPending, rowPendingActions],
  );

  return {
    mutateAsync,
    getRowInteraction,
    bulkInteraction,
    error: mutation.error,
  };
}

/**
 * Adopts a complete RSC-provided collection into the existing Instant Mutation
 * Runtime. The server remains the source of truth; this cache only owns the
 * bounded-client optimistic view, rollback, pending state, and reconciliation.
 */
export function useAdminBoundedClientInstantMutation<
  Row extends { id: number | string }, Metrics = unknown,
>({
  entity,
  initialRows,
  datasetKey = "default",
}: {
  entity: string;
  initialRows: Row[];
  datasetKey?: string;
}) {
  const queryClient = useQueryClient();
  const scopeQuery = useMemo<
    AdminEntityListQuery<Record<string, unknown>, string>
  >(
    () => ({
      search: "",
      filters: { dataset: datasetKey },
      sort: { field: "id", direction: "asc" },
      page: 1,
      pageSize: 1,
      mode: "bounded-client",
    }),
    [datasetKey],
  );
  const initialResult = useMemo<AdminEntityListResult<Row, Metrics>>(
    () => ({
      rows: initialRows,
      pagination: {
        page: 1,
        pageSize: Math.max(initialRows.length, 1),
        totalRows: initialRows.length,
        totalPages: 1,
      },
      meta: {
        generatedAt: new Date().toISOString(),
        mode: "bounded-client",
      },
    }),
    [initialRows],
  );
  const queryKey = useMemo(
    () => adminEntityListQueryKeys.query(entity, scopeQuery),
    [entity, scopeQuery],
  );
  const request = useQuery({
    queryKey,
    queryFn: async () => initialResult,
    initialData: initialResult,
    enabled: false,
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    queryClient.setQueryData(queryKey, initialResult);
  }, [initialResult, queryClient, queryKey]);

  const instant = useAdminEntityInstantMutation<Row, Metrics>(
    entity,
    scopeQuery,
  );
  return {
    ...instant,
    rows: request.data?.rows ?? initialRows,
    scopeQuery,
  };
}
