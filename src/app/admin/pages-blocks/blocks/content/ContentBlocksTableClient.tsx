"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PlusIcon } from "../../../../../components/admin/AdminRowActions";
import {
  ADMIN_DATA_GRID_ACTION_COLUMNS,
  ADMIN_DATA_GRID_RULES,
  ADMIN_FORM,
  AdminBulkActionBar,
  AdminDataGrid,
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
  AdminDataGridCheckbox,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridRow,
  AdminDataGridSortLabel,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  AdminPageHeader,
  AdminStatusPill,
  VenesiaModal,
  adminFormFieldClassName,
  adminFormLabelClassName,
} from "../../../../../components/admin/ui";
import { ADMIN_LIST_PAGE } from "../../../../../lib/admin/admin-ui-styles";
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
const columns = `44px minmax(260px, 1fr) 120px 96px 96px 120px ${ADMIN_DATA_GRID_ACTION_COLUMNS.fiveCompact}`;

type ContentBlocksTableClientProps = {
  rows: ContentBlockRow[];
};

function PublicPreviewIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={ADMIN_DATA_GRID_RULES.actionIcon}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M14 3h7v7" />
      <path d="M10 14 21 3" />
      <path d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6" />
    </svg>
  );
}

function variantLabel(variant: string) {
  return VARIANT_OPTIONS.find(([value]) => value === variant)?.[1] ?? variant;
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
}

export default function ContentBlocksTableClient({ rows }: ContentBlocksTableClientProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);

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

  function sortProps(key: ContentSortKey) {
    return {
      active: table.sort.key === key,
      direction: table.sort.direction,
      onClick: () => table.toggleSort(key),
    } as const;
  }

  return (
    <div className={ADMIN_LIST_PAGE.wrapper} dir="rtl">
      <AdminPageHeader
        eyebrow="Admin Panel"
        title="إدارة بلوكات المحتوى"
        description="قوالب المحتوى النصي القابلة لإعادة الاستخدام. اربطها بالصفحات من Pages Manager."
        meta={`${rows.length} بلوك`}
        actions={(
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl bg-[#D8B87A] px-5 text-sm font-bold text-[#06101C] transition hover:bg-[#e5c98d]"
          >
            <PlusIcon />
            إضافة بلوك
          </button>
        )}
      />

      <div className="space-y-4">
        {table.feedback ? (
          <div
            className={`rounded-[16px] border px-4 py-3 text-sm font-semibold ${
              table.feedback.type === "success"
                ? "border-emerald-400/18 bg-emerald-500/10 text-emerald-100"
                : "border-red-400/18 bg-red-500/10 text-red-100"
            }`}
          >
            {table.feedback.message}
          </div>
        ) : null}

        <AdminBulkActionBar
          selectedIds={table.selection.selectedIds}
          entityLabel="بلوك"
          options={[
            { value: "publish", label: "نشر" },
            { value: "hide", label: "إخفاء" },
            { value: "draft", label: "مسودة" },
            { value: "delete", label: "حذف" },
          ]}
          onClearSelection={table.selection.clearSelection}
          isBusy={table.isPending}
          onExecute={(action, ids) =>
            table.runAction(async () => {
              const formData = new FormData();
              formData.set("bulk_action", action);
              ids.forEach((id) => formData.append("ids", String(id)));
              await bulkContentBlocks(formData);
              const nextRows = await getContentBlockRows();
              return { ok: true, message: "تم تنفيذ العملية الجماعية بنجاح.", rows: nextRows };
            })
          }
        />

        <AdminDataGrid summary={`${table.rows.length} بلوك`}>
          <AdminDataGridHeader columns={columns}>
            <div className="flex justify-center">
              <AdminDataGridCheckbox
                inputRef={table.selection.selectAllRef}
                checked={table.selection.allSelected}
                onChange={(event) => table.selection.toggleAll(event.currentTarget.checked)}
                label="تحديد الكل"
              />
            </div>
            <div className="min-w-0 text-right">
              <AdminDataGridSortLabel {...sortProps("name")} className="justify-end">
                الاسم
              </AdminDataGridSortLabel>
            </div>
            <div className="text-center">
              <AdminDataGridSortLabel {...sortProps("slug")} className="justify-center">
                Slug
              </AdminDataGridSortLabel>
            </div>
            <div className="text-center">
              <AdminDataGridSortLabel {...sortProps("variant")} className="justify-center">
                Variant
              </AdminDataGridSortLabel>
            </div>
            <div className="text-center">
              <AdminDataGridSortLabel {...sortProps("status")} className="justify-center">
                الحالة
              </AdminDataGridSortLabel>
            </div>
            <div className="text-center">
              <AdminDataGridSortLabel {...sortProps("updated_at")} className="justify-center">
                التحديث
              </AdminDataGridSortLabel>
            </div>
            <div className="text-center">الإجراءات</div>
          </AdminDataGridHeader>

          {table.rows.length ? (
            table.rows.map((row) => {
              const status = statusMeta(row.status);
              const nextStatus = row.status === "published" ? "unpublished" : "published";
              const isPublished = row.status === "published";

              return (
                <AdminDataGridRow key={row.id} columns={columns}>
                  <div className="flex justify-center">
                    <AdminDataGridCheckbox
                      checked={table.selection.selectedSet.has(row.id)}
                      onChange={(event) => table.selection.toggleOne(row.id, event.currentTarget.checked)}
                      label={`تحديد ${row.name}`}
                    />
                  </div>

                  <div className="min-w-0 text-right">
                    <Link
                      href={`${MODULE_PATH}/${row.id}`}
                      className="block truncate font-semibold text-white transition hover:text-[#D8B87A]"
                    >
                      {row.name}
                    </Link>
                    {row.description ? (
                      <p className="mt-1 truncate text-xs text-white/36">{row.description}</p>
                    ) : null}
                  </div>

                  <div className="min-w-0 text-center">
                    <span className="font-en block truncate text-xs text-white/42">{row.slug}</span>
                  </div>

                  <div className="truncate text-center text-sm text-white/55">{variantLabel(row.variant)}</div>

                  <div className="flex justify-center">
                    <AdminStatusPill tone={status.tone}>{status.label}</AdminStatusPill>
                  </div>

                  <div className="text-center font-en text-xs tabular-nums text-white/55">
                    {formatUpdatedAt(row.updated_at)}
                  </div>

                  <AdminDataGridActionsCell compact>
                    <AdminDataGridActionButton
                      action="edit"
                      href={`${MODULE_PATH}/${row.id}`}
                      size="compact"
                      title="تعديل البلوك"
                    />

                    <AdminDataGridActionButton
                      href="/"
                      target="_blank"
                      tone="dark"
                      title="معاينة الموقع العام"
                      size="compact"
                    >
                      <PublicPreviewIcon />
                    </AdminDataGridActionButton>

                    <form action={toggleContentBlockStatus} className="contents">
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name="next_status" value={nextStatus} />
                      <AdminDataGridActionButton
                        type="submit"
                        action="visibility"
                        size="compact"
                        isCurrentlyHidden={!isPublished}
                        title={isPublished ? "إخفاء" : "نشر"}
                      />
                    </form>

                    <form action={duplicateContentBlock} className="contents">
                      <input type="hidden" name="id" value={row.id} />
                      <AdminDataGridActionButton type="submit" action="duplicate" size="compact" title="نسخ" />
                    </form>

                    <form action={deleteContentBlock} className="contents">
                      <input type="hidden" name="id" value={row.id} />
                      <AdminDataGridActionButton type="submit" action="delete" size="compact" title="حذف" />
                    </form>
                  </AdminDataGridActionsCell>
                </AdminDataGridRow>
              );
            })
          ) : (
            <AdminDataGridEmpty>لا توجد بلوكات بعد.</AdminDataGridEmpty>
          )}
        </AdminDataGrid>
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
    </div>
  );
}
