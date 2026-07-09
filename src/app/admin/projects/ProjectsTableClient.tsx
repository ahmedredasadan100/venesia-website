"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ADMIN_DATA_GRID_RULES,
  AdminBulkActionBar,
  AdminDataGrid,
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
  AdminDataGridCheckbox,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridRow,
  AdminDataGridSortLabel,
} from "../../../components/admin/ui";
import { useAdminTable } from "../../../components/admin/table-engine";
import AdminStatusPill from "../../../components/admin/ui/AdminStatusPill";
import VenesiaActionModal, { VenesiaActionModalButton } from "../../../components/admin/VenesiaActionModal";
import type { ProjectCategory } from "../../../config/projects-data";
import {
  archiveProjectAjax,
  bulkProjectsActionAjax,
  deleteProjectAjax,
  duplicateProjectAjax,
  getProjectsTableRows,
  restoreProjectAjax,
  toggleProjectPublicationAjax,
} from "./actions";
import {
  buildColumns,
  featuredLabel,
  formatDate,
  locationLabel,
  publicationMeta,
} from "./projects-table/projects-table-utils";
import type { ProjectGridRow } from "./projects-table/projects-table-types";

export type { ProjectGridRow } from "./projects-table/projects-table-types";

type LegacyProjectSortKey = "code" | "location" | "updated_at";
type ReferenceProjectSortKey = "name" | "code" | "featured" | "status" | "updated_at";

function ArchiveIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={ADMIN_DATA_GRID_RULES.actionIcon} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 7h18" />
      <path d="M5 7l1 12h12l1-12" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={ADMIN_DATA_GRID_RULES.actionIcon} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 12a9 9 0 0 1 15-6.7" />
      <path d="M18 3v4h-4" />
      <path d="M21 12a9 9 0 0 1-15 6.7" />
      <path d="M6 21v-4H2" />
    </svg>
  );
}

type ProjectRowActionHandlers = {
  onTogglePublication: (id: number, status: string | null) => void;
  onArchive: (id: number) => void;
  onRestore: (id: number) => void;
  onRequestPermanentDelete: (item: ProjectGridRow) => void;
  isPending: boolean;
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

function ProjectIcon({ type }: { type: ProjectCategory }) {
  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D8B87A]/16 bg-[#D8B87A]/8 text-[#D8B87A]">
      {type === "commercial" ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
          <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
          <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
          <path d="M10 6h4M10 10h4M10 14h4M10 18h4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <path d="M8 7h8M8 11h8M8 15h5" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

type ProjectsTableClientProps = {
  type: ProjectCategory;
  projects: ProjectGridRow[];
  withDuplicateAction?: boolean;
  referenceLayout?: boolean;
};

function LegacyProjectsTable({
  type,
  table,
  columns,
  withDuplicateAction,
  handlers,
}: {
  type: ProjectCategory;
  table: ReturnType<typeof useAdminTable<ProjectGridRow, LegacyProjectSortKey>>;
  columns: string;
  withDuplicateAction: boolean;
  handlers: ProjectRowActionHandlers;
}) {
  function sortProps(key: LegacyProjectSortKey) {
    return {
      active: table.sort.key === key,
      direction: table.sort.direction,
      onClick: () => table.toggleSort(key),
    } as const;
  }

  return (
    <AdminDataGrid>
      <AdminDataGridHeader columns={columns}>
        <div className="flex justify-center">
          <AdminDataGridCheckbox
            inputRef={table.selection.selectAllRef}
            checked={table.selection.allSelected}
            onChange={(event) => table.selection.toggleAll(event.currentTarget.checked)}
            label="تحديد الكل"
          />
        </div>
        <AdminDataGridSortLabel {...sortProps("code")}>Code</AdminDataGridSortLabel>
        <AdminDataGridSortLabel {...sortProps("location")}>Location / Area</AdminDataGridSortLabel>
        <span className="text-center">Featured</span>
        <span className="text-center">Published</span>
        <AdminDataGridSortLabel {...sortProps("updated_at")} className="mx-auto">
          Last Updated
        </AdminDataGridSortLabel>
        <span className="text-center">Actions</span>
      </AdminDataGridHeader>

      {table.rows.length ? (
        table.rows.map((item) => {
          const published = publicationMeta(item.publication_status);
          const isHidden = item.publication_status !== "published";
          const isArchived = item.publication_status === "archived";

          return (
            <AdminDataGridRow
              key={item.id}
              columns={columns}
              className="border-b border-white/[0.045] last:border-b-0"
            >
              <div className="flex justify-center">
                <AdminDataGridCheckbox
                  checked={table.selection.selectedSet.has(item.id)}
                  onChange={(event) => table.selection.toggleOne(item.id, event.currentTarget.checked)}
                  label={`تحديد ${item.code}`}
                />
              </div>

              <div className="flex min-w-0 items-center gap-2.5">
                <ProjectIcon type={type} />
                <span className="truncate font-en text-sm font-semibold text-[#D8B87A]">{item.code}</span>
              </div>

              <div className="truncate text-sm text-white/60">{locationLabel(item)}</div>

              <div className="flex justify-center">
                <AdminStatusPill tone={item.featured ? "green" : "muted"}>{featuredLabel(item)}</AdminStatusPill>
              </div>
              <div className="flex justify-center">
                <AdminStatusPill tone={published.tone}>{published.label}</AdminStatusPill>
              </div>
              <div className="text-center text-xs text-white/50">{formatDate(item.updated_at)}</div>

              <AdminDataGridActionsCell>
                <AdminDataGridActionButton action="edit" href={`/admin/projects/${item.id}`} />
                {!isArchived ? (
                  <AdminDataGridActionButton
                    action="visibility"
                    title={isHidden ? "نشر" : "إخفاء"}
                    hidden={isHidden}
                    disabled={handlers.isPending}
                    onClick={() => handlers.onTogglePublication(item.id, item.publication_status)}
                  />
                ) : (
                  <AdminDataGridActionButton
                    tone="dark"
                    title="استعادة كمسودة"
                    disabled={handlers.isPending}
                    onClick={() => handlers.onRestore(item.id)}
                  >
                    <RestoreIcon />
                  </AdminDataGridActionButton>
                )}
                {withDuplicateAction ? (
                  <AdminDataGridActionButton
                    action="duplicate"
                    title="نسخ المشروع"
                    disabled={handlers.isPending}
                    onClick={() => table.runAction(() => duplicateProjectAjax(item.id))}
                  />
                ) : null}
                {!isArchived ? (
                  <AdminDataGridActionButton
                    tone="dark"
                    title="أرشفة المشروع"
                    disabled={handlers.isPending}
                    onClick={() => handlers.onArchive(item.id)}
                  >
                    <ArchiveIcon />
                  </AdminDataGridActionButton>
                ) : null}
                <AdminDataGridActionButton
                  tone="dark"
                  title="حذف نهائي"
                  disabled={handlers.isPending}
                  onClick={() => handlers.onRequestPermanentDelete(item)}
                >
                  <span className="text-[10px] font-bold text-red-300">DEL</span>
                </AdminDataGridActionButton>
              </AdminDataGridActionsCell>
            </AdminDataGridRow>
          );
        })
      ) : (
        <AdminDataGridEmpty>
          <p className="text-base font-semibold text-white">لا توجد مشاريع في هذه القائمة</p>
          <p className="mt-2 text-sm text-white/45">
            أضف مشروعًا جديدًا من لوحة التحكم أو تأكد من تنفيذ ملف SQL للجداول.
          </p>
        </AdminDataGridEmpty>
      )}
    </AdminDataGrid>
  );
}

function ReferenceProjectsTable({
  type,
  table,
  columns,
  handlers,
}: {
  type: ProjectCategory;
  table: ReturnType<typeof useAdminTable<ProjectGridRow, ReferenceProjectSortKey>>;
  columns: string;
  handlers: ProjectRowActionHandlers;
}) {
  function sortProps(key: ReferenceProjectSortKey) {
    return {
      active: table.sort.key === key,
      direction: table.sort.direction,
      onClick: () => table.toggleSort(key),
    } as const;
  }

  return (
    <AdminDataGrid summary={`${table.rows.length} مشروع`}>
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
            المشروع
          </AdminDataGridSortLabel>
        </div>
        <div className="text-center">
          <AdminDataGridSortLabel {...sortProps("code")} className="justify-center">
            Code
          </AdminDataGridSortLabel>
        </div>
        <div className="text-center">
          <AdminDataGridSortLabel {...sortProps("featured")} className="justify-center">
            Featured
          </AdminDataGridSortLabel>
        </div>
        <div className="text-center">
          <AdminDataGridSortLabel {...sortProps("status")} className="justify-center">
            Published
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
        table.rows.map((item) => {
          const published = publicationMeta(item.publication_status);
          const isPublished = item.publication_status === "published";
          const isArchived = item.publication_status === "archived";
          const previewPath = item.slug ? `/projects/${item.slug}` : null;

          return (
            <AdminDataGridRow key={item.id} columns={columns}>
              <div className="flex justify-center">
                <AdminDataGridCheckbox
                  checked={table.selection.selectedSet.has(item.id)}
                  onChange={(event) => table.selection.toggleOne(item.id, event.currentTarget.checked)}
                  label={`تحديد ${item.arabic_name}`}
                />
              </div>

              <div className="flex min-w-0 items-center gap-3">
                <ProjectIcon type={type} />
                <div className="min-w-0 text-right">
                  <Link
                    href={`/admin/projects/${item.id}`}
                    className="block truncate font-semibold text-white transition hover:text-[#D8B87A]"
                  >
                    {item.arabic_name}
                  </Link>
                  <p className="mt-1 truncate font-en text-xs text-white/38">{item.code}</p>
                </div>
              </div>

              <div className="min-w-0 text-center">
                <span className="font-en block truncate text-xs text-[#D8B87A]/78">{item.code}</span>
              </div>

              <div className="flex justify-center">
                <AdminStatusPill tone={item.featured ? "green" : "muted"}>{featuredLabel(item)}</AdminStatusPill>
              </div>

              <div className="flex justify-center">
                <AdminStatusPill tone={published.tone}>{published.label}</AdminStatusPill>
              </div>

              <div className="text-center font-en text-xs tabular-nums text-white/55">
                {formatDate(item.updated_at)}
              </div>

              <AdminDataGridActionsCell compact>
                <AdminDataGridActionButton
                  action="edit"
                  href={`/admin/projects/${item.id}`}
                  size="compact"
                  title="تعديل المشروع"
                />

                {previewPath ? (
                  <AdminDataGridActionButton
                    href={previewPath}
                    target="_blank"
                    tone="dark"
                    title="معاينة الصفحة العامة"
                    size="compact"
                  >
                    <PublicPreviewIcon />
                  </AdminDataGridActionButton>
                ) : (
                  <AdminDataGridActionButton
                    tone="dark"
                    disabled
                    title="لا يوجد slug للمعاينة"
                    size="compact"
                  >
                    <PublicPreviewIcon />
                  </AdminDataGridActionButton>
                )}

                {!isArchived ? (
                  <AdminDataGridActionButton
                    action="visibility"
                    size="compact"
                    hidden={isPublished}
                    title={isPublished ? "إخفاء" : "نشر"}
                    disabled={handlers.isPending}
                    onClick={() => handlers.onTogglePublication(item.id, item.publication_status)}
                  />
                ) : (
                  <AdminDataGridActionButton
                    tone="dark"
                    size="compact"
                    title="استعادة كمسودة"
                    disabled={handlers.isPending}
                    onClick={() => handlers.onRestore(item.id)}
                  >
                    <RestoreIcon />
                  </AdminDataGridActionButton>
                )}

                <AdminDataGridActionButton
                  action="duplicate"
                  size="compact"
                  title="نسخ المشروع"
                  disabled={handlers.isPending}
                  onClick={() => table.runAction(() => duplicateProjectAjax(item.id))}
                />

                {!isArchived ? (
                  <AdminDataGridActionButton
                    tone="dark"
                    size="compact"
                    title="أرشفة المشروع"
                    disabled={handlers.isPending}
                    onClick={() => handlers.onArchive(item.id)}
                  >
                    <ArchiveIcon />
                  </AdminDataGridActionButton>
                ) : null}

                <AdminDataGridActionButton
                  tone="dark"
                  size="compact"
                  title="حذف نهائي"
                  disabled={handlers.isPending}
                  onClick={() => handlers.onRequestPermanentDelete(item)}
                >
                  <span className="text-[10px] font-bold text-red-300">DEL</span>
                </AdminDataGridActionButton>
              </AdminDataGridActionsCell>
            </AdminDataGridRow>
          );
        })
      ) : (
        <AdminDataGridEmpty>
          <p className="text-base font-semibold text-white">لا توجد مشاريع في هذه القائمة</p>
          <p className="mt-2 text-sm text-white/45">
            أضف مشروعًا جديدًا من لوحة التحكم أو تأكد من تنفيذ ملف SQL للجداول.
          </p>
        </AdminDataGridEmpty>
      )}
    </AdminDataGrid>
  );
}

export default function ProjectsTableClient({
  type,
  projects,
  withDuplicateAction = false,
  referenceLayout = false,
}: ProjectsTableClientProps) {
  const [pendingPermanentDelete, setPendingPermanentDelete] = useState<ProjectGridRow | null>(null);
  const columns = buildColumns(withDuplicateAction, referenceLayout);

  const legacySortAccessors = useMemo(
    () => ({
      code: (item: ProjectGridRow) => item.code,
      location: (item: ProjectGridRow) => locationLabel(item),
      updated_at: (item: ProjectGridRow) => item.updated_at,
    }),
    [],
  );

  const referenceSortAccessors = useMemo(
    () => ({
      name: (item: ProjectGridRow) => item.arabic_name,
      code: (item: ProjectGridRow) => item.code,
      featured: (item: ProjectGridRow) => featuredLabel(item),
      status: (item: ProjectGridRow) => publicationMeta(item.publication_status).label,
      updated_at: (item: ProjectGridRow) => item.updated_at,
    }),
    [],
  );

  const legacyTable = useAdminTable<ProjectGridRow, LegacyProjectSortKey>({
    initialRows: projects,
    getRowId: (item) => item.id,
    sortAccessors: legacySortAccessors,
    refresh: () => getProjectsTableRows(type),
  });

  const referenceTable = useAdminTable<ProjectGridRow, ReferenceProjectSortKey>({
    initialRows: projects,
    getRowId: (item) => item.id,
    sortAccessors: referenceSortAccessors,
    refresh: () => getProjectsTableRows(type),
  });

  const table = referenceLayout ? referenceTable : legacyTable;

  const handlers: ProjectRowActionHandlers = {
    isPending: table.isPending,
    onTogglePublication: (id, status) => {
      table.runAction(() => toggleProjectPublicationAjax(id, status));
    },
    onArchive: (id) => {
      table.runAction(() => archiveProjectAjax(id));
    },
    onRestore: (id) => {
      table.runAction(() => restoreProjectAjax(id));
    },
    onRequestPermanentDelete: (item) => {
      setPendingPermanentDelete(item);
    },
  };

  return (
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
        entityLabel="مشروع"
        options={[
          { value: "publish", label: "نشر المحدد" },
          { value: "hide", label: "إخفاء المحدد" },
          { value: "archive", label: "أرشفة المحدد" },
        ]}
        onClearSelection={table.selection.clearSelection}
        onExecute={(action, ids) =>
          table.runAction(() => bulkProjectsActionAjax(action, ids.map(Number), type))
        }
        isBusy={table.isPending}
      />

      {referenceLayout ? (
        <ReferenceProjectsTable type={type} table={referenceTable} columns={columns} handlers={handlers} />
      ) : (
        <LegacyProjectsTable
          type={type}
          table={legacyTable}
          columns={columns}
          withDuplicateAction={withDuplicateAction}
          handlers={handlers}
        />
      )}

      <VenesiaActionModal
        open={Boolean(pendingPermanentDelete)}
        title="حذف نهائي للمشروع"
        subtitle="هذا الإجراء لا يمكن التراجع عنه — سيتم حذف المشروع وجميع المخططات والوسائط المرتبطة."
        eyebrow="EMERGENCY DELETE"
        onClose={() => setPendingPermanentDelete(null)}
      >
        {pendingPermanentDelete ? (
          <>
            <p className="rounded-[16px] border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm leading-7 text-red-100">
              سيتم حذف «{pendingPermanentDelete.arabic_name || pendingPermanentDelete.code}» نهائيًا من قاعدة
              البيانات. يُفضّل الأرشفة للإخفاء الآمن.
            </p>
            <VenesiaActionModalButton
              tone="red"
              disabled={table.isPending}
              onClick={() => {
                const target = pendingPermanentDelete;
                setPendingPermanentDelete(null);
                table.runAction(() => deleteProjectAjax(target.id, true));
              }}
            >
              تأكيد الحذف النهائي
            </VenesiaActionModalButton>
            <VenesiaActionModalButton onClick={() => setPendingPermanentDelete(null)}>
              إلغاء — استخدم الأرشفة بدلًا من ذلك
            </VenesiaActionModalButton>
          </>
        ) : null}
      </VenesiaActionModal>
    </div>
  );
}
