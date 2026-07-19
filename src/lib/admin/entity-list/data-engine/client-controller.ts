"use client";

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import {
  normalizeAdminEntityListQuery,
  writeAdminEntityListQuery,
  type AdminEntityListQuery,
  type AdminEntityListQueryContract,
  type AdminEntityListResult,
} from "./contracts";
import { adminEntityListQueryKeys } from "./query-keys";

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
};

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
}: AdminEntityListControllerOptions<
  Entity,
  Filters,
  SortField,
  Row,
  Metrics
>) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState(initialQuery);
  const [initialKey] = useState(() =>
    adminEntityListQueryKeys.query(
      entity,
      initialQuery as AdminEntityListQuery<Record<string, unknown>, string>,
    ),
  );

  const commitQuery = useCallback(
    (
      next:
        | AdminEntityListQuery<Filters, SortField>
        | ((
            current: AdminEntityListQuery<Filters, SortField>,
          ) => AdminEntityListQuery<Filters, SortField>),
      behavior: HistoryBehavior,
    ) => {
      setQuery((current) => {
        const resolved = typeof next === "function" ? next(current) : next;
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
        return resolved;
      });
    },
    [contract],
  );

  useEffect(() => {
    function handlePopState() {
      setQuery(
        normalizeAdminEntityListQuery(
          contract,
          new URLSearchParams(window.location.search),
        ),
      );
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [contract]);

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
      return (await response.json()) as AdminEntityListResult<Row, Metrics>;
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
    (sort: AdminEntityListQuery<Filters, SortField>["sort"]) =>
      commitQuery((current) => ({ ...current, sort, page: 1 }), "push"),
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

  return {
    query,
    result: request.data ?? initialResult,
    error: request.error,
    isPending: request.isPending,
    isFetching: request.isFetching,
    isPlaceholderData: request.isPlaceholderData,
    setSearch,
    setFilter,
    setSort,
    setPage,
    setPageSize,
    resetFilters,
    invalidate: () =>
      queryClient.invalidateQueries({
        queryKey: adminEntityListQueryKeys.entity(entity),
      }),
    cancel: () =>
      queryClient.cancelQueries({
        queryKey: adminEntityListQueryKeys.entity(entity),
      }),
  };
}
