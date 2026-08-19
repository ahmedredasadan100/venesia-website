"use client";

import { useCallback, useMemo, useState } from "react";

import {
  AdminEntityList,
  AdminEntityListPageLayout,
  AdminEntityListSurface,
  AdminEntityListTableRegion,
} from "../../../../components/admin/entity-list";
import {
  ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS,
  ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
  AdminActionButton,
  AdminDataGridRowActions,
  AdminPageContextHeader,
  AdminTablePagination,
  type AdminRowActionsCapability,
} from "../../../../components/admin/ui";
import { mapAdminActionResultToFeedback } from "../../../../lib/admin/admin-action-feedback";
import {
  adminActionFailure,
  adminActionSuccess,
  type AdminActionResult,
} from "../../../../lib/admin/admin-action-result";
import type {
  AdminEntityColumnDef,
  AdminEntityFilterDef,
} from "../../../../lib/admin/entity-list";
import type {
  AdminEntityListQuery,
  AdminEntityListResult,
} from "../../../../lib/admin/entity-list/data-engine/contracts";
import { useAdminEntityListController } from "../../../../lib/admin/entity-list/data-engine/client-controller";
import {
  useAdminEntityInstantMutation,
  type AdminInstantMutationRowInteraction,
} from "../../../../lib/admin/entity-list/data-engine/instant-mutation";
import {
  PROJECT_LOCATION_LEVEL_CONFIG,
  PROJECT_LOCATION_ENTITY_KEYS,
  PROJECT_LOCATION_LEVELS,
  PROJECT_LOCATION_LIST_PAGE_SIZES,
  getProjectLocationManagementColumnKeys,
  getProjectLocationManagementDefaultColumnKeys,
  getProjectLocationManagementPreferenceColumnKeys,
  projectLocationManagementPath,
  projectLocationsQueryContract,
  type ProjectLocationFilters,
  type ProjectLocationLevel,
  type ProjectLocationManagementColumnKey,
  type ProjectLocationManagementMetrics,
  type ProjectLocationManagementRow,
  type ProjectLocationSortField,
} from "../../../../lib/admin/projects/location-management-contract";
import ProjectLocationFormModal from "./ProjectLocationFormModal";
import {
  deleteProjectLocationAction,
  setProjectLocationActiveAction,
} from "./actions";
import {
  restoreProjectLocationTablePreferences,
  saveProjectLocationTablePreferences,
} from "./column-preferences";

type ProjectLocationsManagementClientProps = {
  level: ProjectLocationLevel;
  initialQuery: AdminEntityListQuery<
    ProjectLocationFilters,
    ProjectLocationSortField
  >;
  initialResult: AdminEntityListResult<
    ProjectLocationManagementRow,
    ProjectLocationManagementMetrics
  >;
  initialVisibleColumns: readonly string[];
  initialPreferenceError: string | null;
};

const PAGE_SIZE_OPTIONS = PROJECT_LOCATION_LIST_PAGE_SIZES.map(String);
const PROJECT_LOCATION_NAV_LABELS: Record<ProjectLocationLevel, string> = {
  governorate: "المحافظات",
  city: "المدن",
  main_area: "الأحياء",
  sub_area: "المناطق الفرعية",
};

const STATUS_FILTER: AdminEntityFilterDef = {
  id: "project-location-status",
  paramKey: "status",
  label: "الحالة",
  placeholder: "الحالة",
  type: "status",
  options: [
    { value: "active", label: "نشط" },
    { value: "inactive", label: "غير نشط" },
  ],
};

function displayName(nameAr: string, nameEn: string | null) {
  return nameEn ? `${nameAr} — ${nameEn}` : nameAr;
}

function createLocationRowActionsCapability(input: {
  row: ProjectLocationManagementRow;
  singularLabel: string;
  rowInteraction: (id: number) => AdminInstantMutationRowInteraction;
  onEdit: (row: ProjectLocationManagementRow) => void;
  onToggle: (row: ProjectLocationManagementRow) => Promise<AdminActionResult>;
  onDelete: (row: ProjectLocationManagementRow) => Promise<AdminActionResult>;
  onMutationResult?: (result: AdminActionResult) => void;
}): AdminRowActionsCapability {
  const { row } = input;
  const interaction = input.rowInteraction(row.id);
  const pending = interaction.pendingAction;
  const deleteEligibility = row.delete_eligibility;
  const visibilityEligibility = row.visibility_eligibility;

  return {
    entityType: "project_location",
    entityId: row.id,
    entityLabel: row.name_ar,
    actions: {
      edit: { access: "allowed", onSelect: () => input.onEdit(row) },
      preview: { access: "hidden" },
      information: {
        access: "allowed",
        title: `معلومات ${input.singularLabel}`,
        items: [
          { label: "المعرّف", value: String(row.id) },
          { label: "الاسم", value: displayName(row.name_ar, row.name_en) },
          { label: "الترتيب", value: String(row.sort_order) },
          { label: "المشروعات المرتبطة", value: String(row.project_count) },
          { label: "العناصر الفرعية", value: String(row.child_count) },
        ],
      },
      copyPublicLink: { access: "hidden" },
      visibility: pending === "visibility"
        ? {
            access: "disabled",
            disabledReason: "انتظر انتهاء الإجراء الحالي.",
            pending: true,
            isVisible: row.is_active,
          }
        : row.is_active && !visibilityEligibility.canDeactivate
          ? {
              access: "disabled",
              disabledReason: visibilityEligibility.disabledReason ?? undefined,
              isVisible: row.is_active,
            }
          : {
            access: "allowed",
            isVisible: row.is_active,
            onSelect: async () => {
              const result = await input.onToggle(row);
              input.onMutationResult?.(result);
              if (!result.ok) throw new Error(result.message);
            },
            confirmation: {
              mode: "shared",
              title: row.is_active ? "تعطيل الموقع؟" : "تفعيل الموقع؟",
              description: row.is_active
                ? "لن يظهر الموقع في الاختيارات الجديدة، وستبقى العلاقات الحالية محفوظة."
                : "سيصبح الموقع متاحًا للاختيار وفق التسلسل الحالي.",
              confirmLabel: row.is_active ? "تأكيد التعطيل" : "تأكيد التفعيل",
            },
            },
      featured: { access: "hidden" },
      duplicate: { access: "hidden" },
      archive: { access: "hidden" },
      delete: pending === "delete"
        ? {
            access: "disabled",
            disabledReason: "انتظر انتهاء الإجراء الحالي.",
            pending: true,
          }
        : !deleteEligibility.canDelete
          ? {
              access: "disabled",
              disabledReason: deleteEligibility.disabledReason ?? undefined,
            }
          : {
              access: "allowed",
              onSelect: async () => {
                const result = await input.onDelete(row);
                input.onMutationResult?.(result);
                if (!result.ok) throw new Error(result.message);
              },
              confirmation: {
                mode: "shared",
                title: "حذف الموقع؟",
                description: `سيتم حذف «${row.name_ar}» نهائيًا من تسلسل مواقع المشاريع.`,
                confirmLabel: "تأكيد الحذف",
              },
            },
    },
  };
}

function createColumns(input: {
  level: ProjectLocationLevel;
  rowInteraction: (id: number) => AdminInstantMutationRowInteraction;
  onEdit: (row: ProjectLocationManagementRow) => void;
  onToggle: (row: ProjectLocationManagementRow) => Promise<AdminActionResult>;
  onDelete: (row: ProjectLocationManagementRow) => Promise<AdminActionResult>;
}): AdminEntityColumnDef<
  ProjectLocationManagementRow,
  ProjectLocationManagementColumnKey,
  ProjectLocationSortField
>[] {
  const config = PROJECT_LOCATION_LEVEL_CONFIG[input.level];
  const availableColumns = new Set(
    getProjectLocationManagementColumnKeys(input.level),
  );
  const optionalColumns = new Set(
    getProjectLocationManagementPreferenceColumnKeys(input.level),
  );
  const columns: AdminEntityColumnDef<
    ProjectLocationManagementRow,
    ProjectLocationManagementColumnKey,
    ProjectLocationSortField
  >[] = [
    {
      key: "name",
      label: "الاسم",
      defaultVisible: true,
      hideable: false,
      sortable: true,
      sortKey: "name_ar",
      minWidth: ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS.textOnly,
      width: ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS.textOnly,
      sticky: "start",
      primary: true,
      renderCell: ({ row }) => (
        <span className="block truncate text-right font-semibold text-white">
          {displayName(row.name_ar, row.name_en)}
        </span>
      ),
    },
    {
      key: "parent",
      label: config.parentLabel ?? "المستوى",
      defaultVisible: true,
      hideable: optionalColumns.has("parent"),
      minWidth: 210,
      width: 230,
      flexible: input.level !== "governorate",
      renderCell: ({ row }) => (
        <span className="block truncate text-right text-sm text-white/68">
          {row.parent_name_ar
            ? displayName(row.parent_name_ar, row.parent_name_en)
            : "مستوى رئيسي"}
        </span>
      ),
    },
    {
      key: "order",
      label: "الترتيب",
      defaultVisible: true,
      hideable: optionalColumns.has("order"),
      sortable: true,
      sortKey: "sort_order",
      minWidth: 100,
      width: 110,
      renderCell: ({ row }) => <span className="font-en text-sm">{row.sort_order}</span>,
    },
    {
      key: "relations",
      label: "العلاقات",
      defaultVisible: true,
      hideable: optionalColumns.has("relations"),
      minWidth: 170,
      width: 180,
      flexible: input.level === "governorate",
      renderCell: ({ row }) => (
        <span className="text-sm text-white/62">
          {row.project_count} مشروع / {row.child_count} فرعي
        </span>
      ),
    },
    {
      key: "status",
      label: "الحالة",
      defaultVisible: true,
      hideable: optionalColumns.has("status"),
      minWidth: 112,
      width: 120,
      renderCell: ({ row, onMutationResult }) => (
        <AdminDataGridRowActions
          capability={createLocationRowActionsCapability({
            row,
            singularLabel: config.singularLabel,
            rowInteraction: input.rowInteraction,
            onEdit: input.onEdit,
            onToggle: input.onToggle,
            onDelete: input.onDelete,
            onMutationResult,
          })}
          display="visibility"
          size="compact"
        />
      ),
    },
    {
      key: "actions",
      label: "الإجراءات",
      defaultVisible: true,
      hideable: false,
      minWidth: ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
      width: ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
      sticky: "end",
      renderCell: ({ row, onMutationResult }) => (
        <AdminDataGridRowActions
          capability={createLocationRowActionsCapability({
            row,
            singularLabel: config.singularLabel,
            rowInteraction: input.rowInteraction,
            onEdit: input.onEdit,
            onToggle: input.onToggle,
            onDelete: input.onDelete,
            onMutationResult,
          })}
          size="compact"
        />
      ),
    },
  ];

  return columns.filter((column) => availableColumns.has(column.key));
}

export default function ProjectLocationsManagementClient({
  level,
  initialQuery,
  initialResult,
  initialVisibleColumns,
  initialPreferenceError,
}: ProjectLocationsManagementClientProps) {
  const config = PROJECT_LOCATION_LEVEL_CONFIG[level];
  const entityKey = PROJECT_LOCATION_ENTITY_KEYS[level];
  const flexibleColumnKey: ProjectLocationManagementColumnKey =
    level === "governorate" ? "relations" : "parent";
  const controller = useAdminEntityListController({
    entity: entityKey,
    contract: projectLocationsQueryContract,
    initialQuery,
    initialResult,
    staleTimeMs: 30_000,
  });
  const instant = useAdminEntityInstantMutation<ProjectLocationManagementRow>(
    entityKey,
    controller.query,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectLocationManagementRow | null>(null);

  const toggleActive = useCallback(async (row: ProjectLocationManagementRow) => {
    const nextActive = !row.is_active;
    try {
      const result = await instant.mutateAsync({
        rowId: row.id,
        action: "visibility",
        optimistic: (cache) => {
          if (
            controller.query.filters.status !== "all" &&
            controller.query.filters.status !== (nextActive ? "active" : "inactive")
          ) {
            cache.removeRows(new Set([row.id]));
            return;
          }
          cache.patchRows((current) => current.id === row.id
            ? { ...current, is_active: nextActive }
            : current);
        },
        execute: async () => {
          const actionResult = await setProjectLocationActiveAction(
            row.id,
            level,
            nextActive,
          );
          if (!actionResult.ok) {
            return {
              ok: false as const,
              code: actionResult.code ?? "project_location_status_failed",
              message: actionResult.message,
            };
          }
          return {
            ok: true as const,
            message: actionResult.message,
            location:
              "location" in actionResult ? actionResult.location : undefined,
          };
        },
        reconcileSuccess: (confirmed, tools) => {
          const location = confirmed.location;
          if (!location || typeof location !== "object") return;
          tools.cache.patchRows((current) => current.id === row.id
            ? (location as ProjectLocationManagementRow)
            : current);
        },
      });
      return adminActionSuccess(
        nextActive ? "تم تفعيل الموقع" : "تم تعطيل الموقع",
        result.message,
        { code: nextActive ? "published" : "unpublished", entityId: row.id },
      );
    } catch (error) {
      return adminActionFailure(
        "تعذر تحديث حالة الموقع",
        error instanceof Error ? error.message : "تعذر تحديث حالة الموقع.",
        { entityId: row.id },
      );
    }
  }, [controller.query.filters.status, instant, level]);

  const deleteLocation = useCallback(async (row: ProjectLocationManagementRow) => {
    try {
      const result = await instant.mutateAsync({
        rowId: row.id,
        action: "delete",
        optimistic: (cache) => cache.removeRows(new Set([row.id])),
        execute: async () => {
          const actionResult = await deleteProjectLocationAction(row.id, level);
          return actionResult.ok
            ? { ok: true as const, message: actionResult.message }
            : {
                ok: false as const,
                code: actionResult.code ?? "project_location_delete_failed",
                message: actionResult.message,
              };
        },
      });
      return adminActionSuccess("تم حذف الموقع", result.message, {
        code: "deleted",
        entityId: row.id,
      });
    } catch (error) {
      return adminActionFailure(
        "تعذر حذف الموقع",
        error instanceof Error ? error.message : "تعذر حذف الموقع.",
        { entityId: row.id },
      );
    }
  }, [instant, level]);

  const columns = useMemo(() => createColumns({
    level,
    rowInteraction: instant.getRowInteraction,
    onEdit: setEditing,
    onToggle: toggleActive,
    onDelete: deleteLocation,
  }), [deleteLocation, instant.getRowInteraction, level, toggleActive]);
  const hasFilters = Boolean(controller.query.search) || controller.query.filters.status !== "all";
  const basePath = projectLocationManagementPath(level);
  const initialFeedback = useMemo(() => {
    const errorMessage = controller.error?.message ?? initialPreferenceError;
    if (!errorMessage) return null;
    return mapAdminActionResultToFeedback(adminActionFailure(
      controller.error
        ? "تعذر تحميل المواقع"
        : "تعذر تحميل تفضيلات الأعمدة",
      errorMessage,
    ));
  }, [controller.error, initialPreferenceError]);

  return (
    <>
      <AdminEntityListPageLayout className="pb-10" dir="rtl">
        <AdminPageContextHeader
          eyebrow="PROJECT LOCATION DOMAIN"
          title={config.label}
          description={`إدارة ${config.label} والعلاقات والحالة والترتيب من مصدر مواقع المشاريع المعتمد.`}
          actions={
            <div className="flex flex-wrap gap-2">
              {PROJECT_LOCATION_LEVELS.map((targetLevel) => (
                <AdminActionButton
                  key={targetLevel}
                  href={projectLocationManagementPath(targetLevel)}
                  variant={targetLevel === level ? "gold" : "dark"}
                >
                  {PROJECT_LOCATION_NAV_LABELS[targetLevel]}
                </AdminActionButton>
              ))}
              <AdminActionButton variant="primary" onClick={() => setCreateOpen(true)}>
                إضافة {config.singularLabel}
              </AdminActionButton>
            </div>
          }
        />

        <AdminEntityListSurface consumer={entityKey}>
          <AdminEntityListTableRegion data-admin-entity-list-pending={controller.queryPending ? "true" : "false"}>
            <AdminEntityList<ProjectLocationManagementRow, ProjectLocationManagementColumnKey, ProjectLocationSortField, number>
              listId={`${entityKey}-table`}
              sizingStrategy={{
                mode: "flexible",
                columnKey: flexibleColumnKey,
              }}
              toolbar={{
                basePath,
                preserveParams: ["sort", "limit"],
                search: {
                  value: controller.query.search,
                  placeholder: "ابحث بالاسم العربي أو الإنجليزي...",
                  minLength: projectLocationsQueryContract.searchMinLength,
                },
                filters: [STATUS_FILTER],
                values: { status: controller.query.filters.status },
                clearableFilterKeys: ["status"],
                onQueryPatch: controller.applyQueryPatch,
              }}
              rows={controller.result.rows}
              columns={columns}
              getRowId={(row) => row.id}
              getRowLabel={(row) => row.name_ar}
              initialVisibleColumns={initialVisibleColumns}
              defaultVisibleColumns={[
                ...getProjectLocationManagementDefaultColumnKeys(level),
              ]}
              onPersistColumns={(visibleColumns) =>
                saveProjectLocationTablePreferences(level, visibleColumns)
              }
              onRestoreColumns={() =>
                restoreProjectLocationTablePreferences(level)
              }
              enableColumnManagement
              enableSelection={false}
              scrollLabel={`جدول ${config.label}`}
              mapResultToFeedback={mapAdminActionResultToFeedback}
              sort={{ key: controller.query.sort.field, direction: controller.query.sort.direction }}
              sortMode={{
                mode: "callback",
                onToggle: (field) => controller.setSort({
                  field,
                  direction:
                    controller.query.sort.field === field && controller.query.sort.direction === "asc"
                      ? "desc"
                      : "asc",
                }),
              }}
              onSortColumnHidden={() =>
                controller.setSort({ ...projectLocationsQueryContract.defaultSort })
              }
              actionsColumnWidth={ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH}
              initialFeedback={initialFeedback}
              emptyState={{
                mode: controller.result.pagination.totalRows === 0 && !hasFilters ? "system" : "filtered",
                systemEmpty: (
                  <div>
                    <p className="text-base font-semibold text-white">لا توجد بيانات لهذا المستوى</p>
                    <p className="mt-2 text-sm text-white/45">أضف أول عنصر من زر الإضافة أعلى الصفحة.</p>
                  </div>
                ),
                filteredEmpty: <p className="text-base font-semibold text-white">لا توجد نتائج مطابقة.</p>,
              }}
            />
            <AdminTablePagination
              basePath={basePath}
              totalCount={controller.result.pagination.totalRows}
              pageSize={String(controller.result.pagination.pageSize)}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              currentPage={controller.result.pagination.page}
              totalPages={controller.result.pagination.totalPages}
              emptySummaryText="لا توجد مواقع"
              onPageChange={controller.setPage}
              onPageSizeChange={controller.setPageSize}
            />
          </AdminEntityListTableRegion>
        </AdminEntityListSurface>
      </AdminEntityListPageLayout>

      <ProjectLocationFormModal
        open={createOpen}
        mode="create"
        level={level}
        parentOptions={controller.result.metrics?.parentOptions ?? []}
        onClose={() => setCreateOpen(false)}
        onSaved={() => void controller.invalidate()}
      />
      <ProjectLocationFormModal
        open={Boolean(editing)}
        mode="edit"
        level={level}
        location={editing ?? undefined}
        parentOptions={controller.result.metrics?.parentOptions ?? []}
        onClose={() => setEditing(null)}
        onSaved={() => void controller.invalidate()}
      />
    </>
  );
}
