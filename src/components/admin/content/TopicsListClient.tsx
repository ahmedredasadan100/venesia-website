"use client";

import { useMemo } from "react";

import { AdminEntityListSurface } from "../entity-list";
import { AdminTablePagination } from "../ui";
import type { AdminActionFeedback } from "../../../lib/admin/admin-action-feedback";
import type { AdminContentCategoryNode } from "../../../lib/admin/content/category-hierarchy";
import {
  topicsQueryContract,
  type TopicFilters,
  type TopicSortField,
} from "../../../lib/admin/content/entity-list-contracts/topics";
import { TOPICS_LIST_PAGE_SIZES } from "../../../lib/admin/content/topics-list-config";
import type {
  ContentSortValue,
  UnifiedContentRow,
} from "../../../lib/admin/content/load-unified-content";
import type {
  AdminEntityListQuery,
  AdminEntityListResult,
} from "../../../lib/admin/entity-list/data-engine/contracts";
import { useAdminEntityListController } from "../../../lib/admin/entity-list/data-engine/client-controller";
import { ADMIN_CONTENT_ROUTES } from "../../../lib/admin/content-routes";
import UnifiedContentFilters from "./UnifiedContentFilters";
import UnifiedContentList from "./UnifiedContentList";

type SeriesOption = {
  id: number;
  name: string;
  status: string;
  deleted_at: string | null;
};

function positiveId(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toFilters(state: {
  q: string;
  contentType: string;
  category: string;
  series: string;
  status: string;
  featured: string;
}): TopicFilters {
  return {
    contentType:
      state.contentType === "article" ||
      state.contentType === "news" ||
      state.contentType === "press" ||
      state.contentType === "site_update" ||
      state.contentType === "video" ||
      state.contentType === "gallery"
        ? state.contentType
        : "all",
    categoryId: positiveId(state.category),
    seriesId: positiveId(state.series),
    status:
      state.status === "published" ||
      state.status === "draft" ||
      state.status === "unpublished" ||
      state.status === "archived"
        ? state.status
        : "all",
    featured:
      state.featured === "yes" || state.featured === "no"
        ? state.featured
        : "all",
  };
}

export default function TopicsListClient({
  categories,
  series,
  initialQuery,
  initialResult,
  initialVisibleColumns,
  initialFeedback,
}: {
  categories: AdminContentCategoryNode[];
  series: SeriesOption[];
  initialQuery: AdminEntityListQuery<TopicFilters, TopicSortField>;
  initialResult: AdminEntityListResult<UnifiedContentRow>;
  initialVisibleColumns: string[];
  initialFeedback?: AdminActionFeedback | null;
}) {
  const controller = useAdminEntityListController({
    entity: "topics",
    contract: topicsQueryContract,
    initialQuery,
    initialResult,
    staleTimeMs: 30_000,
  });

  const sort =
    `${controller.query.sort.field}_${controller.query.sort.direction}` as ContentSortValue;
  const currentListPath = useMemo(() => {
    const params = new URLSearchParams();
    if (controller.query.search) params.set("q", controller.query.search);
    if (controller.query.filters.contentType !== "all") {
      params.set("content_type", controller.query.filters.contentType);
    }
    if (controller.query.filters.categoryId) {
      params.set("category", String(controller.query.filters.categoryId));
    }
    if (controller.query.filters.seriesId) {
      params.set("series", String(controller.query.filters.seriesId));
    }
    if (controller.query.filters.status !== "all") {
      params.set("status", controller.query.filters.status);
    }
    if (controller.query.filters.featured !== "all") {
      params.set("featured", controller.query.filters.featured);
    }
    if (sort !== "title_asc") params.set("sort", sort);
    if (controller.query.page > 1) {
      params.set("page", String(controller.query.page));
    }
    if (controller.query.pageSize !== 10) {
      params.set("limit", String(controller.query.pageSize));
    }
    const query = params.toString();
    return query
      ? `${ADMIN_CONTENT_ROUTES.topics}?${query}`
      : ADMIN_CONTENT_ROUTES.topics;
  }, [controller.query, sort]);

  const rangeStart = controller.result.pagination.totalRows
    ? (controller.result.pagination.page - 1) *
        controller.result.pagination.pageSize +
      1
    : 0;
  const rangeEnd = controller.result.pagination.totalRows
    ? Math.min(
        controller.result.pagination.page *
          controller.result.pagination.pageSize,
        controller.result.pagination.totalRows,
      )
    : 0;

  return (
    <AdminEntityListSurface className="space-y-4" consumer="topics">
      <UnifiedContentFilters
        initial={{
          q: controller.query.search,
          contentType: controller.query.filters.contentType,
          category: controller.query.filters.categoryId
            ? String(controller.query.filters.categoryId)
            : "all",
          series: controller.query.filters.seriesId
            ? String(controller.query.filters.seriesId)
            : "all",
          status: controller.query.filters.status,
          featured: controller.query.filters.featured,
        }}
        categories={categories}
        series={series}
        onNavigate={(state) => {
          const trimmed = state.q.trim();
          const search = trimmed.length >= 2 ? trimmed : "";
          const onlySearch =
            state.contentType === controller.query.filters.contentType &&
            state.category ===
              (controller.query.filters.categoryId
                ? String(controller.query.filters.categoryId)
                : "all") &&
            state.series ===
              (controller.query.filters.seriesId
                ? String(controller.query.filters.seriesId)
                : "all") &&
            state.status === controller.query.filters.status &&
            state.featured === controller.query.filters.featured;
          controller.setSearchAndFilters(
            search,
            toFilters(state),
            onlySearch ? "replace" : "push",
          );
        }}
      />

      {controller.error ? (
        <p
          role="status"
          className="rounded-[12px] border border-[#D8B87A]/20 bg-[#D8B87A]/8 px-3 py-2 text-sm text-[#F4E7C5]/85"
        >
          {controller.error.message}
        </p>
      ) : null}

      <div
        aria-busy={controller.isFetching}
        data-admin-entity-list-pending={
          controller.isFetching ? "true" : "false"
        }
        className={controller.isFetching ? "opacity-[0.96]" : undefined}
      >
        <UnifiedContentList
          rows={controller.result.rows}
          categories={categories}
          currentListPath={currentListPath}
          sort={sort}
          initialVisibleColumns={initialVisibleColumns}
          initialFeedback={initialFeedback}
          onSortChange={(next, options) =>
            controller.setSort(
              {
                field: next.key,
                direction: next.direction,
              },
              { resetPage: options?.resetPage !== false },
            )
          }
          onSuccessfulMutation={() => controller.invalidate()}
        />
      </div>

      <AdminTablePagination
        basePath={ADMIN_CONTENT_ROUTES.topics}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        totalCount={controller.result.pagination.totalRows}
        pageSize={String(controller.result.pagination.pageSize)}
        pageSizeOptions={TOPICS_LIST_PAGE_SIZES.map(String)}
        currentPage={controller.result.pagination.page}
        totalPages={controller.result.pagination.totalPages}
        emptySummaryText="لا توجد موضوعات مطابقة"
        onPageChange={controller.setPage}
        onPageSizeChange={controller.setPageSize}
      />
    </AdminEntityListSurface>
  );
}
