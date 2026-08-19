"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import {
  AdminEntityList,
  AdminEntityListPageLayout,
  AdminEntityListPrimarySection,
  AdminEntityListSurface,
  AdminEntityListTableRegion,
} from "../../entity-list";
import {
  ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS,
  ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
  ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE_OPTIONS,
  AdminActionButton,
  AdminCard,
  AdminDataGridRowActions,
  AdminPageContextHeader,
  AdminStatusPill,
  AdminTablePagination,
  type AdminRowActionVisibility,
  type AdminRowActionsCapability,
} from "../../ui";
import { mapAdminActionResultToFeedback } from "../../../../lib/admin/admin-action-feedback";
import type { AdminActionResult } from "../../../../lib/admin/admin-action-result";
import type {
  AdminEntityColumnDef,
  AdminEntityFilterDef,
} from "../../../../lib/admin/entity-list";
import type {
  AdminEntityListQuery,
  AdminEntityListResult,
} from "../../../../lib/admin/entity-list/data-engine/contracts";
import { useAdminEntityListController } from "../../../../lib/admin/entity-list/data-engine/client-controller";
import { useAdminEntityInstantMutation } from "../../../../lib/admin/entity-list/data-engine/instant-mutation";
import { formatAdminDateOnly } from "../../../../lib/content-dates";
import {
  PROJECT_TRACKING_ENTITY_KEYS,
  trackingItemPath,
  trackingItemsQueryContract,
  trackingProjectPath,
  trackingStagePath,
  trackingStagesQueryContract,
  trackingUpdatesQueryContract,
  type TrackingItemFilters,
  type TrackingItemMetrics,
  type TrackingItemRow,
  type TrackingItemSort,
  type TrackingStageFilters,
  type TrackingStageMetrics,
  type TrackingStageRow,
  type TrackingStageSort,
  type TrackingUpdateFilters,
  type TrackingUpdateMetrics,
  type TrackingUpdateRow,
  type TrackingUpdateSort,
} from "../../../../lib/admin/projects/tracking-contract";
import { projectTrackingStatusLabel } from "../../../../lib/projects/tracking/contract";
import {
  deleteTrackingItemAction,
  deleteTrackingStageAction,
  deleteTrackingUpdateAction,
  reorderTrackingItemsAction,
  reorderTrackingStagesAction,
  setTrackingItemVisibilityAction,
  setTrackingStageVisibilityAction,
  setTrackingUpdatePublicationVisibilityAction,
} from "../../../../app/admin/projects/tracking-actions";
import {
  restoreProjectTrackingColumnPreferences,
  saveProjectTrackingColumnPreferences,
} from "../../../../app/admin/projects/tracking-column-preference-actions";
import {
  TrackingItemFormModal,
  TrackingProfileFormModal,
  TrackingStageFormModal,
  TrackingUpdateFormModal,
} from "./TrackingForms";

const visibilityFilter: AdminEntityFilterDef = {
  id: "tracking-visibility",
  paramKey: "visibility",
  label: "الظهور",
  placeholder: "الظهور",
  type: "status",
  options: [
    { value: "visible", label: "مرئي" },
    { value: "hidden", label: "مخفي" },
  ],
};
const statusFilter: AdminEntityFilterDef = {
  id: "tracking-status",
  paramKey: "status",
  label: "الحالة",
  placeholder: "الحالة",
  type: "status",
  options: [
    { value: "not_started", label: "لم يبدأ" },
    { value: "in_progress", label: "جاري التنفيذ" },
    { value: "completed", label: "مكتمل" },
  ],
};
const publicationFilter: AdminEntityFilterDef = {
  id: "tracking-publication",
  paramKey: "publication",
  label: "النشر",
  placeholder: "النشر",
  type: "status",
  options: [
    { value: "draft", label: "مسودة" },
    { value: "published", label: "منشور" },
    { value: "unpublished", label: "غير منشور" },
    { value: "archived", label: "مؤرشف" },
  ],
};
const HIDDEN_ROW_ACTION_TARGET = { access: "hidden" } as const;

function hiddenTargets(): Pick<
  AdminRowActionsCapability["actions"],
  "copyPublicLink" | "featured" | "duplicate" | "archive"
> {
  return {
    copyPublicLink: { access: "hidden" },
    featured: { access: "hidden" },
    duplicate: { access: "hidden" },
    archive: { access: "hidden" },
  };
}

function trackingVisibilityTarget({
  isVisible,
  isPending,
  onSelect,
}: {
  isVisible: boolean;
  isPending: boolean;
  onSelect: () => Promise<void>;
}): AdminRowActionVisibility {
  return isPending
    ? {
        access: "disabled",
        isVisible,
        pending: true,
        disabledReason: "انتظر انتهاء الإجراء الحالي.",
      }
    : { access: "allowed", isVisible, onSelect };
}

function visibilityOnlyCapability({
  entityType,
  entityId,
  entityLabel,
  visibility,
}: {
  entityType: string;
  entityId: number;
  entityLabel: string;
  visibility: AdminRowActionVisibility;
}): AdminRowActionsCapability {
  return {
    entityType,
    entityId,
    entityLabel,
    actions: {
      edit: HIDDEN_ROW_ACTION_TARGET,
      preview: HIDDEN_ROW_ACTION_TARGET,
      information: HIDDEN_ROW_ACTION_TARGET,
      copyPublicLink: HIDDEN_ROW_ACTION_TARGET,
      visibility,
      featured: HIDDEN_ROW_ACTION_TARGET,
      duplicate: HIDDEN_ROW_ACTION_TARGET,
      archive: HIDDEN_ROW_ACTION_TARGET,
      delete: HIDDEN_ROW_ACTION_TARGET,
    },
  };
}

function toInstantMutationResult(result: AdminActionResult) {
  if (!result.ok) {
    return {
      ok: false as const,
      code: result.code ?? "tracking_mutation_failed",
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

function reorderOptimisticRows<
  Row extends { id: number; sort_order: number },
>(rows: Row[], orderedIds: readonly number[]) {
  const rank = new Map(orderedIds.map((id, index) => [id, index]));
  return [...rows]
    .sort(
      (left, right) =>
        (rank.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    )
    .map((row) => ({
      ...row,
      sort_order: (rank.get(row.id) ?? row.sort_order - 1) + 1,
    }));
}

function TrackingOrderButtons({
  rowId,
  ids,
  onReorder,
  disabled,
  onResult,
}: {
  rowId: number;
  ids: number[];
  onReorder: (ids: number[]) => Promise<AdminActionResult>;
  disabled: boolean;
  onResult?: (result: AdminActionResult) => void;
}) {
  const index = ids.indexOf(rowId);
  async function move(direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    [next[index], next[target]] = [next[target], next[index]];
    const result = await onReorder(next);
    onResult?.(result);
  }
  return (
    <div className="flex justify-center gap-1">
      <button
        type="button"
        disabled={disabled || index === 0}
        onClick={() => void move(-1)}
        className="grid size-8 place-items-center rounded-lg border border-white/10 text-white/60 hover:border-[#D8B87A]/35 hover:text-[#D8B87A] disabled:opacity-25"
        aria-label="تحريك لأعلى"
      >
        ↑
      </button>
      <button
        type="button"
        disabled={disabled || index === ids.length - 1}
        onClick={() => void move(1)}
        className="grid size-8 place-items-center rounded-lg border border-white/10 text-white/60 hover:border-[#D8B87A]/35 hover:text-[#D8B87A] disabled:opacity-25"
        aria-label="تحريك لأسفل"
      >
        ↓
      </button>
    </div>
  );
}
function TrackingPagination({
  basePath,
  result,
  onPage,
  onSize,
}: {
  basePath: string;
  result: AdminEntityListResult<unknown, unknown>;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}) {
  return (
    <AdminTablePagination
      basePath={basePath}
      totalCount={result.pagination.totalRows}
      pageSize={String(result.pagination.pageSize)}
      pageSizeOptions={ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE_OPTIONS}
      currentPage={result.pagination.page}
      totalPages={result.pagination.totalPages}
      emptySummaryText="لا توجد عناصر"
      onPageChange={onPage}
      onPageSizeChange={onSize}
    />
  );
}

export function TrackingStagesCollection({
  initialQuery,
  initialResult,
  initialVisibleColumns,
}: {
  initialQuery: AdminEntityListQuery<TrackingStageFilters, TrackingStageSort>;
  initialResult: AdminEntityListResult<TrackingStageRow, TrackingStageMetrics>;
  initialVisibleColumns: readonly string[];
}) {
  const projectId = initialQuery.filters.projectId;
  const routeOwnedParams = useMemo(
    () => ({ project_id: String(projectId) }),
    [projectId],
  );
  const controller = useAdminEntityListController({
    entity: PROJECT_TRACKING_ENTITY_KEYS.stages,
    contract: trackingStagesQueryContract,
    initialQuery,
    initialResult,
    staleTimeMs: 15_000,
    routeOwnedParams,
    constrainQuery: useCallback(
      (
        query: AdminEntityListQuery<TrackingStageFilters, TrackingStageSort>,
      ) => ({ ...query, filters: { ...query.filters, projectId } }),
      [projectId],
    ),
  });
  const instant = useAdminEntityInstantMutation<
    TrackingStageRow,
    TrackingStageMetrics
  >(PROJECT_TRACKING_ENTITY_KEYS.stages, controller.query);
  const [createOpen, setCreateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editing, setEditing] = useState<TrackingStageRow | null>(null);
  const toggleVisibility = useCallback(
    async (
      row: TrackingStageRow,
      onMutationResult?: (result: AdminActionResult) => void,
    ) => {
      const nextVisible = !row.is_visible;
      let actionResult: AdminActionResult | null = null;
      try {
        await instant.mutateAsync({
          rowId: row.id,
          action: "visibility",
          optimistic: (cache) => {
            const leavesFilteredScope =
              (controller.query.filters.visibility === "visible" &&
                !nextVisible) ||
              (controller.query.filters.visibility === "hidden" && nextVisible);
            if (leavesFilteredScope) {
              cache.removeRows(new Set([row.id]));
              return;
            }
            cache.patchRows((candidate) =>
              candidate.id === row.id
                ? { ...candidate, is_visible: nextVisible }
                : candidate,
            );
          },
          execute: async () => {
            actionResult = await setTrackingStageVisibilityAction(
              projectId,
              row.id,
              nextVisible,
              row.name,
            );
            return toInstantMutationResult(actionResult);
          },
        });
        if (actionResult) onMutationResult?.(actionResult);
      } catch (error) {
        if (actionResult) onMutationResult?.(actionResult);
        throw error;
      }
    },
    [controller.query.filters.visibility, instant, projectId],
  );
  const rows = controller.result.rows;
  const canonicalReorder =
    controller.query.search === "" &&
    controller.query.filters.visibility === "all" &&
    controller.query.sort.field === "sort_order" &&
    controller.query.sort.direction === "asc" &&
    rows.length === controller.result.pagination.totalRows;
  const ids = rows.map((row) => row.id);
  const columns = useMemo<
    AdminEntityColumnDef<TrackingStageRow, string, TrackingStageSort>[]
  >(
    () => [
      {
        key: "name",
        label: "المرحلة",
        defaultVisible: true,
        hideable: false,
        sortable: true,
        sortKey: "name",
        primary: true,
        sticky: "start",
        minWidth: ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS.textOnly,
        width: ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS.textOnly,
        flexible: true,
        renderCell: ({ row }) => (
          <Link
            href={trackingStagePath(projectId, row.id)}
            data-tracking-stage-items-link=""
            className="group block min-w-0 rounded-xl px-1 py-1 text-right transition hover:bg-white/[0.035] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70"
            title={`إدارة بنود ${row.name}`}
          >
            <b className="text-white">{row.name}</b>
            <p className="mt-1 line-clamp-1 text-xs text-white/40">
              {row.description ?? "بلا وصف"}
            </p>
            <span className="mt-2 inline-flex text-xs font-semibold text-[#D8B87A]/75 transition group-hover:text-[#D8B87A]">
              إدارة البنود ({row.item_count})
            </span>
          </Link>
        ),
      },
      {
        key: "status",
        label: "الحالة المشتقة",
        defaultVisible: true,
        hideable: true,
        sortable: false,
        minWidth: 140,
        width: 150,
        renderCell: ({ row }) => (
          <AdminStatusPill
            tone={
              row.derived_status === "completed"
                ? "green"
                : row.derived_status === "in_progress"
                  ? "gold"
                  : "muted"
            }
          >
            {projectTrackingStatusLabel(row.derived_status)}
          </AdminStatusPill>
        ),
      },
      {
        key: "relations",
        label: "العلاقات",
        defaultVisible: true,
        hideable: true,
        minWidth: 150,
        width: 160,
        renderCell: ({ row }) => (
          <span className="text-sm text-white/60">
            {row.item_count} بند / {row.update_count} تحديث
          </span>
        ),
      },
      {
        key: "visibility",
        label: "الظهور",
        defaultVisible: true,
        hideable: true,
        sticky: "end-adjacent",
        minWidth: 100,
        width: 110,
        renderCell: ({ row, onMutationResult }) => {
          const interaction = instant.getRowInteraction(row.id);
          const visibility = trackingVisibilityTarget({
            isVisible: row.is_visible,
            isPending: interaction.isPending,
            onSelect: () => toggleVisibility(row, onMutationResult),
          });
          return (
            <AdminDataGridRowActions
              capability={visibilityOnlyCapability({
                entityType: "project_tracking_stage",
                entityId: row.id,
                entityLabel: row.name,
                visibility,
              })}
              display="visibility"
              size="compact"
            />
          );
        },
      },
      {
        key: "order",
        label: "الترتيب",
        defaultVisible: true,
        hideable: true,
        sticky: "end-adjacent",
        minWidth: 110,
        width: 120,
        renderCell: ({ row, onMutationResult }) => (
          <TrackingOrderButtons
            rowId={row.id}
            ids={ids}
            disabled={!canonicalReorder || instant.bulkInteraction.isBlocked}
            onReorder={async (next) => {
              let actionResult: AdminActionResult | null = null;
              try {
                await instant.mutateAsync({
                  action: "reorder",
                  bulk: true,
                  optimistic: (cache) =>
                    cache.transformActiveRows((current) =>
                      reorderOptimisticRows(current, next),
                    ),
                  execute: async () => {
                    actionResult = await reorderTrackingStagesAction(
                      projectId,
                      next,
                    );
                    return toInstantMutationResult(actionResult);
                  },
                });
              } catch (error) {
                if (actionResult) return actionResult;
                throw error;
              }
              return actionResult!;
            }}
            onResult={onMutationResult}
          />
        ),
      },
      {
        key: "actions",
        label: "الإجراءات",
        defaultVisible: true,
        hideable: false,
        sticky: "end",
        minWidth: ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
        width: ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
        renderCell: ({ row, onMutationResult }) => {
          const interaction = instant.getRowInteraction(row.id);
          return (
            <AdminDataGridRowActions
              capability={{
                entityType: "project_tracking_stage",
                entityId: row.id,
                entityLabel: row.name,
                actions: {
                  edit: { access: "allowed", onSelect: () => setEditing(row) },
                  preview: {
                    access: "allowed",
                    href: trackingStagePath(projectId, row.id),
                    target: "_self",
                    label: "إدارة البنود",
                  },
                  information: {
                    access: "allowed",
                    title: `معلومات ${row.name}`,
                    items: [
                      { label: "الترتيب", value: String(row.sort_order) },
                      { label: "البنود", value: String(row.item_count) },
                      { label: "التحديثات", value: String(row.update_count) },
                    ],
                  },
                  ...hiddenTargets(),
                  visibility: trackingVisibilityTarget({
                    isVisible: row.is_visible,
                    isPending: interaction.isPending,
                    onSelect: () => toggleVisibility(row, onMutationResult),
                  }),
                  delete:
                    interaction.pendingAction === "delete"
                      ? {
                          access: "disabled",
                          disabledReason: "انتظر انتهاء الإجراء الحالي.",
                          pending: true,
                        }
                      : row.item_count
                        ? {
                            access: "disabled",
                            disabledReason: "لا يمكن حذف مرحلة تحتوي بنودًا.",
                          }
                        : {
                            access: "allowed",
                            onSelect: async () => {
                              let actionResult: AdminActionResult | null = null;
                              try {
                                await instant.mutateAsync({
                                  rowId: row.id,
                                  action: "delete",
                                  optimistic: (cache) =>
                                    cache.removeRows(new Set([row.id])),
                                  execute: async () => {
                                    actionResult =
                                      await deleteTrackingStageAction(
                                        projectId,
                                        row.id,
                                        row.name,
                                      );
                                    return toInstantMutationResult(
                                      actionResult,
                                    );
                                  },
                                });
                                if (actionResult)
                                  onMutationResult?.(actionResult);
                              } catch (error) {
                                if (actionResult)
                                  onMutationResult?.(actionResult);
                                throw error;
                              }
                            },
                            confirmation: {
                              mode: "shared",
                              title: "حذف المرحلة؟",
                              description: `سيتم حذف «${row.name}» نهائيًا.`,
                              confirmLabel: "تأكيد الحذف",
                            },
                          },
                },
              }}
              size="compact"
            />
          );
        },
      },
    ],
    [canonicalReorder, ids, instant, projectId, toggleVisibility],
  );
  const project = controller.result.metrics!.project;
  const basePath = trackingProjectPath(projectId);
  return (
    <>
      <AdminEntityListPageLayout className="pb-10" dir="rtl">
        <AdminPageContextHeader
          eyebrow="PROJECT TRACKING DOMAIN"
          title={`متابعة تنفيذ — ${project.arabic_name}`}
          description="ملف المتابعة والمراحل الديناميكية المرتبطة بالمشروع دون إضافة أي حقول إلى Project Aggregate."
          actions={
            <div className="flex flex-wrap gap-2">
              <AdminActionButton
                href={`/admin/projects/${projectId}`}
                variant="dark"
              >
                محرر المشروع
              </AdminActionButton>
              <AdminActionButton
                href={`/track-your-project/${project.slug}`}
                variant="dark"
              >
                فتح الصفحة العامة
              </AdminActionButton>
              <AdminActionButton
                onClick={() => setCreateOpen(true)}
                variant="primary"
              >
                إضافة مرحلة
              </AdminActionButton>
            </div>
          }
        />
        <AdminEntityListPrimarySection>
          <AdminCard className="p-5" data-tracking-profile-summary="">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  بيانات ملف المتابعة
                </h2>
                <p className="mt-1 text-sm text-white/45">
                  هذه حقائق Tracking مستقلة؛ لا تُنسخ إلى جدول projects.
                </p>
              </div>
              <AdminActionButton
                onClick={() => setProfileOpen(true)}
                variant="dark"
              >
                تعديل بيانات الملف
              </AdminActionButton>
            </div>
            <dl className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <dt className="text-xs text-white/45">تاريخ استلام المشروع</dt>
                <dd className="mt-2 text-sm font-semibold text-white/85">
                  {formatAdminDateOnly(
                    controller.result.metrics!.profile?.project_receipt_date,
                  )}
                </dd>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <dt className="text-xs text-white/45">تاريخ استلام الرخصة</dt>
                <dd className="mt-2 text-sm font-semibold text-white/85">
                  {formatAdminDateOnly(
                    controller.result.metrics!.profile?.license_receipt_date,
                  )}
                </dd>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <dt className="text-xs text-white/45">المقاول المنفذ</dt>
                <dd className="mt-2 text-sm font-semibold text-white/85">
                  {controller.result.metrics!.profile?.contractor_name ??
                    "غير محدد"}
                </dd>
              </div>
            </dl>
          </AdminCard>
        </AdminEntityListPrimarySection>
        <AdminEntityListSurface consumer={PROJECT_TRACKING_ENTITY_KEYS.stages}>
          <AdminEntityListTableRegion>
            <AdminEntityList
              listId="project-tracking-stages"
              sizingStrategy={{ mode: "flexible", columnKey: "name" }}
              rows={rows}
              columns={columns}
              getRowId={(row) => row.id}
              getRowLabel={(row) => row.name}
              initialVisibleColumns={initialVisibleColumns}
              defaultVisibleColumns={[
                "name",
                "status",
                "relations",
                "visibility",
                "order",
                "actions",
              ]}
              onPersistColumns={(visibleColumns) =>
                saveProjectTrackingColumnPreferences("stages", visibleColumns)
              }
              onRestoreColumns={() =>
                restoreProjectTrackingColumnPreferences("stages")
              }
              enableColumnManagement
              enableSelection={false}
              scrollLabel="جدول مراحل التنفيذ"
              mapResultToFeedback={mapAdminActionResultToFeedback}
              sort={{
                key: controller.query.sort.field,
                direction: controller.query.sort.direction,
              }}
              sortMode={{
                mode: "callback",
                onToggle: (field) =>
                  controller.setSort({
                    field,
                    direction:
                      controller.query.sort.field === field &&
                      controller.query.sort.direction === "asc"
                        ? "desc"
                        : "asc",
                  }),
              }}
              onSortColumnHidden={() =>
                controller.setSort({ ...trackingStagesQueryContract.defaultSort })
              }
              actionsColumnWidth={ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH}
              toolbar={{
                basePath,
                preserveParams: ["project_id", "sort", "limit"],
                search: {
                  value: controller.query.search,
                  placeholder: "ابحث في المراحل...",
                  minLength: 1,
                },
                filters: [visibilityFilter],
                values: { visibility: controller.query.filters.visibility },
                clearableFilterKeys: ["visibility"],
                onQueryPatch: controller.applyQueryPatch,
              }}
              emptyState={{
                mode:
                  controller.result.pagination.totalRows === 0 &&
                  !controller.query.search &&
                  controller.query.filters.visibility === "all"
                    ? "system"
                    : "filtered",
                systemEmpty: (
                  <p className="text-white/55">
                    لا توجد مراحل بعد. أضف أول مرحلة لبدء رحلة التنفيذ.
                  </p>
                ),
                filteredEmpty: (
                  <p className="text-white/55">لا توجد مراحل مطابقة.</p>
                ),
              }}
            />
            <TrackingPagination
              basePath={basePath}
              result={controller.result}
              onPage={controller.setPage}
              onSize={controller.setPageSize}
            />
          </AdminEntityListTableRegion>
        </AdminEntityListSurface>
      </AdminEntityListPageLayout>
      <TrackingProfileFormModal
        open={profileOpen}
        projectId={projectId}
        profile={controller.result.metrics!.profile}
        onClose={() => setProfileOpen(false)}
        onSaved={() => void controller.invalidate()}
      />
      <TrackingStageFormModal
        open={createOpen}
        projectId={projectId}
        onClose={() => setCreateOpen(false)}
        onSaved={() => void controller.invalidate()}
      />
      <TrackingStageFormModal
        open={Boolean(editing)}
        projectId={projectId}
        stage={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSaved={() => void controller.invalidate()}
      />
    </>
  );
}

export function TrackingItemsCollection({
  initialQuery,
  initialResult,
  initialVisibleColumns,
}: {
  initialQuery: AdminEntityListQuery<TrackingItemFilters, TrackingItemSort>;
  initialResult: AdminEntityListResult<TrackingItemRow, TrackingItemMetrics>;
  initialVisibleColumns: readonly string[];
}) {
  const projectId = initialQuery.filters.projectId,
    stageId = initialQuery.filters.stageId;
  const routeOwnedParams = useMemo(
    () => ({ project_id: String(projectId), stage_id: String(stageId) }),
    [projectId, stageId],
  );
  const controller = useAdminEntityListController({
    entity: PROJECT_TRACKING_ENTITY_KEYS.items,
    contract: trackingItemsQueryContract,
    initialQuery,
    initialResult,
    staleTimeMs: 15_000,
    routeOwnedParams,
    constrainQuery: useCallback(
      (query: AdminEntityListQuery<TrackingItemFilters, TrackingItemSort>) => ({
        ...query,
        filters: { ...query.filters, projectId, stageId },
      }),
      [projectId, stageId],
    ),
  });
  const instant = useAdminEntityInstantMutation<
    TrackingItemRow,
    TrackingItemMetrics
  >(PROJECT_TRACKING_ENTITY_KEYS.items, controller.query);
  const [createOpen, setCreateOpen] = useState(false),
    [editing, setEditing] = useState<TrackingItemRow | null>(null);
  const toggleVisibility = useCallback(
    async (
      row: TrackingItemRow,
      onMutationResult?: (result: AdminActionResult) => void,
    ) => {
      const nextVisible = !row.is_visible;
      let actionResult: AdminActionResult | null = null;
      try {
        await instant.mutateAsync({
          rowId: row.id,
          action: "visibility",
          optimistic: (cache) => {
            const leavesFilteredScope =
              (controller.query.filters.visibility === "visible" &&
                !nextVisible) ||
              (controller.query.filters.visibility === "hidden" && nextVisible);
            if (leavesFilteredScope) {
              cache.removeRows(new Set([row.id]));
              return;
            }
            cache.patchRows((candidate) =>
              candidate.id === row.id
                ? { ...candidate, is_visible: nextVisible }
                : candidate,
            );
          },
          execute: async () => {
            actionResult = await setTrackingItemVisibilityAction(
              projectId,
              stageId,
              row.id,
              nextVisible,
              row.name,
            );
            return toInstantMutationResult(actionResult);
          },
        });
        if (actionResult) onMutationResult?.(actionResult);
      } catch (error) {
        if (actionResult) onMutationResult?.(actionResult);
        throw error;
      }
    },
    [controller.query.filters.visibility, instant, projectId, stageId],
  );
  const rows = controller.result.rows,
    ids = rows.map((row) => row.id);
  const canonicalReorder =
    controller.query.search === "" &&
    controller.query.filters.visibility === "all" &&
    controller.query.filters.status === "all" &&
    controller.query.sort.field === "sort_order" &&
    controller.query.sort.direction === "asc" &&
    rows.length === controller.result.pagination.totalRows;
  const columns = useMemo<
    AdminEntityColumnDef<TrackingItemRow, string, TrackingItemSort>[]
  >(
    () => [
      {
        key: "name",
        label: "البند",
        defaultVisible: true,
        hideable: false,
        sortable: true,
        sortKey: "name",
        primary: true,
        sticky: "start",
        minWidth: 380,
        width: 440,
        flexible: true,
        renderCell: ({ row }) => (
          <Link
            href={trackingItemPath(projectId, row.id)}
            data-tracking-item-updates-link=""
            className="group block min-w-0 rounded-xl px-1 py-1 text-right transition hover:bg-white/[0.035] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70"
            title={`إدارة تحديثات ${row.name}`}
          >
            <b className="text-white">{row.name}</b>
            <p className="mt-1 line-clamp-1 text-xs text-white/40">
              {row.description ?? "بلا وصف"}
            </p>
            <span className="mt-2 inline-flex text-xs font-semibold text-[#D8B87A]/75 transition group-hover:text-[#D8B87A]">
              إدارة التحديثات ({row.update_count})
            </span>
          </Link>
        ),
      },
      {
        key: "status",
        label: "الحالة",
        defaultVisible: true,
        hideable: true,
        sortable: true,
        sortKey: "status",
        minWidth: 110,
        width: 120,
        renderCell: ({ row }) => (
          <AdminStatusPill
            tone={
              row.status === "completed"
                ? "green"
                : row.status === "in_progress"
                  ? "gold"
                  : "muted"
            }
          >
            {projectTrackingStatusLabel(row.status)}
          </AdminStatusPill>
        ),
      },
      {
        key: "dates",
        label: "التواريخ",
        defaultVisible: true,
        hideable: true,
        minWidth: 175,
        width: 185,
        renderCell: ({ row }) => (
          <span className="text-xs text-white/55">
            {formatAdminDateOnly(row.start_date)} ← {formatAdminDateOnly(row.completion_date)}
          </span>
        ),
      },
      {
        key: "updates",
        label: "التحديثات",
        defaultVisible: true,
        hideable: true,
        minWidth: 78,
        width: 88,
        renderCell: ({ row }) => <span>{row.update_count}</span>,
      },
      {
        key: "visibility",
        label: "الظهور",
        defaultVisible: true,
        hideable: true,
        sticky: "end-adjacent",
        minWidth: 82,
        width: 90,
        renderCell: ({ row, onMutationResult }) => {
          const interaction = instant.getRowInteraction(row.id);
          const visibility = trackingVisibilityTarget({
            isVisible: row.is_visible,
            isPending: interaction.isPending,
            onSelect: () => toggleVisibility(row, onMutationResult),
          });
          return (
            <AdminDataGridRowActions
              capability={visibilityOnlyCapability({
                entityType: "project_tracking_item",
                entityId: row.id,
                entityLabel: row.name,
                visibility,
              })}
              display="visibility"
              size="compact"
            />
          );
        },
      },
      {
        key: "order",
        label: "الترتيب",
        defaultVisible: true,
        hideable: true,
        sticky: "end-adjacent",
        minWidth: 92,
        width: 100,
        renderCell: ({ row, onMutationResult }) => (
          <TrackingOrderButtons
            rowId={row.id}
            ids={ids}
            disabled={!canonicalReorder || instant.bulkInteraction.isBlocked}
            onReorder={async (next) => {
              let actionResult: AdminActionResult | null = null;
              try {
                await instant.mutateAsync({
                  action: "reorder",
                  bulk: true,
                  optimistic: (cache) =>
                    cache.transformActiveRows((current) =>
                      reorderOptimisticRows(current, next),
                    ),
                  execute: async () => {
                    actionResult = await reorderTrackingItemsAction(
                      projectId,
                      stageId,
                      next,
                    );
                    return toInstantMutationResult(actionResult);
                  },
                });
              } catch (error) {
                if (actionResult) return actionResult;
                throw error;
              }
              return actionResult!;
            }}
            onResult={onMutationResult}
          />
        ),
      },
      {
        key: "actions",
        label: "الإجراءات",
        defaultVisible: true,
        hideable: false,
        sticky: "end",
        minWidth: ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
        width: ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
        renderCell: ({ row, onMutationResult }) => {
          const interaction = instant.getRowInteraction(row.id);
          return (
            <AdminDataGridRowActions
              capability={{
                entityType: "project_tracking_item",
                entityId: row.id,
                entityLabel: row.name,
                actions: {
                  edit: { access: "allowed", onSelect: () => setEditing(row) },
                  preview: {
                    access: "allowed",
                    href: trackingItemPath(projectId, row.id),
                    target: "_self",
                    label: "إدارة التحديثات",
                  },
                  information: {
                    access: "allowed",
                    title: `معلومات ${row.name}`,
                    items: [
                      {
                        label: "الحالة",
                        value: projectTrackingStatusLabel(row.status),
                      },
                      { label: "التحديثات", value: String(row.update_count) },
                      {
                        label: "الظهور",
                        value: row.is_visible ? "مرئي" : "مخفي",
                      },
                    ],
                  },
                  ...hiddenTargets(),
                  visibility: trackingVisibilityTarget({
                    isVisible: row.is_visible,
                    isPending: interaction.isPending,
                    onSelect: () => toggleVisibility(row, onMutationResult),
                  }),
                  delete:
                    interaction.pendingAction === "delete"
                      ? {
                          access: "disabled",
                          disabledReason: "انتظر انتهاء الإجراء الحالي.",
                          pending: true,
                        }
                      : row.update_count
                        ? {
                            access: "disabled",
                            disabledReason:
                              "لا يمكن حذف بند له تحديثات تاريخية.",
                          }
                        : {
                            access: "allowed",
                            onSelect: async () => {
                              let actionResult: AdminActionResult | null = null;
                              try {
                                await instant.mutateAsync({
                                  rowId: row.id,
                                  action: "delete",
                                  optimistic: (cache) =>
                                    cache.removeRows(new Set([row.id])),
                                  execute: async () => {
                                    actionResult =
                                      await deleteTrackingItemAction(
                                        projectId,
                                        stageId,
                                        row.id,
                                        row.name,
                                      );
                                    return toInstantMutationResult(
                                      actionResult,
                                    );
                                  },
                                });
                                if (actionResult)
                                  onMutationResult?.(actionResult);
                              } catch (error) {
                                if (actionResult)
                                  onMutationResult?.(actionResult);
                                throw error;
                              }
                            },
                            confirmation: {
                              mode: "shared",
                              title: "حذف البند؟",
                              description: `سيتم حذف «${row.name}» نهائيًا.`,
                              confirmLabel: "تأكيد الحذف",
                            },
                          },
                },
              }}
              size="compact"
            />
          );
        },
      },
    ],
    [
      canonicalReorder,
      ids,
      instant,
      projectId,
      stageId,
      toggleVisibility,
    ],
  );
  const metrics = controller.result.metrics!,
    basePath = trackingStagePath(projectId, stageId);
  return (
    <>
      <AdminEntityListPageLayout className="pb-10" dir="rtl">
        <AdminPageContextHeader
          eyebrow="PROJECT TRACKING — STAGE"
          title={metrics.stage.name}
          description={`إدارة بنود المرحلة داخل ${metrics.project.arabic_name}. حالة المرحلة مشتقة من هذه البنود.`}
          actions={
            <div className="flex flex-wrap gap-2">
              <AdminActionButton
                href={trackingProjectPath(projectId)}
                variant="dark"
              >
                كل المراحل
              </AdminActionButton>
              <AdminActionButton
                onClick={() => setCreateOpen(true)}
                variant="primary"
              >
                إضافة بند
              </AdminActionButton>
            </div>
          }
        />
        <AdminEntityListSurface consumer={PROJECT_TRACKING_ENTITY_KEYS.items}>
          <AdminEntityListTableRegion>
            <AdminEntityList
              listId="project-tracking-items"
              sizingStrategy={{ mode: "flexible", columnKey: "name" }}
              rows={rows}
              columns={columns}
              getRowId={(row) => row.id}
              getRowLabel={(row) => row.name}
              initialVisibleColumns={initialVisibleColumns}
              defaultVisibleColumns={[
                "name",
                "status",
                "dates",
                "updates",
                "visibility",
                "order",
                "actions",
              ]}
              onPersistColumns={(visibleColumns) =>
                saveProjectTrackingColumnPreferences("items", visibleColumns)
              }
              onRestoreColumns={() =>
                restoreProjectTrackingColumnPreferences("items")
              }
              enableColumnManagement
              enableSelection={false}
              scrollLabel="جدول بنود المرحلة"
              mapResultToFeedback={mapAdminActionResultToFeedback}
              sort={{
                key: controller.query.sort.field,
                direction: controller.query.sort.direction,
              }}
              sortMode={{
                mode: "callback",
                onToggle: (field) =>
                  controller.setSort({
                    field,
                    direction:
                      controller.query.sort.field === field &&
                      controller.query.sort.direction === "asc"
                        ? "desc"
                        : "asc",
                  }),
              }}
              onSortColumnHidden={() =>
                controller.setSort({ ...trackingItemsQueryContract.defaultSort })
              }
              actionsColumnWidth={ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH}
              toolbar={{
                basePath,
                preserveParams: ["project_id", "stage_id", "sort", "limit"],
                search: {
                  value: controller.query.search,
                  placeholder: "ابحث في البنود...",
                  minLength: 1,
                },
                filters: [statusFilter, visibilityFilter],
                values: {
                  status: controller.query.filters.status,
                  visibility: controller.query.filters.visibility,
                },
                clearableFilterKeys: ["status", "visibility"],
                onQueryPatch: controller.applyQueryPatch,
              }}
              emptyState={{
                mode:
                  controller.result.pagination.totalRows === 0 &&
                  !controller.query.search
                    ? "system"
                    : "filtered",
                systemEmpty: (
                  <p className="text-white/55">لا توجد بنود في هذه المرحلة.</p>
                ),
                filteredEmpty: (
                  <p className="text-white/55">لا توجد بنود مطابقة.</p>
                ),
              }}
            />
            <TrackingPagination
              basePath={basePath}
              result={controller.result}
              onPage={controller.setPage}
              onSize={controller.setPageSize}
            />
          </AdminEntityListTableRegion>
        </AdminEntityListSurface>
      </AdminEntityListPageLayout>
      <TrackingItemFormModal
        open={createOpen}
        projectId={projectId}
        stageId={stageId}
        onClose={() => setCreateOpen(false)}
        onSaved={() => void controller.invalidate()}
      />
      <TrackingItemFormModal
        open={Boolean(editing)}
        projectId={projectId}
        stageId={stageId}
        item={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSaved={() => void controller.invalidate()}
      />
    </>
  );
}

export function TrackingUpdatesCollection({
  initialQuery,
  initialResult,
  initialVisibleColumns,
}: {
  initialQuery: AdminEntityListQuery<TrackingUpdateFilters, TrackingUpdateSort>;
  initialResult: AdminEntityListResult<
    TrackingUpdateRow,
    TrackingUpdateMetrics
  >;
  initialVisibleColumns: readonly string[];
}) {
  const projectId = initialQuery.filters.projectId,
    itemId = initialQuery.filters.itemId;
  const routeOwnedParams = useMemo(
    () => ({ project_id: String(projectId), item_id: String(itemId) }),
    [itemId, projectId],
  );
  const controller = useAdminEntityListController({
    entity: PROJECT_TRACKING_ENTITY_KEYS.updates,
    contract: trackingUpdatesQueryContract,
    initialQuery,
    initialResult,
    staleTimeMs: 15_000,
    routeOwnedParams,
    constrainQuery: useCallback(
      (
        query: AdminEntityListQuery<TrackingUpdateFilters, TrackingUpdateSort>,
      ) => ({ ...query, filters: { ...query.filters, projectId, itemId } }),
      [projectId, itemId],
    ),
  });
  const instant = useAdminEntityInstantMutation<
    TrackingUpdateRow,
    TrackingUpdateMetrics
  >(PROJECT_TRACKING_ENTITY_KEYS.updates, controller.query);
  const [createOpen, setCreateOpen] = useState(false),
    [editing, setEditing] = useState<TrackingUpdateRow | null>(null);
  const togglePublicationVisibility = useCallback(
    async (
      row: TrackingUpdateRow,
      onMutationResult?: (result: AdminActionResult) => void,
    ) => {
      const nextPublished = row.publication_status !== "published";
      const nextStatus = nextPublished ? "published" : "draft";
      let actionResult: AdminActionResult | null = null;
      try {
        await instant.mutateAsync({
          rowId: row.id,
          action: "visibility",
          optimistic: (cache) => {
            const publicationFilter = controller.query.filters.publication;
            if (
              publicationFilter !== "all" &&
              publicationFilter !== nextStatus
            ) {
              cache.removeRows(new Set([row.id]));
              return;
            }
            cache.patchRows((candidate) =>
              candidate.id === row.id
                ? { ...candidate, publication_status: nextStatus }
                : candidate,
            );
          },
          execute: async () => {
            actionResult = await setTrackingUpdatePublicationVisibilityAction(
              projectId,
              itemId,
              row.id,
              nextPublished,
              row.title,
            );
            return toInstantMutationResult(actionResult);
          },
        });
        if (actionResult) onMutationResult?.(actionResult);
      } catch (error) {
        if (actionResult) onMutationResult?.(actionResult);
        throw error;
      }
    },
    [controller.query.filters.publication, instant, itemId, projectId],
  );
  const columns = useMemo<
    AdminEntityColumnDef<TrackingUpdateRow, string, TrackingUpdateSort>[]
  >(
    () => [
      {
        key: "title",
        label: "التحديث",
        defaultVisible: true,
        hideable: false,
        sortable: true,
        sortKey: "title",
        primary: true,
        sticky: "start",
        minWidth: ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS.textOnly,
        width: ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS.textOnly,
        flexible: true,
        renderCell: ({ row }) => (
          <div>
            <b>{row.title}</b>
            <p className="mt-1 line-clamp-1 text-xs text-white/40">
              {row.body}
            </p>
          </div>
        ),
      },
      {
        key: "date",
        label: "تاريخ التوثيق",
        defaultVisible: true,
        hideable: true,
        sortable: true,
        sortKey: "occurred_at",
        minWidth: 118,
        width: 128,
        renderCell: ({ row }) => (
          <span className="text-sm">
            {formatAdminDateOnly(row.occurred_at.slice(0, 10))}
          </span>
        ),
      },
      {
        key: "publication",
        label: "النشر",
        defaultVisible: true,
        hideable: true,
        sortable: true,
        sortKey: "publication_status",
        minWidth: 82,
        width: 90,
        renderCell: ({ row, onMutationResult }) => {
          const interaction = instant.getRowInteraction(row.id);
          const visibility = trackingVisibilityTarget({
            isVisible: row.publication_status === "published",
            isPending: interaction.isPending,
            onSelect: () => togglePublicationVisibility(row, onMutationResult),
          });
          return (
            <AdminDataGridRowActions
              capability={visibilityOnlyCapability({
                entityType: "project_tracking_update",
                entityId: row.id,
                entityLabel: row.title,
                visibility,
              })}
              display="visibility"
              size="compact"
            />
          );
        },
      },
      {
        key: "media",
        label: "الوسائط",
        defaultVisible: true,
        hideable: true,
        minWidth: 130,
        width: 145,
        renderCell: ({ row }) => (
          <span className="text-sm text-white/55">
            {row.media.filter((item) => item.media_kind === "image").length}{" "}
            صورة /{" "}
            {row.media.filter((item) => item.media_kind === "video").length}{" "}
            فيديو
          </span>
        ),
      },
      {
        key: "actions",
        label: "الإجراءات",
        defaultVisible: true,
        hideable: false,
        sticky: "end",
        minWidth: ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
        width: ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
        renderCell: ({ row, onMutationResult }) => {
          const interaction = instant.getRowInteraction(row.id);
          return (
            <AdminDataGridRowActions
              capability={{
                entityType: "project_tracking_update",
                entityId: row.id,
                entityLabel: row.title,
                actions: {
                  edit: { access: "allowed", onSelect: () => setEditing(row) },
                  preview: {
                    access: "allowed",
                    href: `/track-your-project/${controller.result.metrics!.project.slug}`,
                    target: "_blank",
                    rel: "noreferrer",
                    label: "الصفحة العامة",
                  },
                  information: {
                    access: "allowed",
                    title: `معلومات ${row.title}`,
                    items: [
                      {
                        label: "التاريخ",
                        value: formatAdminDateOnly(row.occurred_at.slice(0, 10)),
                      },
                      { label: "الحالة", value: row.publication_status },
                      { label: "الوسائط", value: String(row.media.length) },
                    ],
                  },
                  ...hiddenTargets(),
                  visibility: trackingVisibilityTarget({
                    isVisible: row.publication_status === "published",
                    isPending: interaction.isPending,
                    onSelect: () =>
                      togglePublicationVisibility(row, onMutationResult),
                  }),
                  delete:
                    interaction.pendingAction === "delete"
                      ? {
                          access: "disabled",
                          disabledReason: "انتظر انتهاء الإجراء الحالي.",
                          pending: true,
                        }
                      : {
                          access: "allowed",
                          onSelect: async () => {
                            let actionResult: AdminActionResult | null = null;
                            try {
                              await instant.mutateAsync({
                                rowId: row.id,
                                action: "delete",
                                optimistic: (cache) =>
                                  cache.removeRows(new Set([row.id])),
                                execute: async () => {
                                  actionResult =
                                    await deleteTrackingUpdateAction(
                                      projectId,
                                      itemId,
                                      row.id,
                                      row.title,
                                    );
                                  return toInstantMutationResult(actionResult);
                                },
                              });
                              if (actionResult)
                                onMutationResult?.(actionResult);
                            } catch (error) {
                              if (actionResult)
                                onMutationResult?.(actionResult);
                              throw error;
                            }
                          },
                          confirmation: {
                            mode: "shared",
                            title: "حذف التحديث؟",
                            description: `سيتم حذف «${row.title}» وروابطه فقط. لن تُحذف ملفات Media الفعلية.`,
                            confirmLabel: "تأكيد الحذف",
                          },
                        },
                },
              }}
              size="compact"
            />
          );
        },
      },
    ],
    [
      controller,
      instant,
      itemId,
      projectId,
      togglePublicationVisibility,
    ],
  );
  const metrics = controller.result.metrics!,
    basePath = trackingItemPath(projectId, itemId);
  return (
    <>
      <AdminEntityListPageLayout className="pb-10" dir="rtl">
        <AdminPageContextHeader
          eyebrow="PROJECT TRACKING — ITEM HISTORY"
          title={metrics.item.name}
          description={`سجل تحديثات تاريخي داخل مرحلة ${metrics.stage.name}. المسودات لا تظهر للعامة.`}
          actions={
            <div className="flex flex-wrap gap-2">
              <AdminActionButton
                href={trackingStagePath(projectId, metrics.stage.id)}
                variant="dark"
              >
                بنود المرحلة
              </AdminActionButton>
              <AdminActionButton
                onClick={() => setCreateOpen(true)}
                variant="primary"
              >
                إضافة تحديث
              </AdminActionButton>
            </div>
          }
        />
        <AdminEntityListSurface consumer={PROJECT_TRACKING_ENTITY_KEYS.updates}>
          <AdminEntityListTableRegion>
            <AdminEntityList
              listId="project-tracking-updates"
              sizingStrategy={{ mode: "flexible", columnKey: "title" }}
              rows={controller.result.rows}
              columns={columns}
              getRowId={(row) => row.id}
              getRowLabel={(row) => row.title}
              initialVisibleColumns={initialVisibleColumns}
              defaultVisibleColumns={[
                "title",
                "date",
                "publication",
                "media",
                "actions",
              ]}
              onPersistColumns={(visibleColumns) =>
                saveProjectTrackingColumnPreferences("updates", visibleColumns)
              }
              onRestoreColumns={() =>
                restoreProjectTrackingColumnPreferences("updates")
              }
              enableColumnManagement
              enableSelection={false}
              scrollLabel="جدول تحديثات التنفيذ"
              mapResultToFeedback={mapAdminActionResultToFeedback}
              sort={{
                key: controller.query.sort.field,
                direction: controller.query.sort.direction,
              }}
              sortMode={{
                mode: "callback",
                onToggle: (field) =>
                  controller.setSort({
                    field,
                    direction:
                      controller.query.sort.field === field &&
                      controller.query.sort.direction === "asc"
                        ? "desc"
                        : "asc",
                  }),
              }}
              onSortColumnHidden={() =>
                controller.setSort({ ...trackingUpdatesQueryContract.defaultSort })
              }
              actionsColumnWidth={ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH}
              toolbar={{
                basePath,
                preserveParams: ["project_id", "item_id", "sort", "limit"],
                search: {
                  value: controller.query.search,
                  placeholder: "ابحث في التحديثات...",
                  minLength: 1,
                },
                filters: [publicationFilter],
                values: { publication: controller.query.filters.publication },
                clearableFilterKeys: ["publication"],
                onQueryPatch: controller.applyQueryPatch,
              }}
              emptyState={{
                mode:
                  controller.result.pagination.totalRows === 0 &&
                  !controller.query.search &&
                  controller.query.filters.publication === "all"
                    ? "system"
                    : "filtered",
                systemEmpty: (
                  <p className="text-white/55">
                    لا توجد تحديثات بعد. أضف أول سجل تاريخي.
                  </p>
                ),
                filteredEmpty: (
                  <p className="text-white/55">لا توجد تحديثات مطابقة.</p>
                ),
              }}
            />
            <TrackingPagination
              basePath={basePath}
              result={controller.result}
              onPage={controller.setPage}
              onSize={controller.setPageSize}
            />
          </AdminEntityListTableRegion>
        </AdminEntityListSurface>
      </AdminEntityListPageLayout>
      <TrackingUpdateFormModal
        open={createOpen}
        projectId={projectId}
        itemId={itemId}
        onClose={() => setCreateOpen(false)}
        onSaved={() => void controller.invalidate()}
      />
      <TrackingUpdateFormModal
        open={Boolean(editing)}
        projectId={projectId}
        itemId={itemId}
        update={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSaved={() => void controller.invalidate()}
      />
    </>
  );
}
