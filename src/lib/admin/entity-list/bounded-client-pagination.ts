"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";

import {
  ADMIN_ENTITY_LIST_DEFAULT_PAGE_SIZE,
  ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS,
  normalizePageSize,
  resolveClientPagination,
  slicePageRows,
} from "./pagination";
import { writeAdminBoundedClientPaginationParams } from "./url-state";

type HistoryBehavior = "push" | "replace";

export type AdminBoundedClientPaginationOptions<Row> = {
  rows: readonly Row[];
  /** Stable identity of the active collection scope, excluding sort order. */
  datasetKey: string;
  pageParamName?: string;
  limitParamName?: string;
  pageSizeOptions?: readonly number[];
  defaultPageSize?: number;
};

function currentLocationHref(params: URLSearchParams) {
  const query = params.toString();
  return `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
}

/**
 * Shared URL/history owner for collections whose complete bounded dataset is
 * already available in the client. It deliberately does not fetch or cache.
 */
export function useAdminBoundedClientPagination<Row>({
  rows,
  datasetKey,
  pageParamName = "page",
  limitParamName = "limit",
  pageSizeOptions = ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS,
  defaultPageSize = ADMIN_ENTITY_LIST_DEFAULT_PAGE_SIZE,
}: AdminBoundedClientPaginationOptions<Row>) {
  const searchParams = useSearchParams();
  const pagination = resolveClientPagination(
    rows.length,
    searchParams.get(pageParamName),
    searchParams.get(limitParamName),
    pageSizeOptions,
    defaultPageSize,
  );
  const paginatedRows = useMemo(
    () => slicePageRows(rows, pagination.page, pagination.pageSize),
    [pagination.page, pagination.pageSize, rows],
  );

  const commit = useCallback(
    (page: number, pageSize: number, behavior: HistoryBehavior) => {
      const current = new URLSearchParams(window.location.search);
      const next = writeAdminBoundedClientPaginationParams(
        current,
        { page, pageSize },
        { pageParamName, limitParamName, defaultPageSize },
      );
      if (current.toString() === next.toString()) return;

      window.history[
        behavior === "replace" ? "replaceState" : "pushState"
      ](window.history.state, "", currentLocationHref(next));
    },
    [defaultPageSize, limitParamName, pageParamName],
  );

  const previousDatasetKey = useRef(datasetKey);
  useEffect(() => {
    const datasetChanged = previousDatasetKey.current !== datasetKey;
    previousDatasetKey.current = datasetKey;

    const current = new URLSearchParams(window.location.search);
    const next = writeAdminBoundedClientPaginationParams(
      current,
      {
        page: datasetChanged ? 1 : pagination.page,
        pageSize: pagination.pageSize,
      },
      { pageParamName, limitParamName, defaultPageSize },
    );
    if (current.toString() === next.toString()) return;

    window.history.replaceState(
      window.history.state,
      "",
      currentLocationHref(next),
    );
  }, [
    datasetKey,
    defaultPageSize,
    limitParamName,
    pageParamName,
    pagination.page,
    pagination.pageSize,
  ]);

  const setPage = useCallback(
    (page: number) => commit(page, pagination.pageSize, "push"),
    [commit, pagination.pageSize],
  );
  const setPageSize = useCallback(
    (pageSize: number) =>
      commit(
        1,
        normalizePageSize(pageSize, pageSizeOptions, defaultPageSize),
        "push",
      ),
    [commit, defaultPageSize, pageSizeOptions],
  );
  const resetPage = useCallback(
    () => commit(1, pagination.pageSize, "replace"),
    [commit, pagination.pageSize],
  );

  return {
    ...pagination,
    rows: paginatedRows,
    setPage,
    setPageSize,
    resetPage,
  };
}
