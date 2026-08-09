"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PlusIcon } from "../../../../../components/admin/AdminRowActions";
import AdminEntityListFilters from "../../../../../components/admin/entity-list/AdminEntityListFilters";
import {
  AdminFeedbackRegion,
  useAdminFeedback,
} from "../../../../../components/admin/AdminFeedbackProvider";
import MediaSynchronizationWarningNotice from "../../../../../components/admin/media/MediaSynchronizationWarningNotice";
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
  AdminFormRuntime,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  AdminPageExperience,
  AdminPageHeader,
  AdminTablePagination,
  VenesiaModal,
  adminFormFieldClassName,
  adminFormLabelClassName,
  type AdminRowActionsCapability,
  useAdminGridSelection,
} from "../../../../../components/admin/ui";
import type { AdminFormRuntimeHandle } from "../../../../../components/admin/ui/AdminFormRuntime";
import { useAdminTable } from "../../../../../components/admin/table-engine";
import {
  adminCollectionSearchIncludes,
  applyAdminEntityUrlPatch,
  useAdminBoundedClientPagination,
  type AdminEntityFilterDef,
} from "../../../../../lib/admin/entity-list";
import { ADMIN_BULK_ACTION_LABELS } from "../../../../../lib/admin/entity-list/bulk-action-labels";
import { useAdminBoundedClientInstantMutation } from "../../../../../lib/admin/entity-list/data-engine/instant-mutation";
import {
  getPageCompositionColumnPreferenceConfig,
  getPageCompositionDefaultColumnKeys,
  normalizePageCompositionVisibleColumnKeys,
} from "../../../../../lib/page-blocks/admin-collection-columns";
import { statusMeta } from "../../../../../lib/page-blocks/admin-utils";
import { formatAdminDateTime } from "../../../../../lib/content-dates";
import {
  restorePageCompositionColumnPreferences,
  savePageCompositionColumnPreferences,
} from "../../column-preferences";
import {
  bulkContentBlocks,
  createContentBlock,
  deleteContentBlock,
  duplicateContentBlock,
  getContentBlockRows,
  toggleContentBlockStatus,
  type ContentBlockRow,
} from "./actions";

const MODULE_PATH = "/admin/pages-blocks/blocks/content";

const VARIANT_OPTIONS: Array<[string, string]> = [
  ["default", "Default"],
  ["split-image-right", "Split Image Right"],
  ["quote-emphasis", "Quote Emphasis"],
];

type ContentSortKey = "name" | "slug" | "variant" | "status" | "updated_at";

/**
 * RTL table: الاسم (1fr, يمين) → … → الإجراءات (ثابت، شمال).
 */
const PAGE_SIZE = Number(ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE);

type ContentBlocksTableClientProps = {
  rows: ContentBlockRow[];
  loadError?: string | null;
  mediaSynchronizationWarning?: boolean;
  initialVisibleColumns?: readonly string[] | null;
  preferenceError?: string | null;
};

function variantLabel(variant: string) {
  return VARIANT_OPTIONS.find(([value]) => value === variant)?.[1] ?? variant;
}

export default function ContentBlocksTableClient({
  rows,
  loadError = null,
  mediaSynchronizationWarning = false,
  initialVisibleColumns = null,
  preferenceError = null,
}: ContentBlocksTableClientProps) {
  const feedbackChannel = "block-manager:content";
  const searchParams = useSearchParams();
  const { publishFeedback, clearFeedback } = useAdminFeedback();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const createRuntimeRef = useRef<AdminFormRuntimeHandle>(null);
  const columnConfig = getPageCompositionColumnPreferenceConfig("contentTemplates");
  const defaultColumns = getPageCompositionDefaultColumnKeys("contentTemplates");
  const [visibleColumns, setVisibleColumns] = useState(() =>
    normalizePageCompositionVisibleColumnKeys(
      "contentTemplates",
      initialVisibleColumns,
    ),
  );
  const visibleColumnSet = useMemo(
    () => new Set(visibleColumns),
    [visibleColumns],
  );
  const columns = useMemo(
    () =>
      [
        ADMIN_DATA_GRID_COLUMNS.checkbox,
        ADMIN_DATA_GRID_COLUMNS.primaryCompact,
        visibleColumnSet.has("slug") ? ADMIN_DATA_GRID_COLUMNS.slugCompact : null,
        visibleColumnSet.has("variant") ? "96px" : null,
        visibleColumnSet.has("status") ? ADMIN_DATA_GRID_COLUMNS.statusStandard : null,
        visibleColumnSet.has("updatedAt") ? "120px" : null,
        ADMIN_DATA_GRID_ACTION_COLUMNS.threeCompact,
      ]
        .filter((column) => column !== null)
        .join(" "),
    [visibleColumnSet],
  );

  const sortAccessors = useMemo(
    () => ({
      name: (item: ContentBlockRow) => item.name,
      slug: (item: ContentBlockRow) => item.slug,
      variant: (item: ContentBlockRow) => variantLabel(item.variant),
      status: (item: ContentBlockRow) => statusMeta(item.status).label,
      updated_at: (item: ContentBlockRow) => item.updated_at,
    }),
    [],
  );

  const instant = useAdminBoundedClientInstantMutation<ContentBlockRow>({
    entity: "content-block-templates",
    initialRows: rows,
  });
  const table = useAdminTable<ContentBlockRow, ContentSortKey>({
    initialRows: instant.rows,
    getRowId: (item) => item.id,
    sortAccessors,
    refresh: getContentBlockRows,
  });
  const setTableRows = table.setRows;
  useEffect(() => {
    setTableRows(instant.rows);
  }, [instant.rows, setTableRows]);
  const search = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "all";
  const variant = searchParams.get("variant") ?? "all";
  const filters = useMemo<readonly AdminEntityFilterDef[]>(() => [
    {
      id: "content-blocks-status",
      paramKey: "status",
      label: "الحالة",
      type: "status",
      allValue: "all",
      placeholder: "الحالة",
      options: [...new Set(rows.map((row) => row.status))].map((value) => ({
        value,
        label: statusMeta(value).label,
      })),
    },
    {
      id: "content-blocks-variant",
      paramKey: "variant",
      label: "Variant",
      type: "single_select",
      allValue: "all",
      placeholder: "Variant",
      options: VARIANT_OPTIONS.map(([value, label]) => ({ value, label })),
    },
  ], [rows]);
  const filteredRows = useMemo(
    () => table.rows.filter((row) => {
      if (
        search &&
        !adminCollectionSearchIncludes(
          `${row.name} ${row.slug} ${row.description ?? ""}`,
          search,
        )
      ) return false;
      if (status !== "all" && row.status !== status) return false;
      return variant === "all" || row.variant === variant;
    }),
    [search, status, table.rows, variant],
  );
  const pagination = useAdminBoundedClientPagination({
    rows: filteredRows,
    datasetKey: `${search}|${status}|${variant}|${filteredRows.map((row) => row.id).sort().join("|")}`,
    defaultPageSize: PAGE_SIZE,
  });
  const paginatedRows = pagination.rows;
  const visibleIds = useMemo(() => paginatedRows.map((row) => row.id), [paginatedRows]);
  const selection = useAdminGridSelection<number>(visibleIds);
  const loadFeedback = useMemo(
    () =>
      loadError
        ? {
            variant: "danger" as const,
            title: "تعذر تحميل مكتبة بلوكات المحتوى",
            message: loadError,
            layout: "inline" as const,
            dismissible: true,
            lifecycle: "persistent" as const,
          }
        : null,
    [loadError],
  );
  const mediaWarningNotice = useMemo(
    () => <MediaSynchronizationWarningNotice visible={mediaSynchronizationWarning} />,
    [mediaSynchronizationWarning],
  );

  async function runRowMutation(
    action: () => Promise<void>,
    successMessage: string,
  ) {
    clearFeedback(feedbackChannel);
    const result = await table.runAction(async () => {
      await action();
      const nextRows = await getContentBlockRows();
      instant.hydrateRows(nextRows);
      return { ok: true, message: successMessage, rows: nextRows };
    });
    publishFeedback(
      {
        variant: result.ok ? "success" : "danger",
        title: result.ok ? "تم تنفيذ الإجراء" : "تعذر تنفيذ الإجراء",
        message: result.message ?? (result.ok ? successMessage : "تعذر تنفيذ العملية. حاول مرة أخرى."),
        layout: "inline",
        dismissible: true,
        lifecycle: "manual",
      },
      {
        channel: feedbackChannel,
        placement: "inline",
        reveal: !result.ok,
      },
    );
  }

  async function runVisibilityMutation(
    row: ContentBlockRow,
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
          const formData = new FormData();
          formData.set("id", String(row.id));
          formData.set("next_status", nextStatus);
          await toggleContentBlockStatus(formData);
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

  function sortProps(key: ContentSortKey) {
    return {
      active: table.sort.key === key,
      direction: table.sort.direction,
      onClick: () => table.toggleSort(key),
    } as const;
  }

  function requestCreateClose() {
    createRuntimeRef.current?.requestClose();
  }

  return (
    <AdminPageExperience dir="rtl">
      <AdminPageHeader
        eyebrow="Admin Panel"
        title="إدارة بلوكات المحتوى"
        description="قوالب المحتوى النصي القابلة لإعادة الاستخدام. اربطها بالصفحات من Pages Manager."
        actions={(
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            disabled={Boolean(loadError)}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl bg-[#D8B87A] px-5 text-sm font-bold text-[#06101C] transition hover:bg-[#e5c98d]"
          >
            <PlusIcon />
            إضافة بلوك
          </button>
        )}
      />

      <div className="space-y-4">
        <AdminFeedbackRegion
          channel={feedbackChannel}
          label="نتائج إجراءات بلوكات المحتوى"
          feedback={loadFeedback}
        />

        <AdminFeedbackRegion
          channel={`${feedbackChannel}:columns`}
          label="حالة تفضيلات أعمدة بلوكات المحتوى"
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
          basePath={MODULE_PATH}
          search={{ value: search, placeholder: "ابحث باسم البلوك أو المعرّف الداخلي…", minLength: 1, pending: table.isPending }}
          filters={filters}
          values={{ status, variant }}
          columnsControl={
            <AdminColumnVisibilityMenu
              columns={columnConfig.columns}
              visibleColumns={visibleColumns}
              defaultColumns={defaultColumns}
              onChange={setVisibleColumns}
              onPersist={(next) =>
                savePageCompositionColumnPreferences(
                  "contentTemplates",
                  next,
                )
              }
              onRestore={() =>
                restorePageCompositionColumnPreferences("contentTemplates")
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
              isBusy={
                table.isPending ||
                instant.rowPending !== null ||
                instant.bulkPending !== null
              }
              onExecute={async (action, ids) => {
                clearFeedback(feedbackChannel);
                const result = await table.runAction(async () => {
                  const formData = new FormData();
                  formData.set("bulk_action", action);
                  ids.forEach((id) => formData.append("ids", String(id)));
                  await bulkContentBlocks(formData);
                  const nextRows = await getContentBlockRows();
                  instant.hydrateRows(nextRows);
                  return { ok: true, message: "تم تنفيذ العملية الجماعية بنجاح.", rows: nextRows };
                });
                publishFeedback(
                  {
                    variant: result.ok ? "success" : "danger",
                    title: result.ok ? "تم تنفيذ الإجراء" : "تعذر تنفيذ الإجراء",
                    message: result.message ?? (result.ok ? "تم تنفيذ العملية بنجاح." : "تعذر تنفيذ العملية."),
                    layout: "inline",
                    dismissible: true,
                    lifecycle: "manual",
                  },
                  { channel: feedbackChannel, placement: "inline", reveal: !result.ok },
                );
                if (!result.ok && action === "delete") throw new Error(result.message ?? "bulk delete failed");
                selection.clearSelection();
              }}
            />
          }
          onQueryPatch={(patch, behavior = "push") => {
            const next = applyAdminEntityUrlPatch(new URLSearchParams(window.location.search), patch);
            const query = next.toString();
            window.history[behavior === "replace" ? "replaceState" : "pushState"](
              window.history.state,
              "",
              `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
            );
          }}
        />

        <AdminDataGrid className="!rounded-t-none !border-t-0">
          <AdminDataGridHeader columns={columns}>
            <AdminDataGridCheckboxCell>
              <AdminDataGridCheckbox
                inputRef={selection.selectAllRef}
                checked={selection.allSelected}
                onChange={(event) => selection.toggleAll(event.currentTarget.checked)}
                label="تحديد الكل"
              />
            </AdminDataGridCheckboxCell>
            <AdminDataGridPrimaryCell>
              <AdminDataGridSortLabel {...sortProps("name")} className="justify-end">
                الاسم
              </AdminDataGridSortLabel>
            </AdminDataGridPrimaryCell>
            {visibleColumnSet.has("slug") ? (
              <AdminDataGridCenterCell>
                <AdminDataGridSortLabel {...sortProps("slug")} className="justify-center">
                  Slug
                </AdminDataGridSortLabel>
              </AdminDataGridCenterCell>
            ) : null}
            {visibleColumnSet.has("variant") ? (
              <AdminDataGridCenterCell>
                <AdminDataGridSortLabel {...sortProps("variant")} className="justify-center">
                  Variant
                </AdminDataGridSortLabel>
              </AdminDataGridCenterCell>
            ) : null}
            {visibleColumnSet.has("status") ? (
              <AdminDataGridCenterCell>
                <AdminDataGridSortLabel {...sortProps("status")} className="justify-center">
                  الحالة
                </AdminDataGridSortLabel>
              </AdminDataGridCenterCell>
            ) : null}
            {visibleColumnSet.has("updatedAt") ? (
              <AdminDataGridCenterCell>
                <AdminDataGridSortLabel {...sortProps("updated_at")} className="justify-center">
                  التحديث
                </AdminDataGridSortLabel>
              </AdminDataGridCenterCell>
            ) : null}
            <div className="text-center">الإجراءات</div>
          </AdminDataGridHeader>

          {paginatedRows.length ? (
            paginatedRows.map((row) => {
              const status = statusMeta(row.status);
              const nextStatus = row.status === "published" ? "unpublished" : "published";
              const isPublished = row.status === "published";
              const hidden = { access: "hidden" as const };
              const visibilityPending =
                instant.rowPending?.rowId === row.id &&
                instant.rowPending.action === "visibility";
              const mutationBusy =
                table.isPending ||
                instant.rowPending !== null ||
                instant.bulkPending !== null;
              const capability: AdminRowActionsCapability = {
                entityType: "content_block_template",
                entityId: row.id,
                entityLabel: row.name,
                actions: {
                  edit: { access: "allowed", href: `${MODULE_PATH}/${row.id}` },
                  preview: {
                    access: "disabled",
                    disabledReason: "المعاينة العامة تتطلب ربط القالب بصفحة عامة.",
                  },
                  information: {
                    access: "allowed",
                    title: `معلومات ${row.name}`,
                    items: [
                      { label: "Slug", value: row.slug },
                      { label: "Variant", value: variantLabel(row.variant) },
                      { label: "الحالة", value: status.label },
                      { label: "آخر تحديث", value: formatAdminDateTime(row.updated_at) },
                    ],
                  },
                  copyPublicLink: hidden,
                  visibility: visibilityPending
                    ? {
                        access: "disabled",
                        disabledReason: "انتظر انتهاء الإجراء الحالي.",
                        pending: true,
                        isVisible: isPublished,
                      }
                    : mutationBusy
                      ? {
                          access: "disabled",
                          disabledReason: "انتظر انتهاء الإجراء الحالي.",
                          isVisible: isPublished,
                        }
                      : {
                          access: "allowed",
                          isVisible: isPublished,
                          onSelect: () =>
                            runVisibilityMutation(row, nextStatus),
                        },
                  featured: hidden,
                  duplicate:
                    mutationBusy && !table.isPending
                      ? {
                          access: "disabled",
                          disabledReason: "انتظر انتهاء الإجراء الحالي.",
                        }
                      : {
                          access: "allowed",
                          pending: table.isPending,
                          onSelect: () =>
                            runRowMutation(async () => {
                              const formData = new FormData();
                              formData.set("id", String(row.id));
                              await duplicateContentBlock(formData);
                            }, "تم إنشاء نسخة من البلوك."),
                        },
                  archive: hidden,
                  delete:
                    mutationBusy && !table.isPending
                      ? {
                          access: "disabled",
                          disabledReason: "انتظر انتهاء الإجراء الحالي.",
                        }
                      : {
                          access: "allowed",
                          pending: table.isPending,
                          onSelect: () =>
                            runRowMutation(async () => {
                              const formData = new FormData();
                              formData.set("id", String(row.id));
                              await deleteContentBlock(formData);
                            }, "تم حذف البلوك."),
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
                <AdminDataGridRow key={row.id} columns={columns}>
                  <AdminDataGridCheckboxCell>
                    <AdminDataGridCheckbox
                      checked={selection.selectedSet.has(row.id)}
                      onChange={(event) => selection.toggleOne(row.id, event.currentTarget.checked)}
                      label={`تحديد ${row.name}`}
                    />
                  </AdminDataGridCheckboxCell>

                  <AdminDataGridPrimaryCell>
                    <Link
                      href={`${MODULE_PATH}/${row.id}`}
                      className="block truncate font-semibold text-white transition hover:text-[#D8B87A]"
                    >
                      {row.name}
                    </Link>
                    {row.description ? (
                      <p className="mt-1 truncate text-xs text-white/36">{row.description}</p>
                    ) : null}
                  </AdminDataGridPrimaryCell>

                  {visibleColumnSet.has("slug") ? (
                    <AdminDataGridCenterCell>
                      <span className="font-en block truncate text-xs text-white/42">{row.slug}</span>
                    </AdminDataGridCenterCell>
                  ) : null}

                  {visibleColumnSet.has("variant") ? (
                    <AdminDataGridCenterCell className="truncate text-sm text-white/55">{variantLabel(row.variant)}</AdminDataGridCenterCell>
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

                  {visibleColumnSet.has("updatedAt") ? (
                    <AdminDataGridCenterCell className="font-en text-xs tabular-nums text-white/55">
                      {formatAdminDateTime(row.updated_at)}
                    </AdminDataGridCenterCell>
                  ) : null}

                  <AdminDataGridRowActions capability={capability} size="compact" />
                </AdminDataGridRow>
              );
            })
          ) : (
            <AdminDataGridEmpty>لا توجد بلوكات بعد.</AdminDataGridEmpty>
          )}
        </AdminDataGrid>

        <AdminTablePagination
          basePath={MODULE_PATH}
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalCount={pagination.totalCount}
          pageSize={String(pagination.pageSize)}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          pending={table.isPending}
        />
      </div>

      <VenesiaModal
        open={showCreateModal}
        title="إضافة بلوك جديد"
        description="أنشئ القالب ثم عدّل المحتوى واربطه بالصفحات. البلوكات الجديدة تُنشأ كغير منشورة."
        size="md"
        onClose={requestCreateClose}
      >
        <AdminFormRuntime
          action={createContentBlock}
          mode="create"
          entityKey="content-block-quick-create"
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => setShowCreateModal(false)}
          runtimeRef={createRuntimeRef}
          formId="create-content-block-form"
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
                  aria-describedby={fieldErrors.name?.length ? "name-error" : undefined}
                />
                <AdminFormError name="name" />
              </label>
              <label className={adminFormLabelClassName()}>
                Slug
                <input
                  name="slug"
                  dir="ltr"
                  placeholder="content-example"
                  className={adminFormFieldClassName(
                    `text-left font-en ${fieldErrors.slug?.length ? "border-red-400/40" : ""}`,
                  )}
                  aria-invalid={Boolean(fieldErrors.slug?.length)}
                  aria-describedby={fieldErrors.slug?.length ? "slug-error" : undefined}
                />
                <AdminFormError name="slug" />
              </label>
              <label className={adminFormLabelClassName()}>
                Variant
                <select name="variant" defaultValue="default" className={adminFormFieldClassName()}>
                  {VARIANT_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <input type="hidden" name="status" value="unpublished" />
              <input type="hidden" name="style_preset" value="premium-dark" />
              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <AdminModalCancelButton onClick={requestClose} disabled={pending}>
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
