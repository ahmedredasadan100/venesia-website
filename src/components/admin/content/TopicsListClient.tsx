"use client";

import { useCallback, useMemo } from "react";

import {
  duplicateUnifiedContent,
  setUnifiedContentStatus,
  softDeleteUnifiedContent,
  toggleUnifiedContentFeatured,
} from "../../../app/admin/content/topics/actions";

import { AdminEntityListSurface } from "../entity-list";
import { AdminEntityListPrimarySection } from "../entity-list/AdminEntityListSurface";
import { AdminMetricCardsGrid, AdminTablePagination } from "../ui";
import type { AdminActionFeedback } from "../../../lib/admin/admin-action-feedback";
import type { AdminActionResult } from "../../../lib/admin/admin-action-result";
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
import { useAdminEntityInstantMutation } from "../../../lib/admin/entity-list/data-engine/instant-mutation";
import { ADMIN_CONTENT_ROUTES } from "../../../lib/admin/content-routes";
import type { TopicMetrics } from "../../../lib/admin/content/entity-list-adapters/topics";
import UnifiedContentFilters from "./UnifiedContentFilters";
import UnifiedContentList from "./UnifiedContentList";
import type { UnifiedContentRowActionHandlers } from "./UnifiedContentRowActions";

type SeriesOption = {
  id: number;
  name: string;
  status: string;
  deleted_at: string | null;
};

function toInstantMutationResult(
  result: AdminActionResult,
  failureCode: string,
) {
  if (!result.ok) {
    return {
      ok: false as const,
      code: result.code ?? failureCode,
      message: result.message,
    };
  }

  return {
    ok: true as const,
    message: result.message,
    feedbackStatus:
      result.feedbackStatus === "warning"
        ? ("warning" as const)
        : ("success" as const),
  };
}

function unexpectedMutationFailure(
  error: unknown,
  input: { title: string; fallbackMessage: string; entityId: number },
): AdminActionResult {
  return {
    ok: false,
    feedbackStatus: "error",
    title: input.title,
    message: error instanceof Error ? error.message : input.fallbackMessage,
    entityId: input.entityId,
  };
}

function topicActionFormData(
  id: number,
  values: Record<string, string> = {},
) {
  const formData = new FormData();
  formData.set("id", String(id));
  Object.entries(values).forEach(([key, value]) => formData.set(key, value));
  return formData;
}

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
  initialResult: AdminEntityListResult<UnifiedContentRow, TopicMetrics>;
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
  const instant = useAdminEntityInstantMutation<UnifiedContentRow, TopicMetrics>(
    "topics",
    controller.query,
  );

  const toggleVisibility = useCallback(
    async (
      row: UnifiedContentRow,
      nextStatus: "published" | "unpublished",
    ): Promise<AdminActionResult> => {
      let actionResult: AdminActionResult | null = null;

      try {
        await instant.mutateAsync({
          rowId: row.id,
          action: "visibility",
          optimistic: (cache) => {
            if (controller.query.filters.status !== "all") {
              cache.removeRows(new Set([row.id]));
              return;
            }
            cache.patchRows((current) =>
              current.id === row.id
                ? { ...current, status: nextStatus }
                : current,
            );
          },
          execute: async () => {
            actionResult = await setUnifiedContentStatus(
              topicActionFormData(row.id, { next_status: nextStatus }),
            );
            return toInstantMutationResult(
              actionResult,
              "topic_visibility_failed",
            );
          },
          reconcileSuccess: (_mutationResult, { cache }) => {
            if (controller.query.filters.status !== "all") return;
            const confirmedStatus =
              actionResult?.code === "published"
                ? "published"
                : actionResult?.code === "unpublished"
                  ? "unpublished"
                  : nextStatus;
            cache.patchRows((current) =>
              current.id === row.id
                ? { ...current, status: confirmedStatus }
                : current,
            );
          },
        });
        if (actionResult) return actionResult;
      } catch (error) {
        if (actionResult) return actionResult;
        return unexpectedMutationFailure(error, {
          title: "تعذر تنفيذ العملية",
          fallbackMessage: "تعذر تحديث ظهور المحتوى.",
          entityId: row.id,
        });
      }

      return unexpectedMutationFailure(null, {
        title: "تعذر تنفيذ العملية",
        fallbackMessage: "تعذر إثبات نتيجة تحديث ظهور المحتوى.",
        entityId: row.id,
      });
    },
    [controller.query.filters.status, instant],
  );

  const toggleFeatured = useCallback(
    async (row: UnifiedContentRow): Promise<AdminActionResult> => {
      const nextFeatured = !Boolean(row.is_featured);
      let actionResult: AdminActionResult | null = null;

      try {
        await instant.mutateAsync({
          rowId: row.id,
          action: "featured",
          optimistic: (cache) => {
            if (controller.query.filters.featured !== "all") {
              cache.removeRows(new Set([row.id]));
              return;
            }
            cache.patchRows((current) =>
              current.id === row.id
                ? { ...current, is_featured: nextFeatured }
                : current,
            );
          },
          execute: async () => {
            actionResult = await toggleUnifiedContentFeatured(
              topicActionFormData(row.id),
            );
            return toInstantMutationResult(
              actionResult,
              "topic_featured_failed",
            );
          },
          reconcileSuccess: (_mutationResult, { cache }) => {
            if (controller.query.filters.featured !== "all") return;
            const confirmedFeatured =
              actionResult?.code === "featured"
                ? true
                : actionResult?.code === "unfeatured"
                  ? false
                  : nextFeatured;
            cache.patchRows((current) =>
              current.id === row.id
                ? { ...current, is_featured: confirmedFeatured }
                : current,
            );
          },
        });
        if (actionResult) return actionResult;
      } catch (error) {
        if (actionResult) return actionResult;
        return unexpectedMutationFailure(error, {
          title: "تعذر تحديث التمييز",
          fallbackMessage: "تعذر تحديث تمييز المحتوى.",
          entityId: row.id,
        });
      }

      return unexpectedMutationFailure(null, {
        title: "تعذر تحديث التمييز",
        fallbackMessage: "تعذر إثبات نتيجة تحديث تمييز المحتوى.",
        entityId: row.id,
      });
    },
    [controller.query.filters.featured, instant],
  );

  const duplicateTopic = useCallback(
    async (row: UnifiedContentRow): Promise<AdminActionResult> => {
      let actionResult: AdminActionResult | null = null;

      try {
        await instant.mutateAsync({
          rowId: row.id,
          action: "duplicate",
          optimistic: () => undefined,
          execute: async () => {
            actionResult = await duplicateUnifiedContent(
              topicActionFormData(row.id),
            );
            return toInstantMutationResult(
              actionResult,
              "topic_duplicate_failed",
            );
          },
        });
        if (actionResult) return actionResult;
      } catch (error) {
        if (actionResult) return actionResult;
        return unexpectedMutationFailure(error, {
          title: "تعذر نسخ المحتوى",
          fallbackMessage: "تعذر نسخ المحتوى.",
          entityId: row.id,
        });
      }

      return unexpectedMutationFailure(null, {
        title: "تعذر نسخ المحتوى",
        fallbackMessage: "تعذر إثبات نتيجة نسخ المحتوى.",
        entityId: row.id,
      });
    },
    [instant],
  );

  const deleteTopic = useCallback(
    async (row: UnifiedContentRow): Promise<AdminActionResult> => {
      let actionResult: AdminActionResult | null = null;

      try {
        await instant.mutateAsync({
          rowId: row.id,
          action: "delete",
          optimistic: (cache) => cache.removeRows(new Set([row.id])),
          execute: async () => {
            actionResult = await softDeleteUnifiedContent(
              topicActionFormData(row.id),
            );
            return toInstantMutationResult(
              actionResult,
              "topic_delete_failed",
            );
          },
        });
        if (actionResult) return actionResult;
      } catch (error) {
        if (actionResult) return actionResult;
        return unexpectedMutationFailure(error, {
          title: "تعذر حذف المحتوى",
          fallbackMessage: "تعذر حذف المحتوى.",
          entityId: row.id,
        });
      }

      return unexpectedMutationFailure(null, {
        title: "تعذر حذف المحتوى",
        fallbackMessage: "تعذر إثبات نتيجة حذف المحتوى.",
        entityId: row.id,
      });
    },
    [instant],
  );

  const rowActionHandlers = useMemo<UnifiedContentRowActionHandlers>(
    () => ({
      rowPendingAction: (rowId) =>
        instant.rowPending?.rowId === rowId
          ? instant.rowPending.action
          : null,
      mutationBusy:
        instant.rowPending !== null || instant.bulkPending !== null,
      onVisibility: toggleVisibility,
      onFeatured: toggleFeatured,
      onDuplicate: duplicateTopic,
      onDelete: deleteTopic,
    }),
    [
      deleteTopic,
      duplicateTopic,
      instant.bulkPending,
      instant.rowPending,
      toggleFeatured,
      toggleVisibility,
    ],
  );

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
    <AdminEntityListSurface consumer="topics">
      <AdminEntityListPrimarySection>
        <AdminMetricCardsGrid
          items={[
            { label: "إجمالي الموضوعات", value: controller.result.metrics?.error ? "—" : (controller.result.metrics?.total ?? 0), tone: "gold", compact: true },
            { label: "منشور", value: controller.result.metrics?.error ? "—" : (controller.result.metrics?.published ?? 0), tone: "green", compact: true },
            { label: "مسودات", value: controller.result.metrics?.error ? "—" : (controller.result.metrics?.draft ?? 0), tone: "amber", compact: true },
            { label: "مخفي", value: controller.result.metrics?.error ? "—" : (controller.result.metrics?.unpublished ?? 0), tone: "violet", compact: true },
            { label: "أرشيف", value: controller.result.metrics?.error ? "—" : (controller.result.metrics?.archived ?? 0), tone: "cyan", compact: true },
            { label: "متوسط SEO", value: controller.result.metrics?.error ? "—" : (controller.result.metrics?.seoAverage ?? 0), suffix: controller.result.metrics?.error ? undefined : "/100", tone: "blue", compact: true },
          ]}
        />
      </AdminEntityListPrimarySection>

      <AdminEntityListPrimarySection>
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
      </AdminEntityListPrimarySection>

      {controller.error ? (
        <p
          role="status"
          className="rounded-[12px] border border-[#D8B87A]/20 bg-[#D8B87A]/8 px-3 py-2 text-sm text-[#F4E7C5]/85"
        >
          {controller.error.message}
        </p>
      ) : null}

      {/* Quiet pending indicator only; aria-busy is reserved for the row
          action that owns the in-flight mutation. */}
      <AdminEntityListPrimarySection
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
          rowActionHandlers={rowActionHandlers}
          onSortChange={(next, options) =>
            controller.setSort(
              {
                field: next.key,
                direction: next.direction,
              },
              { resetPage: options?.resetPage !== false },
            )
          }
          onSuccessfulMutation={(result) => {
            // Row actions already reconcile through Instant Mutation. Bulk
            // actions and column preferences still require list invalidation.
            if (!result || result.entityId == null) {
              return controller.invalidate();
            }
          }}
        />
      </AdminEntityListPrimarySection>

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
