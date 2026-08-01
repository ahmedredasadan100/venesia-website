"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
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
import { PlusIcon } from "../AdminRowActions";
import { statusMeta } from "../../../lib/page-blocks/admin-utils";

export type BlockModuleRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  variant: string;
  status: string;
};

type BlockModuleManagerClientProps = {
  moduleKey: "content" | "cta" | "cards" | "breadcrumb" | "feed";
  moduleTitle: string;
  moduleDescription: string;
  rows: BlockModuleRow[];
  createAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  duplicateAction: (formData: FormData) => Promise<void>;
  toggleAction: (formData: FormData) => Promise<void>;
  bulkAction: (formData: FormData) => Promise<void>;
  defaultVariant: string;
  variantOptions: Array<[string, string]>;
  loadError?: string | null;
  mediaSynchronizationWarning?: boolean;
};

const gridColumns = `${ADMIN_DATA_GRID_COLUMNS.checkbox} ${ADMIN_DATA_GRID_COLUMNS.primaryStandard} minmax(180px,1fr) 120px ${ADMIN_DATA_GRID_COLUMNS.statusStandard} ${ADMIN_DATA_GRID_ACTION_COLUMNS.threeCompact}`;
const PAGE_SIZE = Number(ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE);

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
}: BlockModuleManagerClientProps) {
  const router = useRouter();
  const feedbackChannel = `block-manager:${moduleKey}`;
  const { publishFeedback, clearFeedback } = useAdminFeedback();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [pendingRowId, setPendingRowId] = useState<number | null>(null);
  const [isRefreshPending, startRefreshTransition] = useTransition();
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const resolvedCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRows = useMemo(
    () => rows.slice((resolvedCurrentPage - 1) * pageSize, resolvedCurrentPage * pageSize),
    [pageSize, resolvedCurrentPage, rows],
  );
  const visibleIds = useMemo(() => paginatedRows.map((row) => row.id), [paginatedRows]);
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

      {mediaWarningNotice}

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

      <AdminDataGrid summary={rows.length ? `${rows.length} بلوك` : undefined}>
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
          <AdminDataGridCenterCell>Slug</AdminDataGridCenterCell>
          <AdminDataGridCenterCell>Variant</AdminDataGridCenterCell>
          <AdminDataGridCenterCell>الحالة</AdminDataGridCenterCell>
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

              <AdminDataGridCenterCell>
                <Link
                  href={`/admin/pages-blocks/blocks/${moduleKey}/${row.id}`}
                  className="font-en text-xs text-[#D8B87A]/78 transition hover:text-[#D8B87A]"
                >
                  {row.slug}
                </Link>
              </AdminDataGridCenterCell>

              <AdminDataGridCenterCell className="text-white/58">{row.variant}</AdminDataGridCenterCell>

              <AdminDataGridStatusCell className="flex-col gap-1">
                <AdminStatusPill tone={status.tone}>{status.label}</AdminStatusPill>
                {row.status !== "published" ? (
                  <p className="mt-1 text-[10px] leading-5 text-amber-200/75">غير منشور — لن يظهر على الصفحات العامة.</p>
                ) : null}
              </AdminDataGridStatusCell>

              <AdminDataGridRowActions capability={capability} size="compact" />
            </AdminDataGridRow>
          );
        })}

        {!rows.length ? <AdminDataGridEmpty>لا توجد بلوكات بعد.</AdminDataGridEmpty> : null}
      </AdminDataGrid>

      <AdminTablePagination
        basePath={`/admin/pages-blocks/blocks/${moduleKey}`}
        currentPage={resolvedCurrentPage}
        totalPages={totalPages}
        totalCount={rows.length}
        pageSize={String(pageSize)}
        onPageChange={setCurrentPage}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setCurrentPage(1);
        }}
        pending={isBusy}
      />

      <VenesiaModal
        open={showCreateModal}
        title="إضافة بلوك جديد"
        description="أنشئ القالب ثم عدّل المحتوى واربطه بالصفحات. البلوكات الجديدة تُنشأ كمسودة."
        size="md"
        onClose={() => setShowCreateModal(false)}
        footer={(
          <>
            <AdminModalCancelButton onClick={() => setShowCreateModal(false)}>إلغاء</AdminModalCancelButton>
            <AdminModalPrimaryButton type="submit" form={`create-${moduleKey}-block-form`}>
              إنشاء وفتح
            </AdminModalPrimaryButton>
          </>
        )}
      >
        <form id={`create-${moduleKey}-block-form`} action={createAction} className={ADMIN_FORM.grid}>
          <label className={adminFormLabelClassName()}>
            الاسم
            <input name="name" required className={adminFormFieldClassName()} />
          </label>
          <label className={adminFormLabelClassName()}>
            Slug
            <input
              name="slug"
              dir="ltr"
              placeholder={`${moduleKey}-example`}
              className={adminFormFieldClassName("text-left font-en")}
            />
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
                Widget Title
                <input
                  name="widget_title"
                  required
                  placeholder="أحدث الموضوعات"
                  className={adminFormFieldClassName()}
                />
              </label>
              <label className={adminFormLabelClassName()}>
                Limit
                <input
                  name="limit"
                  type="number"
                  min={1}
                  defaultValue={3}
                  className={adminFormFieldClassName()}
                />
              </label>
            </>
          ) : null}
          <input type="hidden" name="status" value="draft" />
          <input type="hidden" name="style_preset" value="premium-dark" />
        </form>
      </VenesiaModal>
    </AdminPageExperience>
  );
}
