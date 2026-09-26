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
  commandId?: string;
  completion?: "not_committed" | "committed" | "unknown";
  feedbackStatus?: "error" | "warning" | "success";
  code: string;
  message: string;
};
export type AdminEntityMutationSuccess<Payload = Record<string, never>> = Payload & {
  ok: true;
  commandId?: string;
  completion?: "committed";
  message: string;
  feedbackStatus?: "success" | "warning";
};

type CacheSnapshot<Row, Metrics> = Array<[
  QueryKey,
  AdminEntityListResult<Row, Metrics> | undefined,
]>;

export type AdminEntityMutationContext = { commandId: string };

export type AdminEntityMutationResult =
  | AdminEntityMutationSuccess<Record<string, unknown>>
  | AdminEntityMutationError;

export type AdminEntityMutationRequest<Row> = {
  rowId?: number | string;
  action: string;
  bulk?: boolean;
  optimistic: (cache: AdminInstantMutationPatch<Row>) => void;
  execute: (context: AdminEntityMutationContext) => Promise<AdminEntityMutationResult>;
  /** Opt-in receipt recovery: same intent retries recover, never repeat writes. */
  intentKey?: string;
  recover?: (context: AdminEntityMutationContext) => Promise<AdminEntityMutationResult>;
  reconcileSuccess?: (
    result: AdminEntityMutationSuccess<Record<string, unknown>>,
    tools: {
      cache: AdminInstantMutationPatch<Row>;
      restoreSnapshot: () => void;
      reconcileDeletedRows: (ids: ReadonlySet<number | string>) => void;
    },
  ) => void;
};

export type AdminInstantMutationPatch<Row> = {
  patchRows: (updater: (row: Row) => Row) => void;
  transformActiveRows: (updater: (rows: Row[]) => Row[]) => void;
  removeRows: (ids: ReadonlySet<number | string>) => void;
  upsertRows: (rows: Row[], getId: (row: Row) => number | string) => void;
};

function unknownCompletion(commandId: string): AdminEntityMutationError {
  return {
    ok: false, commandId, completion: "unknown", feedbackStatus: "warning",
    code: "completion_unknown",
    message: "تعذر تأكيد نتيجة العملية. قد تكون حُفظت؛ استخدم استعادة نتيجة العملية للتحقق قبل تنفيذ إجراء آخر.",
  };
}

export function useAdminEntityInstantMutation<
  Row extends { id: number | string }, Metrics = unknown,
>(
  entity: string,
  scopeQuery: AdminEntityListQuery<Record<string, unknown>, string>,
) {
  const queryClient = useQueryClient();
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const unresolvedCommands = useRef(new Map<string, {
    commandId: string;
    rowId?: number | string;
    bulk?: boolean;
    request: AdminEntityMutationRequest<Row>;
  }>());
  const [pendingCommands, setPendingCommands] = useState<Array<{
    commandId: string; action: string;
  }>>([]);
  function publishPendingCommands() {
    setPendingCommands(Array.from(unresolvedCommands.current.values(), (pending) => ({
      commandId: pending.commandId, action: pending.request.action,
    })));
  }
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
    mutationFn: async (request: AdminEntityMutationRequest<Row> & {
      commandId: string;
      recoveryOnly: boolean;
    }) => {
      const command = { commandId: request.commandId };
      // Existing non-receipt adopters keep their current domain error contract.
      if (!request.recover) {
        const result = await request.execute(command);
        if (!result.ok) throw Object.assign(new Error(result.message), result);
        return result;
      }
      let result: AdminEntityMutationResult;
      try {
        result = await (request.recoveryOnly
          ? request.recover(command)
          : request.execute(command));
      } catch {
        result = unknownCompletion(command.commandId);
      }
      if (!result.ok && result.completion === "unknown" && !request.recoveryOnly) {
        try {
          result = await request.recover(command);
        } catch {
          result = unknownCompletion(command.commandId);
        }
      }
      if (!result.ok) {
        if (result.completion === "unknown" || request.recoveryOnly) {
          unresolvedCommands.current.set(request.intentKey!, {
            ...command, rowId: request.rowId, bulk: request.bulk, request,
          });
          publishPendingCommands();
          result = unknownCompletion(command.commandId);
        }
        throw Object.assign(new Error(result.message), result, command);
      }
      unresolvedCommands.current.delete(request.intentKey!);
      publishPendingCommands();
      return { ...result, ...command, completion: "committed" as const };
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
    onError: async (error, request, context) => {
      if (request.recover && "completion" in error && error.completion === "unknown") {
        try {
          await queryClient.invalidateQueries({
            queryKey: adminEntityListQueryKeys.entity(entity), refetchType: "active",
          }, { throwOnError: true });
        } catch {
          // A failed read cannot resolve an unknown commit or authorize replay.
        }
        return;
      }
      if (context) restoreSnapshot(context.snapshot);
    },
    onSuccess: async (result, request, context) => {
      // React Query treats a rejected onSuccess callback as a mutation error.
      // Post-commit reconciliation/refetch must never invoke snapshot rollback.
      try {
        if (request.reconcileSuccess && context) {
          request.reconcileSuccess(result, {
            cache: helpers,
            restoreSnapshot: () => restoreSnapshot(context.snapshot),
            reconcileDeletedRows: (ids) => {
              context.snapshot.forEach(([key, value]) => {
                if (value) queryClient.setQueryData(key, removeAdminEntityRows(value, ids));
              });
            },
          });
        }
      } catch (error) {
        result.feedbackStatus = "warning";
        result.message += " تم حفظ العملية، لكن تعذر تحديث العرض المحلي.";
        console.error("Committed mutation reconciliation failed", error);
      }
      try {
        await queryClient.invalidateQueries({
          queryKey: adminEntityListQueryKeys.entity(entity),
          refetchType: "active",
        }, { throwOnError: true });
      } catch (error) {
        result.feedbackStatus = "warning";
        result.message += " تعذر إعادة القراءة؛ أعد تحديث القائمة للتحقق من النتيجة المحفوظة.";
        console.error("Committed mutation refetch failed", error);
      }
    },
  });

  async function mutateAsync(request: AdminEntityMutationRequest<Row>) {
    if (request.recover && !request.intentKey) {
      throw new Error("Receipt-backed mutations require an explicit intent key.");
    }
    const previous = request.intentKey
      ? unresolvedCommands.current.get(request.intentKey)
      : undefined;
    const unresolvedConflict = Array.from(unresolvedCommands.current.entries()).find(
      ([key, pending]) => key !== request.intentKey &&
        (pending.bulk || request.bulk || pending.rowId == null || request.rowId == null ||
          pending.rowId === request.rowId),
    );
    if (unresolvedConflict) {
      const result = unknownCompletion(unresolvedConflict[1].commandId);
      throw Object.assign(new Error(result.message), result);
    }
    const identifiedRequest = {
      ...request,
      commandId: previous?.commandId ?? globalThis.crypto.randomUUID(),
      recoveryOnly: Boolean(previous),
      optimistic: previous ? () => undefined : request.optimistic,
    };
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
      mutation.mutateAsync(identifiedRequest),
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

  async function recoverPending(commandId: string) {
    const pending = Array.from(unresolvedCommands.current.values()).find(
      (candidate) => candidate.commandId === commandId,
    );
    if (!pending) return null;
    // The original intent and UUID stay in this mounted owner. Recovery never
    // invokes execute, even after repeated lost recovery responses.
    return mutateAsync(pending.request);
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
    pendingCommand: pendingCommands[0] ?? null,
    recoverPending,
    recoveryPending: mutation.isPending,
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
