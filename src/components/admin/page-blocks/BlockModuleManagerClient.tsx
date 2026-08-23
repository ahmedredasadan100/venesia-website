"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import AdminEntityListFilters from "../entity-list/AdminEntityListFilters";
import {
  AdminFeedbackRegion,
  useAdminFeedback,
} from "../AdminFeedbackProvider";
import MediaSynchronizationWarningNotice from "../media/MediaSynchronizationWarningNotice";
import {
  ADMIN_DATA_GRID_ACTION_COLUMNS,
  ADMIN_DATA_GRID_COLUMNS,
  ADMIN_FORM,
  ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE,
  AdminBulkActionBar,
  AdminColumnVisibilityMenu,
  AdminDataGrid,
  AdminDataGridCheckbox,
  AdminDataGridCheckboxCell,
  AdminDataGridCenterCell,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridPrimaryCell,
  AdminDataGridRow,
  AdminDataGridRowActions,
  AdminDataGridSortLabel,
  AdminDataGridStatusCell,
  AdminFormError,
  AdminFormListboxSelect,
  AdminFormRuntime,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  AdminPageExperience,
  AdminPageContextHeader,
  AdminTablePagination,
  VenesiaModal,
  adminFormFieldClassName,
  adminFormLabelClassName,
  type AdminRowActionsCapability,
  useAdminGridSelection,
} from "../ui";
import { useAdminTable } from "../table-engine";
import type { AdminFormRuntimeHandle } from "../ui/AdminFormRuntime";
import { PlusIcon } from "../AdminRowActions";
import type { AdminFormAction } from "../../../lib/admin/form-runtime";
import { MODULE_EDITOR_TERMINOLOGY } from "../../../lib/page-blocks/module-editor-presentation-contract";
import {
  adminCollectionSearchIncludes,
  useAdminBoundedClientPagination,
  type AdminBoundedClientQueryContract,
} from "../../../lib/admin/entity-list";
import { ADMIN_BULK_ACTION_LABELS } from "../../../lib/admin/entity-list/bulk-action-labels";
import { useAdminBoundedClientInstantMutation } from "../../../lib/admin/entity-list/data-engine/instant-mutation";
import {
  getPageCompositionColumnPreferenceConfig,
  getPageCompositionDefaultColumnKeys,
  normalizePageCompositionVisibleColumnKeys,
  type PageCompositionColumnPreferenceId,
} from "../../../lib/page-blocks/admin-collection-columns";
import { statusMeta } from "../../../lib/page-blocks/admin-utils";
import {
  restorePageCompositionColumnPreferences,
  savePageCompositionColumnPreferences,
} from "../../../app/admin/pages-blocks/column-preferences";

export type BlockModuleRow = {
  id: number;
  name: string;
  slug?: string;
  description: string | null;
  variant?: string;
  status: string;
};

type BlockModuleSortKey = "name" | "slug" | "variant" | "status";

type BlockModuleManagerClientProps = {
  moduleKey: "cta" | "cards" | "breadcrumb" | "feed";
  moduleTitle: string;
  moduleDescription: string;
  rows: BlockModuleRow[];
  createAction: AdminFormAction;
  deleteAction: (formData: FormData) => Promise<void>;
  duplicateAction: (formData: FormData) => Promise<void>;
  toggleAction: (formData: FormData) => Promise<void>;
  bulkAction: (formData: FormData) => Promise<void>;
  defaultVariant: string;
  variantOptions: Array<[string, string]>;
  technicalIdentityMode?: "editable" | "internal";
  variantFieldMode?: "editable" | "internal";
  loadError?: string | null;
  mediaSynchronizationWarning?: boolean;
  initialVisibleColumns?: readonly string[] | null;
  preferenceError?: string | null;
};

const PAGE_SIZE = Number(ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE);
const COLUMN_PREFERENCE_ID_BY_MODULE = {
  breadcrumb: "breadcrumbTemplates",
  cards: "cardsTemplates",
  cta: "ctaTemplates",
  feed: "feedTemplates",
} as const satisfies Record<
  BlockModuleManagerClientProps["moduleKey"],
  PageCompositionColumnPreferenceId
>;

function mutationFormData(fields: Record<string, string | number>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, String(value));
  }
  return formData;
}

function blockSearchPlaceholder(
  technicalIdentityMode: "editable" | "internal",
  variantFieldMode: "editable" | "internal",
) {
  const terms = ["اسم البلوك", "الوصف"];
  if (technicalIdentityMode === "editable") terms.push("المعرّف");
  if (variantFieldMode === "editable") terms.push("النمط");
  return `ابحث بـ${terms.join(" أو ")}…`;
}

export default function BlockModuleManagerClient({
  moduleKey,
  moduleTitle,
  moduleDescription,
  rows,
  createAction,
  deleteAction,
  duplicateAction,
  toggleAction,
  bulkAction,
  defaultVariant,
  variantOptions,
  technicalIdentityMode = "editable",
  variantFieldMode = "editable",
  loadError = null,
  mediaSynchronizationWarning = false,
  initialVisibleColumns = null,
  preferenceError = null,
}: BlockModuleManagerClientProps) {
  const feedbackChannel = `block-manager:${moduleKey}`;
  const { publishFeedback, clearFeedback } = useAdminFeedback();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const createRuntimeRef = useRef<AdminFormRuntimeHandle>(null);
  const instant = useAdminBoundedClientInstantMutation<BlockModuleRow>({
    entity: `${moduleKey}-block-templates`,
    initialRows: rows,
    datasetKey: moduleKey,
  });
  const variantLabelByValue = useMemo(
    () => new Map(variantOptions),
    [variantOptions],
  );
  const columnPreferenceId = COLUMN_PREFERENCE_ID_BY_MODULE[moduleKey];
  const columnConfig =
    getPageCompositionColumnPreferenceConfig(columnPreferenceId);
  const defaultColumns =
    getPageCompositionDefaultColumnKeys(columnPreferenceId);
  const [visibleColumns, setVisibleColumns] = useState(() =>
    normalizePageCompositionVisibleColumnKeys(
      columnPreferenceId,
      initialVisibleColumns,
    ),
  );
  const visibleColumnSet = useMemo(
    () => new Set(visibleColumns),
    [visibleColumns],
  );
  const gridColumns = useMemo(
    () =>
      [
        ADMIN_DATA_GRID_COLUMNS.checkbox,
        ADMIN_DATA_GRID_COLUMNS.primaryStandard,
        visibleColumnSet.has("slug") ? "minmax(180px,1fr)" : null,
        visibleColumnSet.has("variant") ? "120px" : null,
        visibleColumnSet.has("status")
          ? ADMIN_DATA_GRID_COLUMNS.statusStandard
          : null,
        ADMIN_DATA_GRID_ACTION_COLUMNS.threeCompact,
      ]
        .filter((column) => column !== null)
        .join(" "),
    [visibleColumnSet],
  );
  const sortAccessors = useMemo(
    () => ({
      name: (row: BlockModuleRow) => row.name,
      slug: (row: BlockModuleRow) => row.slug ?? "",
      variant: (row: BlockModuleRow) =>
        variantLabelByValue.get(row.variant ?? "") ?? row.variant ?? "",
      status: (row: BlockModuleRow) => statusMeta(row.status).label,
    }),
    [variantLabelByValue],
  );
  const table = useAdminTable<BlockModuleRow, BlockModuleSortKey>({
    initialRows: instant.rows,
    getRowId: (row) => row.id,
    sortAccessors,
  });
  const setTableRows = table.setRows;
  useEffect(() => {
    setTableRows(instant.rows);
  }, [instant.rows, setTableRows]);
  const queryContract = useMemo<
    AdminBoundedClientQueryContract<BlockModuleRow>
  >(
    () => ({
      mode: "bounded-client",
      search: { minLength: 1 },
      matchesRow: (row, query) =>
        adminCollectionSearchIncludes(
          [
            row.name,
            row.description ?? "",
            technicalIdentityMode === "editable" ? row.slug ?? "" : "",
            variantFieldMode === "editable" ? row.variant ?? "" : "",
            variantFieldMode === "editable" ? variantLabelByValue.get(row.variant ?? "") ?? "" : "",
          ].join(" "),
          query.search,
        ),
      getRowId: (row) => row.id,
    }),
    [technicalIdentityMode, variantFieldMode, variantLabelByValue],
  );
  const pagination = useAdminBoundedClientPagination({
    rows: table.rows,
    datasetKey: moduleKey,
    queryContract,
    defaultPageSize: PAGE_SIZE,
  });
  const search = pagination.search;
  const paginatedRows = pagination.rows;
  const visibleIds = useMemo(
    () => paginatedRows.map((row) => row.id),
    [paginatedRows],
  );
  const selection = useAdminGridSelection<number>(visibleIds);
  const loadFeedback = useMemo(
    () =>
      loadError
        ? {
            variant: "danger" as const,
            title: "تعذر تحميل مكتبة البلوكات",
            message: loadError,
            layout: "inline" as const,
            dismissible: true,
            lifecycle: "persistent" as const,
          }
        : null,
    [loadError],
  );
  const mediaWarningNotice = useMemo(
    () => (
      <MediaSynchronizationWarningNotice
        visible={mediaSynchronizationWarning}
      />
    ),
    [mediaSynchronizationWarning],
  );

  async function runMutation(
    rowId: number | null,
    mutationAction: "duplicate" | "delete" | "bulk",
    action: () => Promise<void>,
    successMessage: string,
  ): Promise<boolean> {
    clearFeedback(feedbackChannel);
    try {
      await instant.mutateAsync({
        rowId: rowId ?? undefined,
        action: mutationAction,
        bulk: rowId === null,
        optimistic: (cache) => {
          if (mutationAction === "delete" && rowId !== null) {
            cache.removeRows(new Set([rowId]));
          }
        },
        execute: async () => {
          await action();
          return { ok: true as const, message: successMessage };
        },
      });
      publishFeedback(
        {
          variant: "success",
          title: "تم تنفيذ الإجراء",
          message: successMessage,
          layout: "inline",
          dismissible: true,
          lifecycle: "manual",
        },
        { channel: feedbackChannel, placement: "inline" },
      );
      return true;
    } catch (error) {
      publishFeedback(
        {
          variant: "danger",
          title: "تعذر تنفيذ الإجراء",
          message:
            error instanceof Error
              ? error.message
              : "تعذر تنفيذ العملية. حاول مرة أخرى.",
          layout: "inline",
          dismissible: true,
          lifecycle: "manual",
        },
        { channel: feedbackChannel, placement: "inline", reveal: true },
      );
      return false;
    }
  }

  async function runVisibilityMutation(
    row: BlockModuleRow,
    nextStatus: "published" | "unpublished",
  ) {
    const successMessage =
      nextStatus === "published" ? "تم نشر البلوك." : "تم إخفاء البلوك.";
    clearFeedback(feedbackChannel);
    try {
      await instant.mutateAsync({
        rowId: row.id,
        action: "visibility",
        optimistic: (cache) =>
          cache.patchRows((candidate) =>
            candidate.id === row.id
              ? { ...candidate, status: nextStatus }
              : candidate,
          ),
        execute: async () => {
          await toggleAction(
            mutationFormData({ id: row.id, next_status: nextStatus }),
          );
          return { ok: true, message: successMessage };
        },
      });
      publishFeedback(
        {
          variant: "success",
          title: "تم تنفيذ الإجراء",
          message: successMessage,
          layout: "inline",
          dismissible: true,
          lifecycle: "manual",
        },
        { channel: feedbackChannel, placement: "inline" },
      );
    } catch (error) {
      publishFeedback(
        {
          variant: "danger",
          title: "تعذر تنفيذ الإجراء",
          message:
            error instanceof Error
              ? error.message
              : "تعذر تنفيذ العملية. حاول مرة أخرى.",
          layout: "inline",
          dismissible: true,
          lifecycle: "manual",
        },
        { channel: feedbackChannel, placement: "inline", reveal: true },
      );
    }
  }

  function requestCreateClose() {
    createRuntimeRef.current?.requestClose();
  }

  return (
    <AdminPageExperience dir="rtl">
      <AdminPageContextHeader
        eyebrow="إدارة الموديولات"
        title={moduleTitle}
        description={moduleDescription}
        actions={
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            disabled={Boolean(loadError)}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl bg-[#D8B87A] px-5 text-sm font-bold text-[#06101C] transition hover:bg-[#e5c98d]"
          >
            <PlusIcon />
            إضافة بلوك
          </button>
        }
      />

      <AdminFeedbackRegion
        channel={feedbackChannel}
        label={`نتائج إجراءات ${moduleTitle}`}
        placement="global"
        feedback={loadFeedback}
      />

      <AdminFeedbackRegion
        channel={`${feedbackChannel}:columns`}
        label={`حالة تفضيلات أعمدة ${moduleTitle}`}
        feedback={
          preferenceError
            ? {
                variant: "warning",
                title: "تعذر تحميل تفضيلات الأعمدة",
                message: preferenceError,
                layout: "inline",
                dismissible: true,
                lifecycle: "persistent",
              }
            : null
        }
      />

      {mediaWarningNotice}

      <AdminEntityListFilters
        basePath={`/admin/pages-blocks/blocks/${moduleKey}`}
        search={{
          value: search,
          placeholder: blockSearchPlaceholder(
            technicalIdentityMode,
            variantFieldMode,
          ),
          minLength: 1,
        }}
        filters={[]}
        values={{}}
        columnsControl={
          <AdminColumnVisibilityMenu
            columns={columnConfig.columns}
            visibleColumns={visibleColumns}
            defaultColumns={defaultColumns}
            onChange={setVisibleColumns}
            onPersist={(next) =>
              savePageCompositionColumnPreferences(columnPreferenceId, next)
            }
            onRestore={() =>
              restorePageCompositionColumnPreferences(columnPreferenceId)
            }
          />
        }
        contextOverrideActive={selection.selectedIds.length > 0}
        contextOverride={
          <AdminBulkActionBar
            selectedIds={selection.selectedIds}
            entityLabel="بلوك"
            options={[
              {
                value: "publish",
                label: ADMIN_BULK_ACTION_LABELS.showSelected,
              },
              {
                value: "hide",
                label: ADMIN_BULK_ACTION_LABELS.hideSelected,
              },
              {
                value: "delete",
                label: ADMIN_BULK_ACTION_LABELS.deleteSelected,
              },
            ]}
            onClearSelection={selection.clearSelection}
            isBusy={instant.bulkInteraction.isBlocked}
            onExecute={async (action, ids) => {
              const formData = new FormData();
              formData.set("bulk_action", action);
              ids.forEach((id) => formData.append("ids", String(id)));
              const succeeded = await runMutation(
                null,
                "bulk",
                () => bulkAction(formData),
                "تم تنفيذ الإجراء الجماعي على البلوكات المحددة.",
              );
              if (!succeeded) {
                if (action === "delete")
                  throw new Error("bulk block delete failed");
                return;
              }
              selection.clearSelection();
            }}
          />
        }
        onQueryPatch={pagination.applyQueryPatch}
      />

      <AdminDataGrid className="!rounded-t-none !border-t-0">
        <AdminDataGridHeader columns={gridColumns}>
          <AdminDataGridCheckboxCell>
            <AdminDataGridCheckbox
              checked={selection.allSelected}
              onChange={(event) => selection.toggleAll(event.target.checked)}
              inputRef={selection.selectAllRef}
              label="تحديد الكل"
            />
          </AdminDataGridCheckboxCell>
          <AdminDataGridPrimaryCell>
            <AdminDataGridSortLabel
              active={table.sort.key === "name"}
              direction={table.sort.direction}
              onClick={() => {
                pagination.resetPage();
                table.toggleSort("name");
              }}
              className="justify-end"
            >
              الاسم
            </AdminDataGridSortLabel>
          </AdminDataGridPrimaryCell>
          {visibleColumnSet.has("slug") ? (
            <AdminDataGridCenterCell>
              <AdminDataGridSortLabel
                active={table.sort.key === "slug"}
                direction={table.sort.direction}
                onClick={() => {
                  pagination.resetPage();
                  table.toggleSort("slug");
                }}
              >
                المعرّف
              </AdminDataGridSortLabel>
            </AdminDataGridCenterCell>
          ) : null}
          {visibleColumnSet.has("variant") ? (
            <AdminDataGridCenterCell>
              <AdminDataGridSortLabel
                active={table.sort.key === "variant"}
                direction={table.sort.direction}
                onClick={() => {
                  pagination.resetPage();
                  table.toggleSort("variant");
                }}
              >
                النمط
              </AdminDataGridSortLabel>
            </AdminDataGridCenterCell>
          ) : null}
          {visibleColumnSet.has("status") ? (
            <AdminDataGridCenterCell>
              <AdminDataGridSortLabel
                active={table.sort.key === "status"}
                direction={table.sort.direction}
                onClick={() => {
                  pagination.resetPage();
                  table.toggleSort("status");
                }}
              >
                الحالة
              </AdminDataGridSortLabel>
            </AdminDataGridCenterCell>
          ) : null}
          <div className="text-center">الإجراءات</div>
        </AdminDataGridHeader>

        {paginatedRows.map((row) => {
          const status = statusMeta(row.status);
          const nextStatus =
            row.status === "published" ? "unpublished" : "published";
          const hidden = { access: "hidden" as const };
          const interaction = instant.getRowInteraction(row.id);
          const pendingAction = interaction.pendingAction;
          const visibilityPending = pendingAction === "visibility";
          const capability: AdminRowActionsCapability = {
            entityType: `${moduleKey}_block_template`,
            entityId: row.id,
            entityLabel: row.name,
            actions: {
              edit: {
                access: "allowed",
                href: `/admin/pages-blocks/blocks/${moduleKey}/${row.id}`,
              },
              preview: {
                access: "disabled",
                disabledReason: "المعاينة العامة تتطلب ربط القالب بصفحة عامة.",
              },
              information: {
                access: "allowed",
                title: `معلومات ${row.name}`,
                items: [
                  ...(technicalIdentityMode === "editable"
                    ? [{ label: "المعرّف", value: row.slug ?? "" }]
                    : []),
                  ...(variantFieldMode === "editable"
                    ? [{
                        label: "النمط",
                        value: variantLabelByValue.get(row.variant ?? "") ?? row.variant ?? "",
                      }]
                    : []),
                  { label: "الحالة", value: status.label },
                ],
              },
              copyPublicLink: hidden,
              visibility: visibilityPending
                ? {
                    access: "disabled",
                    disabledReason: "انتظر انتهاء الإجراء الحالي.",
                    pending: true,
                    isVisible: row.status === "published",
                  }
                : {
                    access: "allowed",
                    isVisible: row.status === "published",
                    onSelect: () => runVisibilityMutation(row, nextStatus),
                  },
              featured: hidden,
              duplicate: {
                access: "allowed",
                pending: pendingAction === "duplicate",
                onSelect: async () => {
                  await runMutation(
                    row.id,
                    "duplicate",
                    () => duplicateAction(mutationFormData({ id: row.id })),
                    "تم إنشاء نسخة من البلوك.",
                  );
                },
              },
              archive: hidden,
              delete: {
                access: "allowed",
                pending: pendingAction === "delete",
                onSelect: async () => {
                  const succeeded = await runMutation(
                    row.id,
                    "delete",
                    () => deleteAction(mutationFormData({ id: row.id })),
                    "تم حذف البلوك.",
                  );
                  if (!succeeded) throw new Error("block delete failed");
                },
                confirmation: {
                  mode: "shared",
                  title: "تأكيد حذف البلوك",
                  description: `حذف البلوك «${row.name}» نهائيًا؟`,
                  confirmLabel: "حذف البلوك",
                },
              },
            },
          };

          return (
            <AdminDataGridRow
              key={row.id}
              columns={gridColumns}
              className="border-b border-white/8 last:border-b-0"
            >
              <AdminDataGridCheckboxCell>
                <AdminDataGridCheckbox
                  checked={selection.selectedSet.has(row.id)}
                  onChange={(event) =>
                    selection.toggleOne(row.id, event.target.checked)
                  }
                  label={`تحديد ${row.name}`}
                />
              </AdminDataGridCheckboxCell>

              <AdminDataGridPrimaryCell>
                <Link
                  href={`/admin/pages-blocks/blocks/${moduleKey}/${row.id}`}
                  className="font-semibold text-white transition hover:text-[#D8B87A]"
                >
                  {row.name}
                </Link>
                {row.description ? (
                  <p className="mt-1 line-clamp-1 text-xs text-white/36">
                    {row.description}
                  </p>
                ) : null}
              </AdminDataGridPrimaryCell>

              {visibleColumnSet.has("slug") ? (
                <AdminDataGridCenterCell>
                  <Link
                    href={`/admin/pages-blocks/blocks/${moduleKey}/${row.id}`}
                    className="font-en text-xs text-[#D8B87A]/78 transition hover:text-[#D8B87A]"
                  >
                    {row.slug ?? ""}
                  </Link>
                </AdminDataGridCenterCell>
              ) : null}

              {visibleColumnSet.has("variant") ? (
                <AdminDataGridCenterCell className="text-white/58">
                  {variantLabelByValue.get(row.variant ?? "") ?? row.variant ?? ""}
                </AdminDataGridCenterCell>
              ) : null}

              {visibleColumnSet.has("status") ? (
                <AdminDataGridStatusCell>
                  <AdminDataGridRowActions
                    capability={capability}
                    display="visibility"
                    size="compact"
                  />
                </AdminDataGridStatusCell>
              ) : null}

              <AdminDataGridRowActions capability={capability} size="compact" />
            </AdminDataGridRow>
          );
        })}

        {!pagination.totalCount ? (
          <AdminDataGridEmpty>لا توجد بلوكات مطابقة.</AdminDataGridEmpty>
        ) : null}
      </AdminDataGrid>

      <AdminTablePagination
        basePath={`/admin/pages-blocks/blocks/${moduleKey}`}
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        totalCount={pagination.totalCount}
        pageSize={String(pagination.pageSize)}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />

      <VenesiaModal
        open={showCreateModal}
        title="إضافة بلوك جديد"
        description="أنشئ القالب ثم عدّل المحتوى واربطه بالصفحات. البلوكات الجديدة تُنشأ كغير منشورة."
        size="md"
        onClose={requestCreateClose}
      >
        <AdminFormRuntime
          action={createAction}
          mode="create"
          entityKey={`${moduleKey}-block-quick-create`}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => setShowCreateModal(false)}
          runtimeRef={createRuntimeRef}
          formId={`create-${moduleKey}-block-form`}
          className={ADMIN_FORM.grid}
        >
          {({ fieldErrors, pending, requestClose }) => (
            <>
              <AdminFormError />
              <label className={adminFormLabelClassName()}>
                الاسم
                <input
                  name="name"
                  required
                  className={adminFormFieldClassName(
                    fieldErrors.name?.length ? "border-red-400/40" : "",
                  )}
                  aria-invalid={Boolean(fieldErrors.name?.length)}
                  aria-describedby={
                    fieldErrors.name?.length ? "name-error" : undefined
                  }
                />
                <AdminFormError name="name" />
              </label>
              {technicalIdentityMode === "editable" ? (
                <label className={adminFormLabelClassName()}>
                  المعرّف التقني
                  <input
                    name="slug"
                    dir="ltr"
                    placeholder={`${moduleKey}-example`}
                    className={adminFormFieldClassName(
                      `text-left font-en ${fieldErrors.slug?.length ? "border-red-400/40" : ""}`,
                    )}
                    aria-invalid={Boolean(fieldErrors.slug?.length)}
                    aria-describedby={
                      fieldErrors.slug?.length ? "slug-error" : undefined
                    }
                  />
                  <AdminFormError name="slug" />
                </label>
              ) : null}
              {variantFieldMode === "editable" ? (
                <AdminFormListboxSelect
                  name={moduleKey === "feed" ? "feed_type" : "variant"}
                  label={moduleKey === "feed" ? "نوع موديول المحتوى" : "النمط"}
                  defaultValue={defaultVariant}
                  options={variantOptions.map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              ) : (
                <input type="hidden" name="variant" value={defaultVariant} />
              )}
              {moduleKey === "feed" ? (
                <>
                  <label className={adminFormLabelClassName()}>
                    {MODULE_EDITOR_TERMINOLOGY.sectionTitle.labelAr}
                    <input
                      name="widget_title"
                      required
                      placeholder="أحدث الموضوعات"
                      className={adminFormFieldClassName(
                        fieldErrors.widget_title?.length
                          ? "border-red-400/40"
                          : "",
                      )}
                      aria-invalid={Boolean(fieldErrors.widget_title?.length)}
                      aria-describedby={
                        fieldErrors.widget_title?.length
                          ? "widget_title-error"
                          : undefined
                      }
                    />
                    <AdminFormError name="widget_title" />
                  </label>
                  <label className={adminFormLabelClassName()}>
                    عدد النتائج
                    <input
                      name="limit"
                      type="number"
                      min={1}
                      defaultValue={3}
                      className={adminFormFieldClassName(
                        fieldErrors.limit?.length ? "border-red-400/40" : "",
                      )}
                      aria-invalid={Boolean(fieldErrors.limit?.length)}
                      aria-describedby={
                        fieldErrors.limit?.length ? "limit-error" : undefined
                      }
                    />
                    <AdminFormError name="limit" />
                  </label>
                </>
              ) : null}
              <input type="hidden" name="status" value="unpublished" />
              <input type="hidden" name="style_preset" value="premium-dark" />
              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <AdminModalCancelButton
                  onClick={requestClose}
                  disabled={pending}
                >
                  إلغاء
                </AdminModalCancelButton>
                <AdminModalPrimaryButton type="submit" disabled={pending}>
                  {pending ? "جار الإنشاء..." : "إنشاء وفتح"}
                </AdminModalPrimaryButton>
              </div>
            </>
          )}
        </AdminFormRuntime>
      </VenesiaModal>
    </AdminPageExperience>
  );
}
