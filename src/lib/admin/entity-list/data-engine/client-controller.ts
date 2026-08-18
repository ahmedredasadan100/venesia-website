"use client";

import {
  keepPreviousData,
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
    () =>
      queryClient.invalidateQueries({
        queryKey: adminEntityListQueryKeys.entity(entity),
      }),
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
    [applyQueryConstraint, contract],
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
  }, [applyQueryConstraint, contract, normalizeBrowserQuery]);

  const queryKey = adminEntityListQueryKeys.query(
    entity,
    query as AdminEntityListQuery<Record<string, unknown>, string>,
  );
  const request = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const params = writeAdminEntityListQuery(contract, query);
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
      const result = (await response.json()) as AdminEntityListResult<
        Row,
        Metrics
      >;
      const normalizedQuery = cacheNormalizedAdminEntityListResult(
        queryClient,
        entity,
        query,
        result,
      );
      if (normalizedQuery) {
        queueMicrotask(() => {
          commitQuery(normalizedQuery, "replace");
        });
      }
      return result;
    },
    initialData:
      JSON.stringify(queryKey) === JSON.stringify(initialKey)
        ? initialResult
        : undefined,
    initialDataUpdatedAt: Date.parse(initialResult.meta.generatedAt),
    placeholderData: keepPreviousData,
    staleTime: staleTimeMs,
  });

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
    result: request.data ?? initialResult,
    error: request.error,
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
