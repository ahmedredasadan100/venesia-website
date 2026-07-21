"use client";

import { useMemo, useRef, useState } from "react";
import AdminNotice from "../../../components/admin/AdminNotice";
import {
  AdminEntityListFilters,
} from "../../../components/admin/entity-list";
import { AdminFloatingLayerProvider } from "../../../components/admin/entity-list/AdminFloatingLayerContext";
import {
  AdminBulkActionBar,
  AdminColumnVisibilityMenu,
  AdminInfoBar,
  AdminTablePagination,
  useAdminGridSelection,
} from "../../../components/admin/ui";
import { ADMIN_SCROLLBAR_VISUAL_CLASSES } from "../../../components/admin/ui/admin-scrollbar-styles";
import VenesiaActionModal, { VenesiaActionModalButton } from "../../../components/admin/VenesiaActionModal";
import type { ProjectCategory } from "../../../config/projects-data";
import type {
  AdminEntityListQuery,
  AdminEntityListResult,
} from "../../../lib/admin/entity-list/data-engine/contracts";
import {
  mapAdminActionResultToFeedback,
  type AdminActionFeedback,
} from "../../../lib/admin/admin-action-feedback";
import { useAdminEntityListController } from "../../../lib/admin/entity-list/data-engine/client-controller";
import { resolveAdminNoticeFeedback } from "../../../lib/admin/entity-list/feedback-codes";
import { useAdminEntityInstantMutation } from "../../../lib/admin/entity-list/data-engine/instant-mutation";
import {
  getDefaultVisibleColumnKeys,
  sanitizeVisibleColumnKeys,
} from "../../../lib/admin/entity-list";
import type { AdminEntityFilterDef } from "../../../lib/admin/entity-list";
import {
  projectsQueryContract,
  type ProjectFilters,
  type ProjectSortField,
} from "../../../lib/admin/projects/entity-list-contract";
import type {
  ProjectEntityListMetrics,
  ProjectEntityListRow,
} from "../../../lib/admin/projects/entity-list-types";
import { applyProjectPublicationMutation } from "../../../lib/admin/projects/instant-mutation-membership";
import {
  getProjectsDefaultColumnKeys,
} from "../../../lib/admin/projects/projects-list-config";
import type { ProjectColumnKey } from "../../../lib/admin/projects/projects-list-config";
import {
  archiveProjectAjax,
  bulkProjectsActionAjax,
  deleteProjectAjax,
  duplicateProjectAjax,
  restoreProjectAjax,
  restoreProjectsTablePreferences,
  saveProjectsTablePreferences,
  toggleProjectPublicationAjax,
} from "./actions";
import LegacyProjectsTable from "./projects-table/LegacyProjectsTable";
import ReferenceProjectsTable from "./projects-table/ReferenceProjectsTable";
import {
  buildColumns,
  getProjectsColumnDefs,
  resolveProjectsVisibleColumns,
} from "./projects-table/projects-table-utils";
import type { ProjectGridRow, ProjectRowActionHandlers } from "./projects-table/projects-table-types";

export type { ProjectGridRow } from "./projects-table/projects-table-types";

type ProjectsTableClientProps = {
  type: ProjectCategory;
  basePath: string;
  initialQuery: AdminEntityListQuery<ProjectFilters, ProjectSortField>;
  initialResult: AdminEntityListResult<
    ProjectEntityListRow,
    ProjectEntityListMetrics
  >;
  initialVisibleColumns?: readonly string[];
  withDuplicateAction?: boolean;
  referenceLayout?: boolean;
  notice?: string | null;
  errorMessage?: string | null;
};

const PUBLICATION_FILTER: AdminEntityFilterDef = {
  id: "projects-publication-filter",
  paramKey: "publication_status",
  placeholder: "كل حالات النشر",
  options: [
    { value: "published", label: "منشور" },
    { value: "unpublished", label: "مخفي" },
    { value: "draft", label: "مسودة" },
    { value: "archived", label: "أرشيف" },
  ],
  className: "min-w-[150px]",
};

const IMPLEMENTATION_FILTER: AdminEntityFilterDef = {
  id: "projects-implementation-filter",
  paramKey: "implementation_status",
  placeholder: "كل حالات التنفيذ",
  options: [
    { value: "under-construction", label: "تحت الإنشاء" },
    { value: "excavation", label: "حفر" },
    { value: "near-delivery", label: "قرب التسليم" },
    { value: "delivered", label: "تم التسليم" },
  ],
  className: "min-w-[160px]",
};

const FEATURED_FILTER: AdminEntityFilterDef = {
  id: "projects-featured-filter",
  paramKey: "featured",
  placeholder: "كل المشاريع",
  options: [
    { value: "yes", label: "مميز" },
    { value: "no", label: "غير مميز" },
  ],
  className: "min-w-[130px]",
};

const LIST_MODE_FILTER: AdminEntityFilterDef = {
  id: "projects-list-mode-filter",
  paramKey: "list_mode",
  placeholder: "الكل / نشط / أرشيف",
  options: [
    { value: "active", label: "النشط فقط" },
    { value: "archived", label: "الأرشيف فقط" },
  ],
  className: "min-w-[150px]",
};

function toGridRow(row: ProjectEntityListRow): ProjectGridRow {
  return {
    id: row.id,
    code: row.code,
    slug: row.slug,
    arabic_name: row.arabic_name,
    location_label: row.location_label ?? "",
    map_area: row.map_area ?? "",
    featured: row.featured,
    publication_status: row.publication_status,
    status: row.status,
    updated_at: row.updated_at,
  };
}

function projectActionTitle(action: string, ok: boolean) {
  if (!ok) return "تعذر تنفيذ العملية";
  if (action === "status") return "تم تحديث ظهور المشروع";
  if (action === "archive") return "تم أرشفة المشروع";
  if (action === "restore") return "تم استعادة المشروع";
  if (action === "duplicate") return "تم نسخ المشروع";
  if (action === "delete") return "تم حذف المشروع";
  if (action === "publish") return "تم نشر المشاريع";
  if (action === "hide") return "تم إخفاء المشاريع";
  if (action === "busy") return "العملية الحالية لم تكتمل";
  return "تم تنفيذ الإجراء";
}

function projectActionFeedback(
  action: string,
  ok: boolean,
  message: string,
): AdminActionFeedback {
  return mapAdminActionResultToFeedback({
    ok,
    title: projectActionTitle(action, ok),
    message,
  });
}

export default function ProjectsTableClient({
  type,
  basePath,
  initialQuery,
  initialResult,
  initialVisibleColumns,
  withDuplicateAction = false,
  referenceLayout = false,
  notice = null,
  errorMessage = null,
}: ProjectsTableClientProps) {
  const controller = useAdminEntityListController({
    entity: "projects",
    contract: projectsQueryContract,
    initialQuery,
    initialResult,
    staleTimeMs: 30_000,
  });
  const instant = useAdminEntityInstantMutation<ProjectEntityListRow>(
    "projects",
    controller.query,
  );
  const projects = useMemo(
    () => controller.result.rows.map(toGridRow),
    [controller.result.rows],
  );
  const selection = useAdminGridSelection(
    useMemo(() => projects.map((item) => item.id), [projects]),
  );
  const [feedbackState, setFeedbackState] = useState<{
    feedback: AdminActionFeedback;
    revision: number;
  } | null>(null);
  const [pendingPermanentDelete, setPendingPermanentDelete] =
    useState<ProjectGridRow | null>(null);
  const mutationLockRef = useRef(false);
  const columnDefs = useMemo(() => getProjectsColumnDefs(type), [type]);
  const defaultVisibleColumns = useMemo(
    () =>
      sanitizeVisibleColumnKeys(
        columnDefs,
        getProjectsDefaultColumnKeys(type),
      ),
    [columnDefs, type],
  );
  const [visibleColumns, setVisibleColumns] = useState<ProjectColumnKey[]>(() =>
    resolveProjectsVisibleColumns(type, initialVisibleColumns),
  );
  const initialFeedback = resolveAdminNoticeFeedback(
    {},
    errorMessage ? "error" : notice ? "notice" : null,
    errorMessage ?? notice,
  );
  const feedback = feedbackState?.feedback ?? initialFeedback;

  function showFeedback(nextFeedback: AdminActionFeedback) {
    setFeedbackState((current) => ({
      feedback: nextFeedback,
      revision: (current?.revision ?? 0) + 1,
    }));
  }
  const columns = buildColumns(
    type,
    visibleColumns,
    withDuplicateAction,
    referenceLayout,
  );
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
  const publishedCount = controller.result.metrics?.published ?? 0;
  const featuredCount = controller.result.metrics?.featured ?? 0;
  const isBulkPending = instant.bulkPending !== null;
  // Single-flight shared mutation: disable every row/bulk control while busy.
  const isMutationBusy = instant.rowPending !== null || isBulkPending;

  function lockedFilters(next: Partial<ProjectFilters> = {}): ProjectFilters {
    return {
      projectType: type,
      publicationStatus:
        next.publicationStatus ?? controller.query.filters.publicationStatus,
      implementationStatus:
        next.implementationStatus ??
        controller.query.filters.implementationStatus,
      featured: next.featured ?? controller.query.filters.featured,
      listMode: next.listMode ?? controller.query.filters.listMode,
    };
  }

  async function runMutation(
    request: Parameters<typeof instant.mutateAsync>[0],
  ) {
    // Shared instant mutation is single-flight. Row actions stay visually
    // disabled while busy so clicks are never silently ignored.
    if (
      mutationLockRef.current ||
      instant.rowPending !== null ||
      instant.bulkPending !== null
    ) {
      showFeedback(
        projectActionFeedback(
          "busy",
          false,
          "انتظر انتهاء العملية الحالية قبل تنفيذ إجراء آخر.",
        ),
      );
      return false;
    }
    mutationLockRef.current = true;
    try {
      const result = await instant.mutateAsync(request);
      if (request.bulk) selection.clearSelection();
      showFeedback(
        projectActionFeedback(request.action, true, result.message),
      );
      return true;
    } catch (error) {
      showFeedback(
        projectActionFeedback(
          request.action,
          false,
          error instanceof Error ? error.message : "تعذر تنفيذ العملية.",
        ),
      );
      return false;
    } finally {
      mutationLockRef.current = false;
    }
  }

  const handlers: ProjectRowActionHandlers = {
    isBulkPending,
    isMutationBusy,
    isRowPending: (id) => instant.rowPending?.rowId === id,
    rowPendingAction: (id) =>
      instant.rowPending?.rowId === id ? instant.rowPending.action : null,
    onTogglePublication: (id, status) => {
      const nextStatus = status === "published" ? "unpublished" : "published";
      void runMutation({
        rowId: id,
        action: "status",
        optimistic: (cache) =>
          applyProjectPublicationMutation(
            cache,
            controller.result.rows,
            new Set([id]),
            nextStatus,
            controller.query.search,
            controller.query.filters,
          ),
        execute: () => toggleProjectPublicationAjax(id, status),
      });
    },
    onArchive: (id) => {
      void runMutation({
        rowId: id,
        action: "archive",
        optimistic: (cache) =>
          applyProjectPublicationMutation(
            cache,
            controller.result.rows,
            new Set([id]),
            "archived",
            controller.query.search,
            controller.query.filters,
          ),
        execute: () => archiveProjectAjax(id),
      });
    },
    onRestore: (id) => {
      void runMutation({
        rowId: id,
        action: "restore",
        optimistic: (cache) =>
          applyProjectPublicationMutation(
            cache,
            controller.result.rows,
            new Set([id]),
            "draft",
            controller.query.search,
            controller.query.filters,
          ),
        execute: () => restoreProjectAjax(id),
      });
    },
    onRequestPermanentDelete: (item) => setPendingPermanentDelete(item),
    onDuplicate: withDuplicateAction
      ? (id) => {
          void runMutation({
            rowId: id,
            action: "duplicate",
            optimistic: () => undefined,
            execute: () => duplicateProjectAjax(id),
          });
        }
      : undefined,
  };
  const isPendingPermanentDelete =
    pendingPermanentDelete !== null &&
    instant.rowPending?.rowId === pendingPermanentDelete.id &&
    instant.rowPending.action === "delete";

  return (
    <AdminFloatingLayerProvider>
    <div
      className="space-y-4"
      data-admin-entity-list-consumer="projects"
      data-admin-entity-list-pending={controller.isFetching ? "true" : "false"}
      data-admin-projects-type={type}
      data-admin-projects-columns={visibleColumns.join(",")}
    >
      <AdminInfoBar
        label={
          type === "residential"
            ? "إدارة المشاريع السكنية"
            : "إدارة المشاريع التجارية"
        }
        description={
          type === "residential"
            ? "الحالة تعني حالة التنفيذ، وحالة النشر توضّح ظهور المشروع في نظام إدارة المحتوى."
            : "المشاريع التجارية لا تحتوي تفاصيل سكنية كاملة — بعض التبويبات تظهر بشكل مبسّط."
        }
        meta={`${controller.result.pagination.totalRows} مشروع / ${publishedCount} منشور / ${featuredCount} مميز`}
      />

      {feedback ? (
        <AdminNotice
          key={feedbackState?.revision ?? "initial"}
          variant={feedback.variant}
          layout={feedback.layout}
          dismissible={feedback.dismissible}
          lifecycle={feedback.lifecycle}
          autoDismissMs={feedback.autoDismissMs}
          dismissSearchParams={feedback.dismissSearchParams}
          title={feedback.title}
          message={feedback.message}
          action={feedback.action}
        />
      ) : null}

      <AdminEntityListFilters
        basePath={basePath}
        search={{
          placeholder: "ابحث في المشاريع",
          value: controller.query.search,
          className: "max-w-[330px]",
        }}
        filters={[
          PUBLICATION_FILTER,
          IMPLEMENTATION_FILTER,
          FEATURED_FILTER,
          LIST_MODE_FILTER,
        ]}
        values={{
          publication_status: controller.query.filters.publicationStatus,
          implementation_status: controller.query.filters.implementationStatus,
          featured: controller.query.filters.featured,
          list_mode: controller.query.filters.listMode,
        }}
        onQueryPatch={(patch) => {
          const search =
            "q" in patch ? (patch.q ?? "").trim() : controller.query.search;
          const publicationStatusRaw =
            "publication_status" in patch
              ? patch.publication_status
              : controller.query.filters.publicationStatus;
          const implementationStatusRaw =
            "implementation_status" in patch
              ? patch.implementation_status
              : controller.query.filters.implementationStatus;
          const featuredRaw =
            "featured" in patch
              ? patch.featured
              : controller.query.filters.featured;
          const listModeRaw =
            "list_mode" in patch
              ? patch.list_mode
              : controller.query.filters.listMode;

          controller.setSearchAndFilters(
            search,
            lockedFilters({
              publicationStatus:
                publicationStatusRaw === "published" ||
                publicationStatusRaw === "unpublished" ||
                publicationStatusRaw === "draft" ||
                publicationStatusRaw === "archived"
                  ? publicationStatusRaw
                  : "all",
              implementationStatus:
                implementationStatusRaw === "under-construction" ||
                implementationStatusRaw === "excavation" ||
                implementationStatusRaw === "near-delivery" ||
                implementationStatusRaw === "delivered"
                  ? implementationStatusRaw
                  : "all",
              featured:
                featuredRaw === "yes" || featuredRaw === "no"
                  ? featuredRaw
                  : "all",
              listMode:
                listModeRaw === "active" || listModeRaw === "archived"
                  ? listModeRaw
                  : "all",
            }),
            "q" in patch &&
              !("publication_status" in patch) &&
              !("implementation_status" in patch) &&
              !("featured" in patch) &&
              !("list_mode" in patch)
              ? "replace"
              : "push",
          );
        }}
      />

      <div className="flex flex-wrap items-center justify-end gap-3">
        <AdminColumnVisibilityMenu
          columns={columnDefs}
          visibleColumns={visibleColumns}
          defaultColumns={
            defaultVisibleColumns.length
              ? defaultVisibleColumns
              : getDefaultVisibleColumnKeys(columnDefs)
          }
          onChange={(next) =>
            setVisibleColumns(sanitizeVisibleColumnKeys(columnDefs, next))
          }
          onPersist={(next) => saveProjectsTablePreferences(type, next)}
          onRestore={() => restoreProjectsTablePreferences(type)}
          scrollAreaClassName={ADMIN_SCROLLBAR_VISUAL_CLASSES}
        />
      </div>

      <AdminBulkActionBar
        selectedIds={selection.selectedIds}
        entityLabel="مشروع"
        options={[
          { value: "publish", label: "نشر المحدد" },
          { value: "hide", label: "إخفاء المحدد" },
          { value: "archive", label: "أرشفة المحدد" },
        ]}
        onClearSelection={selection.clearSelection}
        onExecute={(action, ids) => {
          if (isMutationBusy) {
            showFeedback(
              projectActionFeedback(
                "busy",
                false,
                "انتظر انتهاء العملية الحالية قبل تنفيذ إجراء آخر.",
              ),
            );
            return;
          }
          const numericIds = ids.map(Number);
          const idSet = new Set(numericIds);
          const nextStatus =
            action === "publish"
              ? "published"
              : action === "hide"
                ? "unpublished"
                : "archived";
          void runMutation({
            action,
            bulk: true,
            optimistic: (cache) => {
              applyProjectPublicationMutation(
                cache,
                controller.result.rows,
                idSet,
                nextStatus,
                controller.query.search,
                controller.query.filters,
              );
            },
            execute: () => bulkProjectsActionAjax(action, numericIds, type),
            reconcileSuccess:
              action === "publish"
                ? (result, { cache, restoreSnapshot }) => {
                    const affectedIds = Array.isArray(result.affectedIds)
                      ? new Set(
                          result.affectedIds.filter(
                            (id): id is number =>
                              typeof id === "number" && Number.isInteger(id),
                          ),
                        )
                      : new Set<number>();
                    restoreSnapshot();
                    applyProjectPublicationMutation(
                      cache,
                      controller.result.rows,
                      affectedIds,
                      "published",
                      controller.query.search,
                      controller.query.filters,
                    );
                  }
                : undefined,
          });
        }}
        isBusy={isBulkPending || instant.rowPending !== null}
      />

      {referenceLayout ? (
        <ReferenceProjectsTable
          type={type}
          rows={projects}
          columns={columns}
          visibleColumns={visibleColumns as Extract<
            ProjectColumnKey,
            | "selection"
            | "project"
            | "code"
            | "featured"
            | "publication_status"
            | "updated_at"
            | "actions"
          >[]}
          sort={{
            field: controller.query.sort.field,
            direction: controller.query.sort.direction,
          }}
          onSort={(field) => {
            const current = controller.query.sort;
            if (current.field === field && current.direction === "asc") {
              controller.setSort({ field, direction: "desc" });
              return;
            }
            if (current.field === field && current.direction === "desc") {
              controller.setSort({
                field: "homepage_order",
                direction: "asc",
              });
              return;
            }
            controller.setSort({
              field: field as ProjectSortField,
              direction: "asc",
            });
          }}
          selection={selection}
          handlers={handlers}
        />
      ) : (
        <LegacyProjectsTable
          type={type}
          rows={projects}
          columns={columns}
          visibleColumns={visibleColumns as Extract<
            ProjectColumnKey,
            | "selection"
            | "code"
            | "location"
            | "featured"
            | "publication_status"
            | "updated_at"
            | "actions"
          >[]}
          withDuplicateAction={withDuplicateAction}
          sort={{
            field: controller.query.sort.field,
            direction: controller.query.sort.direction,
          }}
          onSort={(field) => {
            const current = controller.query.sort;
            if (current.field === field && current.direction === "asc") {
              controller.setSort({ field, direction: "desc" });
              return;
            }
            if (current.field === field && current.direction === "desc") {
              controller.setSort({
                field: "homepage_order",
                direction: "asc",
              });
              return;
            }
            controller.setSort({
              field: field as ProjectSortField,
              direction: "asc",
            });
          }}
          selection={selection}
          handlers={handlers}
        />
      )}

      <AdminTablePagination
        basePath={basePath}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        totalCount={controller.result.pagination.totalRows}
        pageSize={String(controller.result.pagination.pageSize)}
        pageSizeOptions={["10", "20", "30"]}
        currentPage={controller.result.pagination.page}
        totalPages={controller.result.pagination.totalPages}
        emptySummaryText="لا توجد مشاريع"
        onPageChange={controller.setPage}
        onPageSizeChange={controller.setPageSize}
      />

      <VenesiaActionModal
        open={Boolean(pendingPermanentDelete)}
        title="حذف نهائي للمشروع"
        subtitle="هذا الإجراء لا يمكن التراجع عنه — سيتم حذف المشروع وجميع المخططات والوسائط المرتبطة."
        eyebrow="حذف طارئ"
        onClose={() => setPendingPermanentDelete(null)}
      >
        {pendingPermanentDelete ? (
          <>
            <p className="rounded-[16px] border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm leading-7 text-red-100">
              سيتم حذف «
              {pendingPermanentDelete.arabic_name ||
                pendingPermanentDelete.code}
              » نهائيًا من قاعدة البيانات. يُفضّل الأرشفة للإخفاء الآمن.
            </p>
            <VenesiaActionModalButton
              tone="red"
              disabled={isMutationBusy}
              onClick={() => {
                const target = pendingPermanentDelete;
                void (async () => {
                  const succeeded = await runMutation({
                    rowId: target.id,
                    action: "delete",
                    optimistic: (cache) =>
                      cache.removeRows(new Set([target.id])),
                    execute: () => deleteProjectAjax(target.id, true),
                  });
                  if (succeeded) setPendingPermanentDelete(null);
                })();
              }}
            >
              {isPendingPermanentDelete
                ? "جارٍ الحذف..."
                : "تأكيد الحذف النهائي"}
            </VenesiaActionModalButton>
            <VenesiaActionModalButton
              onClick={() => setPendingPermanentDelete(null)}
            >
              إلغاء — استخدم الأرشفة بدلًا من ذلك
            </VenesiaActionModalButton>
          </>
        ) : null}
      </VenesiaActionModal>
    </div>
    </AdminFloatingLayerProvider>
  );
}
