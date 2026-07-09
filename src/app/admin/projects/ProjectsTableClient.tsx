"use client";

import { useMemo, useState } from "react";
import { AdminBulkActionBar } from "../../../components/admin/ui";
import { useAdminTable } from "../../../components/admin/table-engine";
import VenesiaActionModal, { VenesiaActionModalButton } from "../../../components/admin/VenesiaActionModal";
import type { ProjectCategory } from "../../../config/projects-data";
import {
  archiveProjectAjax,
  bulkProjectsActionAjax,
  deleteProjectAjax,
  getProjectsTableRows,
  restoreProjectAjax,
  toggleProjectPublicationAjax,
} from "./actions";
import LegacyProjectsTable, { type LegacyProjectSortKey } from "./projects-table/LegacyProjectsTable";
import ReferenceProjectsTable, { type ReferenceProjectSortKey } from "./projects-table/ReferenceProjectsTable";
import {
  buildColumns,
  featuredLabel,
  locationLabel,
  publicationMeta,
} from "./projects-table/projects-table-utils";
import type { ProjectGridRow, ProjectRowActionHandlers } from "./projects-table/projects-table-types";

export type { ProjectGridRow } from "./projects-table/projects-table-types";

type ProjectsTableClientProps = {
  type: ProjectCategory;
  projects: ProjectGridRow[];
  withDuplicateAction?: boolean;
  referenceLayout?: boolean;
};

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
