"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
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
  AdminDataGridStatusCell,
  AdminFormError,
  AdminFormRuntime,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  AdminPageExperience,
  AdminPageHeader,
  AdminStatusPill,
  AdminTablePagination,
  VenesiaModal,
  adminFormFieldClassName,
  adminFormLabelClassName,
  type AdminRowActionsCapability,
  useAdminGridSelection,
} from "../ui";
import type { AdminFormRuntimeHandle } from "../ui/AdminFormRuntime";
import { PlusIcon } from "../AdminRowActions";
import type { AdminFormAction } from "../../../lib/admin/form-runtime";
import { MODULE_EDITOR_TERMINOLOGY } from "../../../lib/page-blocks/module-editor-presentation-contract";
import {
  adminCollectionSearchIncludes,
  applyAdminEntityUrlPatch,
  useAdminBoundedClientPagination,
} from "../../../lib/admin/entity-list";
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
  slug: string;
  description: string | null;
  variant: string;
  status: string;
};

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
  loadError = null,
  mediaSynchronizationWarning = false,
  initialVisibleColumns = null,
  preferenceError = null,
}: BlockModuleManagerClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const feedbackChannel = `block-manager:${moduleKey}`;
  const { publishFeedback, clearFeedback } = useAdminFeedback();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const createRuntimeRef = useRef<AdminFormRuntimeHandle>(null);
  const [pendingRowId, setPendingRowId] = useState<number | null>(null);
  const [isRefreshPending, startRefreshTransition] = useTransition();
  const columnPreferenceId = COLUMN_PREFERENCE_ID_BY_MODULE[moduleKey];
  const columnConfig = getPageCompositionColumnPreferenceConfig(columnPreferenceId);
  const defaultColumns = getPageCompositionDefaultColumnKeys(columnPreferenceId);
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
        visibleColumnSet.has("status") ? ADMIN_DATA_GRID_COLUMNS.statusStandard : null,
        ADMIN_DATA_GRID_ACTION_COLUMNS.threeCompact,
      ]
        .filter((column) => column !== null)
        .join(" "),
    [visibleColumnSet],
  );
  const search = searchParams.get("q") ?? "";
  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        adminCollectionSearchIncludes(
          `${row.name} ${row.slug} ${row.description ?? ""} ${row.variant}`,
          search,
        ),
      ),
    [rows, search],
  );
  const pagination = useAdminBoundedClientPagination({
    rows: filteredRows,
    datasetKey: `${moduleKey}|${search}|${filteredRows.map((row) => row.id).sort().join("|")}`,
    defaultPageSize: PAGE_SIZE,
  });
  const paginatedRows = pagination.rows;
  const visibleIds = useMemo(
    () => paginatedRows.map((row) => row.id),
    [paginatedRows],
  );
  const selection = useAdminGridSelection<number>(visibleIds);
  const isBusy = pendingRowId !== null || isRefreshPending;
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
    () => <MediaSynchronizationWarningNotice visible={mediaSynchronizationWarning} />,
    [mediaSynchronizationWarning],
  );

  async function runMutation(
    rowId: number | null,
    action: () => Promise<void>,
    successMessage: string,
  ): Promise<boolean> {
    clearFeedback(feedbackChannel);
    setPendingRowId(rowId ?? -1);
    try {
      await action();
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
      startRefreshTransition(() => router.refresh());
      return true;
    } catch (error) {
      publishFeedback(
        {
          variant: "danger",
          title: "تعذر تنفيذ الإجراء",
          message: error instanceof Error ? error.message : "تعذر تنفيذ العملية. حاول مرة أخرى.",
          layout: "inline",
          dismissible: true,
          lifecycle: "manual",
        },
        { channel: feedbackChannel, placement: "inline", reveal: true },
      );
      return false;
    } finally {
      setPendingRowId(null);
    }
  }

  function requestCreateClose() {
    createRuntimeRef.current?.requestClose();
  }

  return (
    <AdminPageExperience dir="rtl">
      <AdminPageHeader
        eyebrow="Admin Panel"
        title={moduleTitle}
        description={moduleDescription}
        meta={`${rows.length} بلوك`}
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

      <AdminFeedbackRegion
        channel={feedbackChannel}
        label={`نتائج إجراءات ${moduleTitle}`}
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
          placeholder: "ابحث باسم البلوك أو الـslug أو الـvariant…",
          minLength: 1,
          pending: isBusy,
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
              { value: "publish", label: "نشر" },
              { value: "hide", label: "إخفاء" },
              { value: "draft", label: "مسودة" },
              { value: "delete", label: "حذف" },
            ]}
            onClearSelection={selection.clearSelection}
            isBusy={isBusy}
            onExecute={async (action, ids) => {
              const formData = new FormData();
              formData.set("bulk_action", action);
              ids.forEach((id) => formData.append("ids", String(id)));
              const succeeded = await runMutation(null, () => bulkAction(formData), "تم تنفيذ الإجراء الجماعي على البلوكات المحددة.");
              if (!succeeded) {
                if (action === "delete") throw new Error("bulk block delete failed");
                return;
              }
              selection.clearSelection();
            }}
          />
        }
        onQueryPatch={(patch, behavior = "push") => {
          const next = applyAdminEntityUrlPatch(
            new URLSearchParams(window.location.search),
            patch,
          );
          const query = next.toString();
          window.history[
            behavior === "replace" ? "replaceState" : "pushState"
          ](
            window.history.state,
            "",
            `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
          );
        }}
      />

      <AdminDataGrid className="!rounded-t-none !border-t-0" summary={filteredRows.length ? `${filteredRows.length} بلوك` : undefined}>
        <AdminDataGridHeader columns={gridColumns}>
          <AdminDataGridCheckboxCell>
            <AdminDataGridCheckbox
              checked={selection.allSelected}
              onChange={(event) => selection.toggleAll(event.target.checked)}
              inputRef={selection.selectAllRef}
              label="تحديد الكل"
            />
          </AdminDataGridCheckboxCell>
          <AdminDataGridPrimaryCell>الاسم</AdminDataGridPrimaryCell>
          {visibleColumnSet.has("slug") ? (
            <AdminDataGridCenterCell>Slug</AdminDataGridCenterCell>
          ) : null}
          {visibleColumnSet.has("variant") ? (
            <AdminDataGridCenterCell>Variant</AdminDataGridCenterCell>
          ) : null}
          {visibleColumnSet.has("status") ? (
            <AdminDataGridCenterCell>الحالة</AdminDataGridCenterCell>
          ) : null}
          <div className="text-center">الإجراءات</div>
        </AdminDataGridHeader>

        {paginatedRows.map((row) => {
          const status = statusMeta(row.status);
          const nextStatus = row.status === "published" ? "unpublished" : "published";
          const hidden = { access: "hidden" as const };
          const rowPending = pendingRowId === row.id;
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
                  { label: "Slug", value: row.slug },
                  { label: "Variant", value: row.variant },
                  { label: "الحالة", value: status.label },
                ],
              },
              copyPublicLink: hidden,
              visibility: {
                access: "allowed",
                isVisible: row.status === "published",
                pending: rowPending,
                onSelect: async () => {
                  await runMutation(
                    row.id,
                    () => toggleAction(mutationFormData({ id: row.id, next_status: nextStatus })),
                    row.status === "published" ? "تم إخفاء البلوك." : "تم نشر البلوك.",
                  );
                },
              },
              featured: hidden,
              duplicate: {
                access: "allowed",
                pending: rowPending,
                onSelect: async () => {
                  await runMutation(
                    row.id,
                    () => duplicateAction(mutationFormData({ id: row.id })),
                    "تم إنشاء نسخة من البلوك.",
                  );
                },
              },
              archive: hidden,
              delete: {
                access: "allowed",
                pending: rowPending,
                onSelect: async () => {
                  const succeeded = await runMutation(
                    row.id,
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
            <AdminDataGridRow key={row.id} columns={gridColumns} className="border-b border-white/8 last:border-b-0">
              <AdminDataGridCheckboxCell>
                <AdminDataGridCheckbox
                  checked={selection.selectedSet.has(row.id)}
                  onChange={(event) => selection.toggleOne(row.id, event.target.checked)}
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
                {row.description ? <p className="mt-1 line-clamp-1 text-xs text-white/36">{row.description}</p> : null}
              </AdminDataGridPrimaryCell>

              {visibleColumnSet.has("slug") ? (
                <AdminDataGridCenterCell>
                  <Link
                    href={`/admin/pages-blocks/blocks/${moduleKey}/${row.id}`}
                    className="font-en text-xs text-[#D8B87A]/78 transition hover:text-[#D8B87A]"
                  >
                    {row.slug}
                  </Link>
                </AdminDataGridCenterCell>
              ) : null}

              {visibleColumnSet.has("variant") ? (
                <AdminDataGridCenterCell className="text-white/58">{row.variant}</AdminDataGridCenterCell>
              ) : null}

              {visibleColumnSet.has("status") ? (
                <AdminDataGridStatusCell className="flex-col gap-1">
                  <AdminStatusPill tone={status.tone}>{status.label}</AdminStatusPill>
                  {row.status !== "published" ? (
                    <p className="mt-1 text-[10px] leading-5 text-amber-200/75">غير منشور — لن يظهر على الصفحات العامة.</p>
                  ) : null}
                </AdminDataGridStatusCell>
              ) : null}

              <AdminDataGridRowActions capability={capability} size="compact" />
            </AdminDataGridRow>
          );
        })}

        {!filteredRows.length ? <AdminDataGridEmpty>لا توجد بلوكات مطابقة.</AdminDataGridEmpty> : null}
      </AdminDataGrid>

      <AdminTablePagination
        basePath={`/admin/pages-blocks/blocks/${moduleKey}`}
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        totalCount={pagination.totalCount}
        pageSize={String(pagination.pageSize)}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        pending={isBusy}
      />

      <VenesiaModal
        open={showCreateModal}
        title="إضافة بلوك جديد"
        description="أنشئ القالب ثم عدّل المحتوى واربطه بالصفحات. البلوكات الجديدة تُنشأ كمسودة."
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
                  aria-describedby={fieldErrors.name?.length ? "name-error" : undefined}
                />
                <AdminFormError name="name" />
              </label>
              <label className={adminFormLabelClassName()}>
                Slug
                <input
                  name="slug"
                  dir="ltr"
                  placeholder={`${moduleKey}-example`}
                  className={adminFormFieldClassName(
                    `text-left font-en ${fieldErrors.slug?.length ? "border-red-400/40" : ""}`,
                  )}
                  aria-invalid={Boolean(fieldErrors.slug?.length)}
                  aria-describedby={fieldErrors.slug?.length ? "slug-error" : undefined}
                />
                <AdminFormError name="slug" />
              </label>
              <label className={adminFormLabelClassName()}>
                {moduleKey === "feed" ? "Feed Type" : "Variant"}
                <select
                  name={moduleKey === "feed" ? "feed_type" : "variant"}
                  defaultValue={defaultVariant}
                  className={adminFormFieldClassName()}
                >
                  {variantOptions.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              {moduleKey === "feed" ? (
                <>
                  <label className={adminFormLabelClassName()}>
                    {MODULE_EDITOR_TERMINOLOGY.internalModuleName.labelAr}
                    <input
                      name="widget_title"
                      required
                      placeholder="أحدث الموضوعات"
                      className={adminFormFieldClassName(
                        fieldErrors.widget_title?.length ? "border-red-400/40" : "",
                      )}
                      aria-invalid={Boolean(fieldErrors.widget_title?.length)}
                      aria-describedby={fieldErrors.widget_title?.length ? "widget_title-error" : undefined}
                    />
                    <AdminFormError name="widget_title" />
                  </label>
                  <label className={adminFormLabelClassName()}>
                    Limit
                    <input
                      name="limit"
                      type="number"
                      min={1}
                      defaultValue={3}
                      className={adminFormFieldClassName(
                        fieldErrors.limit?.length ? "border-red-400/40" : "",
                      )}
                      aria-invalid={Boolean(fieldErrors.limit?.length)}
                      aria-describedby={fieldErrors.limit?.length ? "limit-error" : undefined}
                    />
                    <AdminFormError name="limit" />
                  </label>
                </>
              ) : null}
              <input type="hidden" name="status" value="draft" />
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
