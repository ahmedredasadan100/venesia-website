"use client";

import {
  keepPreviousData,
  useIsFetching,
  useIsMutating,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  normalizeAdminEntityListQuery,
  normalizeAdminEntityListQueryWithRouteParams,
  writeAdminEntityListQuery,
  type AdminEntityListQuery,
  type AdminEntityListQueryContract,
  type AdminEntityListResult,
} from "./contracts";
import {
  applyAdminEntityUrlPatch,
  type AdminEntityUrlPatch,
} from "../url-state";
import { cacheNormalizedAdminEntityListResult } from "./normalized-result-cache";
import { adminEntityListQueryKeys } from "./query-keys";
import { resolveAdminEntityListInteractionState } from "./interaction-state";

export class AdminEntityListRequestError extends Error {
  status: number;
  code: string | null;

  constructor(status: number, code: string | null) {
    super(
      status === 401
        ? "Your admin session has expired."
        : "Unable to load the requested list.",
    );
    this.name = "AdminEntityListRequestError";
    this.status = status;
    this.code = code;
  }
}

type HistoryBehavior = "push" | "replace";
type EntityListQueryKey = ReturnType<typeof adminEntityListQueryKeys.query>;
type PagePrefetchReason = "intent" | "adjacent";

export type AdminEntityListControllerOptions<
  Entity extends string,
  Filters extends Record<string, unknown>,
  SortField extends string,
  Row,
  Metrics,
> = {
  entity: Entity;
  contract: AdminEntityListQueryContract<Filters, SortField>;
  initialQuery: AdminEntityListQuery<Filters, SortField>;
  initialResult: AdminEntityListResult<Row, Metrics>;
  staleTimeMs: number;
  /** Prepare only the next page after the current query settles. */
  adjacentPrefetch?: boolean;
  /** Re-applies a route-owned invariant to every query lifecycle transition. */
  constrainQuery?: (
    query: AdminEntityListQuery<Filters, SortField>,
  ) => AdminEntityListQuery<Filters, SortField>;
  /** Supplies route-owned filter identities before browser URL parsing. */
  routeOwnedParams?: Readonly<Record<string, string>>;
};

export function useAdminEntityListInvalidation(entity: string) {
  const queryClient = useQueryClient();

  return useCallback(
    async () => {
      const queryKey = adminEntityListQueryKeys.entity(entity);
      // Includes inactive speculative reads (for example after Empty Trash).
      // A pre-write response must not make an invalidated cache fresh again.
      await queryClient.cancelQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey });
    },
    [entity, queryClient],
  );
}

export function useAdminEntityListController<
  Entity extends string,
  Filters extends Record<string, unknown>,
  SortField extends string,
  Row,
  Metrics = unknown,
>({
  entity,
  contract,
  initialQuery,
  initialResult,
  staleTimeMs,
  adjacentPrefetch = false,
  constrainQuery,
  routeOwnedParams,
}: AdminEntityListControllerOptions<
  Entity,
  Filters,
  SortField,
  Row,
  Metrics
>) {
  const queryClient = useQueryClient();
  const matchesAdjacentPrefetch = useCallback(
    () => adjacentPrefetch,
    [adjacentPrefetch],
  );
  const activeForegroundRequests = useIsFetching({
    queryKey: adminEntityListQueryKeys.root,
    type: "active",
    predicate: matchesAdjacentPrefetch,
  });
  const activeMutations = useIsMutating({
    predicate: matchesAdjacentPrefetch,
  });
  const invalidate = useAdminEntityListInvalidation(entity);
  const applyQueryConstraint = useCallback(
    (candidate: AdminEntityListQuery<Filters, SortField>) =>
      constrainQuery ? constrainQuery(candidate) : candidate,
    [constrainQuery],
  );
  const normalizeBrowserQuery = useCallback(
    (params: URLSearchParams) =>
      routeOwnedParams
        ? normalizeAdminEntityListQueryWithRouteParams(
            contract,
            params,
            routeOwnedParams,
          )
        : normalizeAdminEntityListQuery(contract, params),
    [contract, routeOwnedParams],
  );
  const [bootstrap] = useState(() => {
    const normalizedInitial =
      initialResult.pagination.page === initialQuery.page
        ? initialQuery
        : { ...initialQuery, page: initialResult.pagination.page };
    const query = applyQueryConstraint(normalizedInitial);
    return {
      query,
      key: adminEntityListQueryKeys.query(
        entity,
        query as AdminEntityListQuery<Record<string, unknown>, string>,
      ),
    };
  });
  const [query, setQuery] = useState(bootstrap.query);
  const queryRef = useRef(bootstrap.query);
  const initialKey = bootstrap.key;
  const speculativeReadRef = useRef<{
    queryKey: EntityListQueryKey;
    promise: Promise<void>;
    reason: PagePrefetchReason;
  } | null>(null);
  const adjacentAttemptRef = useRef<string | null>(null);
  const cancelSpeculativeRead = useCallback(
    (keepQueryKey?: EntityListQueryKey) => {
      const speculative = speculativeReadRef.current;
      if (
        !speculative ||
        (keepQueryKey &&
          JSON.stringify(keepQueryKey) === JSON.stringify(speculative.queryKey))
      ) {
        return;
      }
      speculativeReadRef.current = null;
      // Another observer may have adopted this request as foreground work.
      void queryClient.cancelQueries({
        queryKey: speculative.queryKey,
        exact: true,
        type: "inactive",
      });
    },
    [queryClient],
  );

  useEffect(() => () => cancelSpeculativeRead(), [cancelSpeculativeRead]);

  const commitQuery = useCallback(
    (
      next:
        | AdminEntityListQuery<Filters, SortField>
        | ((
            current: AdminEntityListQuery<Filters, SortField>,
          ) => AdminEntityListQuery<Filters, SortField>),
      behavior: HistoryBehavior,
    ) => {
      const current = queryRef.current;
      const candidate = typeof next === "function" ? next(current) : next;
      const resolved = applyQueryConstraint(candidate);
      cancelSpeculativeRead(adminEntityListQueryKeys.query(entity, resolved));
      const params = writeAdminEntityListQuery(
        contract,
        resolved,
        new URLSearchParams(window.location.search),
      );
      const search = params.toString();
      const href = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
      window.history[
        behavior === "replace" ? "replaceState" : "pushState"
      ](window.history.state, "", href);
      queryRef.current = resolved;
      setQuery(resolved);
    },
    [applyQueryConstraint, cancelSpeculativeRead, contract, entity],
  );

  useEffect(() => {
    const currentParams = new URLSearchParams(window.location.search);
    const restored = normalizeBrowserQuery(currentParams);
    const constrainedRestored = applyQueryConstraint(restored);
    const constraintChangedQuery =
      JSON.stringify(restored) !== JSON.stringify(constrainedRestored);
    if (
      initialQuery.page === bootstrap.query.page &&
      !constraintChangedQuery
    ) {
      return;
    }
    const params = writeAdminEntityListQuery(
      contract,
      bootstrap.query,
      currentParams,
    );
    const search = params.toString();
    const href = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", href);
  }, [applyQueryConstraint, bootstrap.query, contract, initialQuery.page, normalizeBrowserQuery]);

  useEffect(() => {
    function handlePopState() {
      const currentParams = new URLSearchParams(window.location.search);
      const normalized = normalizeBrowserQuery(currentParams);
      const restored = applyQueryConstraint(normalized);
      cancelSpeculativeRead(adminEntityListQueryKeys.query(entity, restored));
      if (JSON.stringify(normalized) !== JSON.stringify(restored)) {
        const params = writeAdminEntityListQuery(
          contract,
          restored,
          currentParams,
        );
        const search = params.toString();
        const href = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
        window.history.replaceState(window.history.state, "", href);
      }
      queryRef.current = restored;
      setQuery(restored);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [applyQueryConstraint, cancelSpeculativeRead, contract, entity, normalizeBrowserQuery]);

  const loadResult = useCallback(
    async (
      requestedQuery: AdminEntityListQuery<Filters, SortField>,
      signal: AbortSignal,
    ): Promise<AdminEntityListResult<Row, Metrics>> => {
      const params = writeAdminEntityListQuery(contract, requestedQuery);
      const response = await fetch(
        `/api/admin/entity-lists/${encodeURIComponent(entity)}?${params}`,
        {
          signal,
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          cache: "no-store",
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { code?: string } }
          | null;
        throw new AdminEntityListRequestError(
          response.status,
          payload?.error?.code ?? null,
        );
      }
      return response.json();
    },
    [contract, entity],
  );

  const queryKey = adminEntityListQueryKeys.query(
    entity,
    query as AdminEntityListQuery<Record<string, unknown>, string>,
  );
  const request = useQuery({
    queryKey,
    queryFn: ({ signal }) => loadResult(query, signal),
    initialData:
      JSON.stringify(queryKey) === JSON.stringify(initialKey)
        ? initialResult
        : undefined,
    initialDataUpdatedAt: Date.parse(initialResult.meta.generatedAt),
    placeholderData: keepPreviousData,
    staleTime: staleTimeMs,
  });
  const [lastResolvedResult, setLastResolvedResult] = useState(initialResult);
  // TanStack removes placeholder data on a terminal error for a cold query key.
  // Remember only real results, so that error cannot restore the bootstrap page.
  if (
    request.isSuccess &&
    !request.isPlaceholderData &&
    request.data !== lastResolvedResult
  ) {
    setLastResolvedResult(request.data);
  }

  useEffect(() => {
    // A warm or already in-flight read may satisfy useQuery without invoking
    // its queryFn. Only the current, resolved foreground result can correct URL.
    if (
      queryRef.current !== query ||
      !request.isSuccess ||
      request.isFetching ||
      request.isPlaceholderData
    ) {
      return;
    }
    const normalizedQuery = cacheNormalizedAdminEntityListResult(
      queryClient,
      entity,
      query,
      request.data,
    );
    if (normalizedQuery) commitQuery(normalizedQuery, "replace");
  }, [
    commitQuery,
    entity,
    query,
    queryClient,
    request.data,
    request.isFetching,
    request.isPlaceholderData,
    request.isSuccess,
  ]);

  const requestPagePrefetch = useCallback(
    (page: number, reason: PagePrefetchReason): Promise<void> => {
      const currentKey = adminEntityListQueryKeys.query(entity, query);
      const currentState = queryClient.getQueryState(currentKey);
      if (
        queryRef.current !== query ||
        query.mode !== "server-page" ||
        request.isPending ||
        request.isPlaceholderData ||
        request.isFetching ||
        request.isError ||
        !request.data ||
        request.data.pagination.page !== query.page ||
        !Number.isInteger(page) ||
        Math.abs(page - query.page) !== 1 ||
        page < 1 ||
        page > request.data.pagination.totalPages ||
        currentState?.isInvalidated ||
        currentState?.status === "error" ||
        queryClient.isMutating() > 0 ||
        queryClient.isFetching({ queryKey: currentKey, exact: true }) > 0
      ) {
        return Promise.resolve();
      }

      const candidate = applyQueryConstraint({ ...query, page });
      if (candidate.page !== page) return Promise.resolve();
      const targetKey = adminEntityListQueryKeys.query(entity, candidate);
      const keyIdentity = JSON.stringify(targetKey);
      const existing = speculativeReadRef.current;
      if (reason === "adjacent") {
        const epoch = JSON.stringify([currentKey, request.dataUpdatedAt]);
        if (
          request.fetchStatus !== "idle" ||
          currentState?.fetchStatus !== "idle" ||
          activeForegroundRequests > 0 ||
          queryClient.isFetching({
            queryKey: adminEntityListQueryKeys.root,
            type: "active",
          }) > 0 ||
          adjacentAttemptRef.current === epoch ||
          (existing && JSON.stringify(existing.queryKey) !== keyIdentity)
        ) {
          return Promise.resolve();
        }
        // A speculative completion or failure cannot advance or retry this epoch.
        adjacentAttemptRef.current = epoch;
      }
      if (existing && JSON.stringify(existing.queryKey) === keyIdentity) {
        if (reason === "intent") existing.reason = "intent";
        return existing.promise;
      }
      cancelSpeculativeRead(targetKey);
      if (
        queryClient.getQueryCache()
          .find({ queryKey: targetKey, exact: true })?.isActive()
      ) {
        return Promise.resolve();
      }

      const options = queryClient.defaultQueryOptions({
        queryKey: targetKey,
        queryFn: ({ signal }: { signal: AbortSignal }) => loadResult(candidate, signal),
        staleTime: staleTimeMs,
      });
      const inheritedRetry = options.retry;
      const promise = queryClient.prefetchQuery({
        ...options,
        retry: (failureCount, error) => {
          // No speculative retries. If the user adopts the running request,
          // preserve the foreground retry policy captured before this override.
          const activeKey = adminEntityListQueryKeys.query(entity, queryRef.current);
          if (JSON.stringify(activeKey) !== keyIdentity) {
            return false;
          }
          if (typeof inheritedRetry === "function") {
            return inheritedRetry(failureCount, error);
          }
          if (inheritedRetry === false) return false;
          return inheritedRetry === true ||
            failureCount < (typeof inheritedRetry === "number" ? inheritedRetry : 3);
        },
      });
      const speculative = { queryKey: targetKey, promise, reason };
      speculativeReadRef.current = speculative;
      void promise.finally(() => {
        if (speculativeReadRef.current === speculative) {
          speculativeReadRef.current = null;
        }
      });
      return promise;
    },
    [
      applyQueryConstraint,
      activeForegroundRequests,
      cancelSpeculativeRead,
      entity,
      loadResult,
      query,
      queryClient,
      request.data,
      request.dataUpdatedAt,
      request.fetchStatus,
      request.isError,
      request.isFetching,
      request.isPending,
      request.isPlaceholderData,
      staleTimeMs,
    ],
  );

  const prefetchPage = useCallback(
    (page: number) => requestPagePrefetch(page, "intent"),
    [requestPagePrefetch],
  );

  useEffect(() => {
    if (!adjacentPrefetch) return;
    if (activeForegroundRequests > 0 || activeMutations > 0) {
      // Foreground and explicit intent retain priority over automatic speculation.
      if (speculativeReadRef.current?.reason === "adjacent") {
        cancelSpeculativeRead(adminEntityListQueryKeys.query(entity, query));
      }
      return;
    }
    void requestPagePrefetch(query.page + 1, "adjacent");
  }, [
    activeForegroundRequests,
    activeMutations,
    adjacentPrefetch,
    cancelSpeculativeRead,
    entity,
    query,
    requestPagePrefetch,
  ]);

  const setSearch = useCallback(
    (search: string) =>
      commitQuery(
        (current) => ({ ...current, search, page: 1 }),
        "replace",
      ),
    [commitQuery],
  );
  const setSearchAndFilters = useCallback(
    (
      search: string,
      filters: Filters,
      behavior: HistoryBehavior = "push",
    ) =>
      commitQuery(
        (current) => ({ ...current, search, filters, page: 1 }),
        behavior,
      ),
    [commitQuery],
  );
  const applyQueryPatch = useCallback(
    (
      patch: AdminEntityUrlPatch,
      behavior: HistoryBehavior = "push",
    ) => {
      const currentParams = writeAdminEntityListQuery(
        contract,
        queryRef.current,
        new URLSearchParams(window.location.search),
      );
      const nextParams = applyAdminEntityUrlPatch(currentParams, patch, {
        defaultPageSize: String(contract.defaultPageSize),
      });
      commitQuery(
        normalizeAdminEntityListQuery(contract, nextParams),
        behavior,
      );
    },
    [commitQuery, contract],
  );
  const setFilter = useCallback(
    <Key extends keyof Filters>(key: Key, value: Filters[Key]) =>
      commitQuery(
        (current) => ({
          ...current,
          filters: { ...current.filters, [key]: value },
          page: 1,
        }),
        "push",
      ),
    [commitQuery],
  );
  const setSort = useCallback(
    (
      sort: AdminEntityListQuery<Filters, SortField>["sort"],
      options?: { resetPage?: boolean },
    ) =>
      commitQuery(
        (current) => ({
          ...current,
          sort,
          page: options?.resetPage === false ? current.page : 1,
        }),
        "push",
      ),
    [commitQuery],
  );
  const setPage = useCallback(
    (page: number) =>
      commitQuery((current) => ({ ...current, page }), "push"),
    [commitQuery],
  );
  const setPageSize = useCallback(
    (pageSize: number) =>
      commitQuery(
        (current) => ({ ...current, pageSize, page: 1 }),
        "push",
      ),
    [commitQuery],
  );
  const resetFilters = useCallback(() => {
    const defaults = normalizeAdminEntityListQuery(
      contract,
      new URLSearchParams(),
    );
    commitQuery(
      (current) => ({
        ...current,
        search: defaults.search,
        filters: defaults.filters,
        page: 1,
      }),
      "push",
    );
  }, [commitQuery, contract]);
  const cancel = useCallback(
    () =>
      queryClient.cancelQueries({
        queryKey: adminEntityListQueryKeys.entity(entity),
      }),
    [entity, queryClient],
  );

  const interactionState = resolveAdminEntityListInteractionState({
    isPending: request.isPending,
    isPlaceholderData: request.isPlaceholderData,
    isFetching: request.isFetching,
  });

  return {
    query,
    result: request.data ?? lastResolvedResult,
    error: request.error,
    retry: request.refetch,
    prefetchPage,
    // Query intent is pending only while a query-key change is waiting for its
    // own result. Mutation reconciliation of the current key remains usable.
    ...interactionState,
    setSearch,
    setSearchAndFilters,
    applyQueryPatch,
    setFilter,
    setSort,
    setPage,
    setPageSize,
    resetFilters,
    invalidate,
    cancel,
  };
}
