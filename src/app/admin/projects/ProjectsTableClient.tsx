"use client";

import { useCallback, useMemo } from "react";

import {
  AdminEntityList,
  AdminEntityListFilters,
  AdminEntityListSurface,
} from "../../../components/admin/entity-list";
import { AdminInfoBar, AdminTablePagination } from "../../../components/admin/ui";
import { mapAdminActionResultToFeedback } from "../../../lib/admin/admin-action-feedback";
import type { AdminActionResult } from "../../../lib/admin/admin-action-result";
import type { ProjectCategory } from "../../../config/projects-data";
import type {
  AdminEntityListQuery,
  AdminEntityListResult,
} from "../../../lib/admin/entity-list/data-engine/contracts";
import { useAdminEntityListController } from "../../../lib/admin/entity-list/data-engine/client-controller";
import { useAdminEntityInstantMutation } from "../../../lib/admin/entity-list/data-engine/instant-mutation";
import { resolveAdminNoticeFeedback } from "../../../lib/admin/entity-list/feedback-codes";
import {
  projectsQueryContract,
  type ProjectFilters,
  type ProjectSortField,
} from "../../../lib/admin/projects/entity-list-contract";
import type {
  ProjectEntityListMetrics,
  ProjectEntityListRow,
} from "../../../lib/admin/projects/entity-list-types";
import { getProjectsDefaultColumnKeys } from "../../../lib/admin/projects/projects-list-config";
import type { ProjectColumnKey } from "../../../lib/admin/projects/projects-list-config";
import {
  deleteProjectAjax,
  restoreProjectsTablePreferences,
  saveProjectsTablePreferences,
} from "./actions";
import {
  createProjectColumns,
  PROJECT_ACTIONS_COLUMN_WIDTH,
} from "./projects-table/ReferenceProjectsTable";
import type { ProjectGridRow } from "./projects-table/projects-table-types";

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
  notice?: string | null;
  errorMessage?: string | null;
};

function toGridRow(row: ProjectEntityListRow): ProjectGridRow {
  return {
    id: row.id,
    type: row.type,
    slug: row.slug,
    arabic_name: row.arabic_name,
    english_name: row.english_name,
    location_label: row.location_label,
    updated_at: row.updated_at,
  };
}

export default function ProjectsTableClient({
  type,
  basePath,
  initialQuery,
  initialResult,
  initialVisibleColumns,
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

  const deleteProject = useCallback(
    async (item: ProjectGridRow): Promise<AdminActionResult> => {
      try {
        const result = await instant.mutateAsync({
          rowId: item.id,
          action: "delete",
          optimistic: (cache) => cache.removeRows(new Set([item.id])),
          execute: () => deleteProjectAjax(item.id, true),
        });
        return {
          ok: true,
          feedbackStatus: result.feedbackStatus,
          title: "تم حذف المشروع",
          message: result.message,
          code: "deleted",
          entityId: item.id,
        };
      } catch (error) {
        return {
          ok: false,
          feedbackStatus: "error",
          title: "تعذر حذف المشروع",
          message:
            error instanceof Error
              ? error.message
              : "تعذر حذف المشروع. حاول مرة أخرى.",
          entityId: item.id,
        };
      }
    },
    [instant],
  );

  const columns = useMemo(
    () =>
      createProjectColumns({
        rowPendingAction: (id) =>
          instant.rowPending?.rowId === id
            ? instant.rowPending.action
            : null,
        onDelete: deleteProject,
      }),
    [deleteProject, instant.rowPending],
  );
  const initialFeedback = useMemo(
    () =>
      resolveAdminNoticeFeedback(
        {},
        errorMessage || controller.error
          ? "error"
          : notice
            ? "notice"
            : null,
        errorMessage ?? controller.error?.message ?? notice,
      ),
    [controller.error, errorMessage, notice],
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

  return (
    <AdminEntityListSurface className="space-y-4" consumer="projects">
      <div data-admin-projects-type={type}>
        <AdminInfoBar
          label={
            type === "residential"
              ? "إدارة المشاريع السكنية"
              : "إدارة المشاريع التجارية"
          }
          description="قائمة إدخال المشاريع بالمخطط النظيف. النشر والمراجعة والتحديثات التنفيذية ليست جزءًا من هذه المرحلة."
          meta={`${controller.result.pagination.totalRows} مشروع`}
        />
      </div>

      <AdminEntityListFilters
        basePath={basePath}
        search={{
          placeholder: "ابحث بالاسم أو الرابط المختصر",
          value: controller.query.search,
          className: "max-w-[360px]",
        }}
        filters={[]}
        values={{}}
        onQueryPatch={(patch) => {
          const search =
            "q" in patch
              ? (patch.q ?? "").trim()
              : controller.query.search;
          controller.setSearchAndFilters(
            search,
            { projectType: type },
            "q" in patch ? "replace" : "push",
          );
        }}
      />

      <div
        data-admin-entity-list-pending={
          controller.isFetching ? "true" : "false"
        }
      >
        <AdminEntityList<
          ProjectGridRow,
          ProjectColumnKey,
          ProjectSortField,
          number
        >
          listId={`${type}-projects-table`}
          rows={projects}
          columns={columns}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.arabic_name}
          initialVisibleColumns={initialVisibleColumns}
          defaultVisibleColumns={[...getProjectsDefaultColumnKeys()]}
          onPersistColumns={(visibleColumns) =>
            saveProjectsTablePreferences(type, visibleColumns)
          }
          onRestoreColumns={() => restoreProjectsTablePreferences(type)}
          enableColumnManagement
          enableSelection={false}
          mapResultToFeedback={mapAdminActionResultToFeedback}
          onSuccessfulMutation={(result) => {
            if (!result) return controller.invalidate();
          }}
          sort={{
            key: controller.query.sort.field,
            direction: controller.query.sort.direction,
          }}
          sortMode={{
            mode: "callback",
            onToggle: (field) => {
              const current = controller.query.sort;
              controller.setSort({
                field: field as ProjectSortField,
                direction:
                  current.field === field && current.direction === "asc"
                    ? "desc"
                    : "asc",
              });
            },
          }}
          onSortColumnHidden={() =>
            controller.setSort({ field: "updated_at", direction: "desc" })
          }
          actionsColumnWidth={PROJECT_ACTIONS_COLUMN_WIDTH}
          emptyState={{
            mode:
              controller.result.pagination.totalRows === 0 &&
              !controller.query.search
                ? "system"
                : "filtered",
            systemEmpty: (
              <>
                <p className="text-base font-semibold text-white">
                  لا توجد مشروعات في هذه القائمة
                </p>
                <p className="mt-2 text-sm leading-7 text-white/45">
                  أضف مشروعًا جديدًا من زر الإضافة أعلى الصفحة.
                </p>
              </>
            ),
            filteredEmpty: (
              <p className="text-base font-semibold text-white">
                لا توجد مشروعات مطابقة لعبارة البحث
              </p>
            ),
          }}
          initialFeedback={initialFeedback}
        />
      </div>

      <AdminTablePagination
        basePath={basePath}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        totalCount={controller.result.pagination.totalRows}
        pageSize={String(controller.result.pagination.pageSize)}
        pageSizeOptions={["10", "20", "30"]}
        currentPage={controller.result.pagination.page}
        totalPages={controller.result.pagination.totalPages}
        emptySummaryText="لا توجد مشروعات"
        onPageChange={controller.setPage}
        onPageSizeChange={controller.setPageSize}
      />
    </AdminEntityListSurface>
  );
}
