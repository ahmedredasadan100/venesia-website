"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PlusIcon } from "../../../../../components/admin/AdminRowActions";
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
} from "../../../../../components/admin/ui";
import { useAdminTable } from "../../../../../components/admin/table-engine";
import { statusMeta } from "../../../../../lib/page-blocks/admin-utils";
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
const columns = `${ADMIN_DATA_GRID_COLUMNS.checkbox} ${ADMIN_DATA_GRID_COLUMNS.primaryCompact} ${ADMIN_DATA_GRID_COLUMNS.slugCompact} 96px ${ADMIN_DATA_GRID_COLUMNS.statusStandard} 120px ${ADMIN_DATA_GRID_ACTION_COLUMNS.threeCompact}`;
const PAGE_SIZE = Number(ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE);

type ContentBlocksTableClientProps = {
  rows: ContentBlockRow[];
  loadError?: string | null;
  mediaSynchronizationWarning?: boolean;
};

function variantLabel(variant: string) {
  return VARIANT_OPTIONS.find(([value]) => value === variant)?.[1] ?? variant;
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
}

export default function ContentBlocksTableClient({
  rows,
  loadError = null,
  mediaSynchronizationWarning = false,
}: ContentBlocksTableClientProps) {
  const feedbackChannel = "block-manager:content";
  const { publishFeedback, clearFeedback } = useAdminFeedback();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

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

  const table = useAdminTable<ContentBlockRow, ContentSortKey>({
    initialRows: rows,
    getRowId: (item) => item.id,
    sortAccessors,
    refresh: getContentBlockRows,
  });
  const totalPages = Math.max(1, Math.ceil(table.rows.length / pageSize));
  const resolvedCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRows = useMemo(
    () => table.rows.slice((resolvedCurrentPage - 1) * pageSize, resolvedCurrentPage * pageSize),
    [pageSize, resolvedCurrentPage, table.rows],
  );
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
      return { ok: true, message: successMessage };
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

  function sortProps(key: ContentSortKey) {
    return {
      active: table.sort.key === key,
      direction: table.sort.direction,
      onClick: () => table.toggleSort(key),
    } as const;
  }

  return (
    <AdminPageExperience dir="rtl">
      <AdminPageHeader
        eyebrow="Admin Panel"
        title="إدارة بلوكات المحتوى"
        description="قوالب المحتوى النصي القابلة لإعادة الاستخدام. اربطها بالصفحات من Pages Manager."
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

      <div className="space-y-4">
        <AdminFeedbackRegion
          channel={feedbackChannel}
          label="نتائج إجراءات بلوكات المحتوى"
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
          isBusy={table.isPending}
          onExecute={async (action, ids) => {
            clearFeedback(feedbackChannel);
            const result = await table.runAction(async () => {
              const formData = new FormData();
              formData.set("bulk_action", action);
              ids.forEach((id) => formData.append("ids", String(id)));
              await bulkContentBlocks(formData);
              const nextRows = await getContentBlockRows();
              return { ok: true, message: "تم تنفيذ العملية الجماعية بنجاح.", rows: nextRows };
            });
            publishFeedback(
              {
                variant: result.ok ? "success" : "danger",
                title: result.ok ? "تم تنفيذ الإجراء" : "تعذر تنفيذ الإجراء",
                message:
                  result.message ??
                  (result.ok
                    ? "تم تنفيذ العملية بنجاح."
                    : "تعذر تنفيذ العملية."),
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
            if (!result.ok && action === "delete") {
              throw new Error(result.message ?? "bulk delete failed");
            }
            selection.clearSelection();
          }}
        />

        <AdminDataGrid summary={`${table.rows.length} بلوك`}>
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
            <AdminDataGridCenterCell>
              <AdminDataGridSortLabel {...sortProps("slug")} className="justify-center">
                Slug
              </AdminDataGridSortLabel>
            </AdminDataGridCenterCell>
            <AdminDataGridCenterCell>
              <AdminDataGridSortLabel {...sortProps("variant")} className="justify-center">
                Variant
              </AdminDataGridSortLabel>
            </AdminDataGridCenterCell>
            <AdminDataGridCenterCell>
              <AdminDataGridSortLabel {...sortProps("status")} className="justify-center">
                الحالة
              </AdminDataGridSortLabel>
            </AdminDataGridCenterCell>
            <AdminDataGridCenterCell>
              <AdminDataGridSortLabel {...sortProps("updated_at")} className="justify-center">
                التحديث
              </AdminDataGridSortLabel>
            </AdminDataGridCenterCell>
            <div className="text-center">الإجراءات</div>
          </AdminDataGridHeader>

          {paginatedRows.length ? (
            paginatedRows.map((row) => {
              const status = statusMeta(row.status);
              const nextStatus = row.status === "published" ? "unpublished" : "published";
              const isPublished = row.status === "published";
              const hidden = { access: "hidden" as const };
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
                      { label: "آخر تحديث", value: formatUpdatedAt(row.updated_at) },
                    ],
                  },
                  copyPublicLink: hidden,
                  visibility: {
                    access: "allowed",
                    isVisible: isPublished,
                    pending: table.isPending,
                    onSelect: () =>
                      runRowMutation(async () => {
                        const formData = new FormData();
                        formData.set("id", String(row.id));
                        formData.set("next_status", nextStatus);
                        await toggleContentBlockStatus(formData);
                      }, isPublished ? "تم إخفاء البلوك." : "تم نشر البلوك."),
                  },
                  featured: hidden,
                  duplicate: {
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
                  delete: {
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

                  <AdminDataGridCenterCell>
                    <span className="font-en block truncate text-xs text-white/42">{row.slug}</span>
                  </AdminDataGridCenterCell>

                  <AdminDataGridCenterCell className="truncate text-sm text-white/55">{variantLabel(row.variant)}</AdminDataGridCenterCell>

                  <AdminDataGridStatusCell>
                    <AdminStatusPill tone={status.tone}>{status.label}</AdminStatusPill>
                  </AdminDataGridStatusCell>

                  <AdminDataGridCenterCell className="font-en text-xs tabular-nums text-white/55">
                    {formatUpdatedAt(row.updated_at)}
                  </AdminDataGridCenterCell>

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
          currentPage={resolvedCurrentPage}
          totalPages={totalPages}
          totalCount={table.rows.length}
          pageSize={String(pageSize)}
          onPageChange={setCurrentPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setCurrentPage(1);
          }}
          pending={table.isPending}
        />
      </div>

      <VenesiaModal
        open={showCreateModal}
        title="إضافة بلوك جديد"
        description="أنشئ القالب ثم عدّل المحتوى واربطه بالصفحات. البلوكات الجديدة تُنشأ كمسودة."
        size="md"
        onClose={() => setShowCreateModal(false)}
        footer={(
          <>
            <AdminModalCancelButton onClick={() => setShowCreateModal(false)}>إلغاء</AdminModalCancelButton>
            <AdminModalPrimaryButton type="submit" form="create-content-block-form">
              إنشاء وفتح
            </AdminModalPrimaryButton>
          </>
        )}
      >
        <form id="create-content-block-form" action={createContentBlock} className={ADMIN_FORM.grid}>
          <label className={adminFormLabelClassName()}>
            الاسم
            <input name="name" required className={adminFormFieldClassName()} />
          </label>
          <label className={adminFormLabelClassName()}>
            Slug
            <input name="slug" dir="ltr" placeholder="content-example" className={adminFormFieldClassName("text-left font-en")} />
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
          <input type="hidden" name="status" value="draft" />
          <input type="hidden" name="style_preset" value="premium-dark" />
        </form>
      </VenesiaModal>
    </AdminPageExperience>
  );
}
