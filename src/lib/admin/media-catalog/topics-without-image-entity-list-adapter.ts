import "server-only";

import { z } from "zod";

import { CONTENT_STATUS_VALUES } from "../content/content-status-metadata";
import { CONTENT_TYPES } from "../content/content-types";
import {
  loadNormalizedAdminEntityListPage,
  type AdminEntityListAdapter,
} from "../entity-list/data-engine/adapter";
import {
  createAdminEntityListResultSchema,
  type AdminEntityListQuery,
} from "../entity-list/data-engine/contracts";
import {
  topicsWithoutImageQueryContract,
  type TopicsWithoutImageFilters,
  type TopicsWithoutImageSortField,
} from "./topics-without-image-entity-list-contract";
import {
  queryTopicsWithoutImagePage,
  type TopicWithoutImageRow,
} from "./reports";

export const topicWithoutImageRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  slug: z.string(),
  status: z.enum(CONTENT_STATUS_VALUES),
  contentType: z.enum(CONTENT_TYPES),
  categorySlug: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const topicsWithoutImageResultSchema =
  createAdminEntityListResultSchema(topicWithoutImageRowSchema);

async function loadReportPage(
  query: AdminEntityListQuery<
    TopicsWithoutImageFilters,
    TopicsWithoutImageSortField
  >,
  page: number,
) {
  return queryTopicsWithoutImagePage({
    query: query.search,
    status: query.filters.status,
    contentType: query.filters.contentType,
    page,
    pageSize: query.pageSize,
    sortDirection: query.sort.direction,
  });
}

export async function loadTopicsWithoutImageEntityListResult(
  query: AdminEntityListQuery<
    TopicsWithoutImageFilters,
    TopicsWithoutImageSortField
  >,
) {
  const loaded = await loadNormalizedAdminEntityListPage({
    requestedPage: query.page,
    pageSize: query.pageSize,
    loadPage: (page) => loadReportPage(query, page),
  });

  return topicsWithoutImageResultSchema.parse({
    rows: loaded.rows,
    pagination: {
      page: loaded.page,
      pageSize: query.pageSize,
      totalRows: loaded.totalRows,
      totalPages: loaded.totalPages,
    },
    meta: { generatedAt: new Date().toISOString(), mode: query.mode },
  });
}

export const topicsWithoutImageEntityListAdapter: AdminEntityListAdapter<
  "topics_without_image",
  TopicsWithoutImageFilters,
  TopicsWithoutImageSortField,
  TopicWithoutImageRow
> = {
  entity: "topics_without_image",
  queryContract: topicsWithoutImageQueryContract,
  resultSchema: topicsWithoutImageResultSchema,
  staleTimeMs: 30_000,
  mutationInvalidation: "query",
  load: loadTopicsWithoutImageEntityListResult,
};
