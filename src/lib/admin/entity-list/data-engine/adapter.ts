import type { z } from "zod";

import type {
  AdminEntityListQuery,
  AdminEntityListQueryContract,
  AdminEntityListResult,
} from "./contracts";

export type AdminEntityListAdapter<
  Entity extends string,
  Filters extends Record<string, unknown>,
  SortField extends string,
  Row,
  Metrics = unknown,
> = {
  entity: Entity;
  queryContract: AdminEntityListQueryContract<Filters, SortField>;
  resultSchema: z.ZodType<AdminEntityListResult<Row, Metrics>>;
  staleTimeMs: number;
  mutationInvalidation: "entity" | "query";
  load: (
    query: AdminEntityListQuery<Filters, SortField>,
  ) => Promise<AdminEntityListResult<Row, Metrics>>;
};

export type AdminEntityListPageSlice<Row> = {
  rows: Row[];
  totalRows: number;
};

export type NormalizedAdminEntityListPage<Row> =
  AdminEntityListPageSlice<Row> & {
    page: number;
    totalPages: number;
  };

export class AdminEntityListPageNormalizationError extends Error {
  readonly requestedPage: number;
  readonly attempts: number;

  constructor(requestedPage: number, attempts: number) {
    super(
      `Unable to normalize entity-list page ${requestedPage} after ${attempts} reads`,
    );
    this.name = "AdminEntityListPageNormalizationError";
    this.requestedPage = requestedPage;
    this.attempts = attempts;
  }
}

/**
 * Reads a server-paged collection until the returned page and count describe
 * one consistent snapshot. Rapidly shrinking datasets fail closed after a
 * bounded number of reads instead of returning contradictory pagination.
 */
export async function loadNormalizedAdminEntityListPage<Row>({
  requestedPage,
  pageSize,
  loadPage,
  maxReads = 3,
}: {
  requestedPage: number;
  pageSize: number;
  loadPage: (page: number) => Promise<AdminEntityListPageSlice<Row>>;
  maxReads?: number;
}): Promise<NormalizedAdminEntityListPage<Row>> {
  if (!Number.isInteger(requestedPage) || requestedPage < 1) {
    throw new RangeError("requestedPage must be a positive integer");
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError("pageSize must be a positive integer");
  }
  if (!Number.isInteger(maxReads) || maxReads < 1) {
    throw new RangeError("maxReads must be a positive integer");
  }

  let page = requestedPage;
  for (let attempt = 0; attempt < maxReads; attempt += 1) {
    const loaded = await loadPage(page);
    if (!Number.isInteger(loaded.totalRows) || loaded.totalRows < 0) {
      throw new TypeError("Entity-list totalRows must be a non-negative integer");
    }

    const totalPages = Math.max(1, Math.ceil(loaded.totalRows / pageSize));
    if (page <= totalPages) {
      return { ...loaded, page, totalPages };
    }
    page = totalPages;
  }

  throw new AdminEntityListPageNormalizationError(requestedPage, maxReads);
}
