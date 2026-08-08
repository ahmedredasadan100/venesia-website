"use client";

import { useCallback, useMemo } from "react";

import {
  duplicateUnifiedContent,
  permanentlyDeleteUnifiedContent,
  restoreUnifiedContent,
  setUnifiedContentStatus,
  softDeleteUnifiedContent,
  toggleUnifiedContentFeatured,
} from "../../../app/admin/content/topics/actions";

import { AdminEntityListSurface } from "../entity-list";
import {
  AdminEntityListPrimarySection,
  AdminEntityListTableRegion,
} from "../entity-list/AdminEntityListSurface";
import {
  AdminMetricCardsGrid,
  AdminTablePagination,
  type AdminMetricCardsGridItem,
} from "../ui";
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
import { useUnifiedContentToolbar } from "./UnifiedContentFilters";
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
  view: "active" | "trash";
  contentType: string;
  category: string;
  series: string;
  status: string;
  featured: string;
  image: string;
}): TopicFilters {
  return {
    view: state.view,
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
    seriesId: state.series === "any" ? "any" : positiveId(state.series),
    status:
      state.status === "published" ||
      state.status === "unpublished"
        ? state.status
        : "all",
    featured:
      state.featured === "yes" || state.featured === "no"
        ? state.featured
        : "all",
    image: state.image === "without" ? "without" : "all",
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
  const isTrashView = controller.query.filters.view === "trash";

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

  const restoreTopic = useCallback(
    async (row: UnifiedContentRow): Promise<AdminActionResult> => {
      let actionResult: AdminActionResult | null = null;

      try {
        await instant.mutateAsync({
          rowId: row.id,
          action: "restore",
          optimistic: (cache) => cache.removeRows(new Set([row.id])),
          execute: async () => {
            actionResult = await restoreUnifiedContent(
              topicActionFormData(row.id),
            );
            return toInstantMutationResult(
              actionResult,
              "topic_restore_failed",
            );
          },
        });
        if (actionResult) return actionResult;
      } catch (error) {
        if (actionResult) return actionResult;
        return unexpectedMutationFailure(error, {
          title: "تعذر استعادة الموضوع",
          fallbackMessage: "تعذر استعادة الموضوع من المحذوفات.",
          entityId: row.id,
        });
      }

      return unexpectedMutationFailure(null, {
        title: "تعذر استعادة الموضوع",
        fallbackMessage: "تعذر إثبات نتيجة استعادة الموضوع.",
        entityId: row.id,
      });
    },
    [instant],
  );

  const permanentlyDeleteTopic = useCallback(
    async (row: UnifiedContentRow): Promise<AdminActionResult> => {
      let actionResult: AdminActionResult | null = null;

      try {
        await instant.mutateAsync({
          rowId: row.id,
          action: "permanent_delete",
          optimistic: (cache) => cache.removeRows(new Set([row.id])),
          execute: async () => {
            actionResult = await permanentlyDeleteUnifiedContent(
              topicActionFormData(row.id, { confirm_permanent: "true" }),
            );
            return toInstantMutationResult(
              actionResult,
              "topic_permanent_delete_failed",
            );
          },
        });
        if (actionResult) return actionResult;
      } catch (error) {
        if (actionResult) return actionResult;
        return unexpectedMutationFailure(error, {
          title: "تعذر الحذف النهائي",
          fallbackMessage: "تعذر حذف الموضوع نهائيًا.",
          entityId: row.id,
        });
      }

      return unexpectedMutationFailure(null, {
        title: "تعذر الحذف النهائي",
        fallbackMessage: "تعذر إثبات نتيجة الحذف النهائي.",
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
      onRestore: restoreTopic,
      onPermanentDelete: permanentlyDeleteTopic,
      view: controller.query.filters.view,
    }),
    [
      controller.query.filters.view,
      deleteTopic,
      duplicateTopic,
      instant.bulkPending,
      instant.rowPending,
      permanentlyDeleteTopic,
      restoreTopic,
      toggleFeatured,
      toggleVisibility,
    ],
  );

  const sort =
    `${controller.query.sort.field}_${controller.query.sort.direction}` as ContentSortValue;
  const currentListPath = useMemo(() => {
    const params = new URLSearchParams();
    if (controller.query.filters.view === "trash") {
      params.set("view", "trash");
    }
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
    if (controller.query.filters.image !== "all") {
      params.set("image", controller.query.filters.image);
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
  const toolbar = useUnifiedContentToolbar({
    values: {
      q: controller.query.search,
      view: controller.query.filters.view,
      contentType: controller.query.filters.contentType,
      category: controller.query.filters.categoryId
        ? String(controller.query.filters.categoryId)
        : "all",
      series: controller.query.filters.seriesId
        ? String(controller.query.filters.seriesId)
        : "all",
      status: controller.query.filters.status,
      featured: controller.query.filters.featured,
      image: controller.query.filters.image,
    },
    categories,
    series,
    pending: controller.isFetching,
    onNavigate: (state, behavior) => {
      const trimmed = state.q.trim();
      controller.setSearchAndFilters(
        trimmed.length >= 2 ? trimmed : "",
        toFilters(state),
        behavior,
      );
    },
  });
  const resetToView = useCallback(
    (view: "active" | "trash") =>
      controller.setSearchAndFilters(
        "",
        {
          view,
          contentType: "all",
          categoryId: null,
          seriesId: null,
          status: "all",
          featured: "all",
          image: "all",
        },
        "push",
      ),
    [controller],
  );
  const metricsError = Boolean(controller.result.metrics?.error);
  const metricItems: AdminMetricCardsGridItem[] = isTrashView
    ? [
        {
          label: "الموضوعات النشطة",
          value: metricsError ? "—" : (controller.result.metrics?.total ?? 0),
          tone: "green",
          compact: true,
          onClick: () => resetToView("active"),
        },
        {
          label: "المحذوفات",
          value: metricsError ? "—" : (controller.result.metrics?.trashed ?? 0),
          tone: "amber",
          compact: true,
          onClick: () => resetToView("trash"),
          active: true,
        },
      ]
    : [
        { label: "إجمالي الموضوعات", value: metricsError ? "—" : (controller.result.metrics?.total ?? 0), tone: "gold", compact: true, onClick: () => resetToView("active"), active: !controller.query.search && controller.query.filters.contentType === "all" && !controller.query.filters.categoryId && !controller.query.filters.seriesId && controller.query.filters.status === "all" && controller.query.filters.featured === "all" && controller.query.filters.image === "all" },
        { label: "منشور", value: metricsError ? "—" : (controller.result.metrics?.published ?? 0), tone: "green", compact: true, onClick: () => controller.setFilter("status", "published"), active: controller.query.filters.status === "published" },
        { label: "غير منشور", value: metricsError ? "—" : (controller.result.metrics?.unpublished ?? 0), tone: "violet", compact: true, onClick: () => controller.setFilter("status", "unpublished"), active: controller.query.filters.status === "unpublished" },
        { label: "بدون صورة", value: metricsError ? "—" : (controller.result.metrics?.withoutImage ?? 0), tone: "amber", compact: true, onClick: () => controller.setFilter("image", "without"), active: controller.query.filters.image === "without" },
        { label: "مرتبطة بسلسلة", value: metricsError ? "—" : (controller.result.metrics?.withSeries ?? 0), tone: "cyan", compact: true, onClick: () => controller.setFilter("seriesId", "any"), active: controller.query.filters.seriesId === "any" },
        { label: "مميزة", value: metricsError ? "—" : (controller.result.metrics?.featured ?? 0), tone: "gold", compact: true, onClick: () => controller.setFilter("featured", "yes"), active: controller.query.filters.featured === "yes" },
        { label: "متوسط SEO", value: metricsError ? "—" : (controller.result.metrics?.seoAverage ?? 0), suffix: metricsError ? undefined : "/100", tone: "blue", compact: true },
        { label: "المحذوفات", value: metricsError ? "—" : (controller.result.metrics?.trashed ?? 0), tone: "amber", compact: true, onClick: () => resetToView("trash") },
      ];

  return (
    <AdminEntityListSurface consumer="topics">
      {isTrashView ? (
        <section className="rounded-[18px] border border-amber-300/18 bg-amber-400/[0.055] px-5 py-4">
          <h2 className="text-lg font-bold text-amber-100">المحذوفات</h2>
          <p className="mt-1 text-sm leading-6 text-white/55">
            تظهر هنا الموضوعات المحذوفة فقط. الاستعادة تعيد الموضوع كغير منشور، والحذف النهائي يحرر الـSlug ولا يمكن التراجع عنه.
          </p>
        </section>
      ) : null}
      <AdminEntityListPrimarySection>
        <AdminMetricCardsGrid items={metricItems} />
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
      <AdminEntityListTableRegion
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
          toolbar={toolbar}
          trashView={isTrashView}
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
        <AdminTablePagination
          basePath={ADMIN_CONTENT_ROUTES.topics}
          totalCount={controller.result.pagination.totalRows}
          pageSize={String(controller.result.pagination.pageSize)}
          pageSizeOptions={TOPICS_LIST_PAGE_SIZES.map(String)}
          currentPage={controller.result.pagination.page}
          totalPages={controller.result.pagination.totalPages}
          emptySummaryText={
            isTrashView
              ? "لا توجد موضوعات محذوفة مطابقة"
              : "لا توجد موضوعات مطابقة"
          }
          onPageChange={controller.setPage}
          onPageSizeChange={controller.setPageSize}
          pending={controller.isFetching}
        />
      </AdminEntityListTableRegion>
    </AdminEntityListSurface>
  );
}
