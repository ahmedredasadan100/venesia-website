import { z } from "zod";

import {
  CONTENT_STATUS_VALUES,
  type ContentStatus,
} from "../content/content-status-metadata.ts";
import { CONTENT_TYPES, type ContentType } from "../content/content-types.ts";
import {
  ADMIN_ENTITY_LIST_DEFAULT_PAGE_SIZE,
  ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS,
} from "../entity-list/pagination.ts";
import type { AdminEntityListQueryContract } from "../entity-list/data-engine/contracts";

export const topicsWithoutImageStatuses = [
  "all",
  ...CONTENT_STATUS_VALUES,
] as const;
export const topicsWithoutImageContentTypes = ["all", ...CONTENT_TYPES] as const;
export const topicsWithoutImageSortFields = ["updated_at"] as const;

export type TopicsWithoutImageFilters = {
  status: ContentStatus | "all";
  contentType: ContentType | "all";
};
export type TopicsWithoutImageSortField =
  (typeof topicsWithoutImageSortFields)[number];

export const topicsWithoutImageQueryContract: AdminEntityListQueryContract<
  TopicsWithoutImageFilters,
  TopicsWithoutImageSortField
> = {
  mode: "server-page",
  filtersSchema: z.strictObject({
    status: z.enum(topicsWithoutImageStatuses),
    contentType: z.enum(topicsWithoutImageContentTypes),
  }),
  sortFields: topicsWithoutImageSortFields,
  defaultSort: { field: "updated_at", direction: "desc" },
  defaultPageSize: ADMIN_ENTITY_LIST_DEFAULT_PAGE_SIZE,
  pageSizeOptions: ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS,
  maxPageSize: 50,
  searchMinLength: 1,
  rawFilterSchemas: {
    status: z.enum(topicsWithoutImageStatuses),
    type: z.enum(topicsWithoutImageContentTypes),
  },
  parseFilters(params) {
    const status = params.get("status");
    const contentType = params.get("type");
    return {
      status: topicsWithoutImageStatuses.includes(
        status as TopicsWithoutImageFilters["status"],
      )
        ? (status as TopicsWithoutImageFilters["status"])
        : "all",
      contentType: topicsWithoutImageContentTypes.includes(
        contentType as TopicsWithoutImageFilters["contentType"],
      )
        ? (contentType as TopicsWithoutImageFilters["contentType"])
        : "all",
    };
  },
  writeFilters(filters, params) {
    params.delete("status");
    params.delete("type");
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.contentType !== "all") {
      params.set("type", filters.contentType);
    }
  },
};
