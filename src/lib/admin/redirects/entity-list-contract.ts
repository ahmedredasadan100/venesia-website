import { z } from "zod";

import {
  REDIRECT_STATUSES,
  REDIRECT_TYPES,
} from "../../redirects/redirect-types.ts";
import type { AdminEntityListQueryContract } from "../entity-list/data-engine/contracts";
import {
  ADMIN_ENTITY_LIST_DEFAULT_PAGE_SIZE,
  ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS,
} from "../entity-list/pagination.ts";

export const redirectSortFields = ["updated_at"] as const;
export type RedirectSortField = (typeof redirectSortFields)[number];

export const redirectStatusFilterValues = ["all", ...REDIRECT_STATUSES] as const;
export type RedirectStatusFilter =
  (typeof redirectStatusFilterValues)[number];

export const redirectTypeFilterValues = ["all", ...REDIRECT_TYPES] as const;
export type RedirectTypeFilter = (typeof redirectTypeFilterValues)[number];

export type RedirectFilters = {
  status: RedirectStatusFilter;
  redirectType: RedirectTypeFilter;
};

export const REDIRECTS_LIST_PAGE_SIZES = ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS;

export const redirectsQueryContract: AdminEntityListQueryContract<
  RedirectFilters,
  RedirectSortField
> = {
  mode: "server-page",
  filtersSchema: z.strictObject({
    status: z.enum(redirectStatusFilterValues),
    redirectType: z.enum(redirectTypeFilterValues),
  }),
  sortFields: redirectSortFields,
  defaultSort: { field: "updated_at", direction: "desc" },
  defaultPageSize: ADMIN_ENTITY_LIST_DEFAULT_PAGE_SIZE,
  pageSizeOptions: REDIRECTS_LIST_PAGE_SIZES,
  maxPageSize: 50,
  searchMinLength: 1,
  rawFilterSchemas: {
    status: z.enum(REDIRECT_STATUSES),
    type: z.enum(REDIRECT_TYPES),
  },
  parseFilters(params) {
    const status = params.get("status");
    const redirectType = params.get("type");
    return {
      status:
        status === "active" || status === "inactive" ? status : "all",
      redirectType:
        redirectType === "301" || redirectType === "302"
          ? redirectType
          : "all",
    };
  },
  writeFilters(filters, params) {
    params.delete("status");
    params.delete("type");
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.redirectType !== "all") {
      params.set("type", filters.redirectType);
    }
  },
};
