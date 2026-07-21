import {
  AdminDataGrid,
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
  AdminDataGridActionsHeaderCell,
  AdminDataGridCheckbox,
  AdminDataGridCheckboxCell,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridRow,
  AdminDataGridSortLabel,
} from "../../../../components/admin/ui";
import AdminStatusPill from "../../../../components/admin/ui/AdminStatusPill";
import type { ProjectCategory } from "../../../../config/projects-data";
import type { ProjectCommercialColumnKey } from "../../../../lib/admin/projects/projects-list-config";
import {
  featuredLabel,
  formatDate,
  isProjectColumnVisible,
  locationLabel,
  publicationMeta,
} from "./projects-table-utils";
import type {
  ProjectGridRow,
  ProjectRowActionHandlers,
  ProjectTableSelection,
  ProjectTableSortState,
} from "./projects-table-types";

export type LegacyProjectSortKey = "code" | "location" | "updated_at";

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

type LegacyProjectsTableProps = {
  type: ProjectCategory;
  rows: ProjectGridRow[];
  columns: string;
  visibleColumns: readonly ProjectCommercialColumnKey[];
  withDuplicateAction: boolean;
  sort: ProjectTableSortState;
  onSort: (field: LegacyProjectSortKey) => void;
  selection: ProjectTableSelection;
  handlers: ProjectRowActionHandlers;
};

export default function LegacyProjectsTable({
  type,
  rows,
  columns,
  visibleColumns,
  withDuplicateAction,
  sort,
  onSort,
  selection,
  handlers,
}: LegacyProjectsTableProps) {
  function sortProps(key: LegacyProjectSortKey) {
    return {
      active: sort.field === key,
      direction: sort.field === key ? sort.direction : ("asc" as const),
      onClick: () => onSort(key),
    } as const;
  }

  const show = (key: ProjectCommercialColumnKey) =>
    isProjectColumnVisible(visibleColumns, key);
  const actionsDisabled = handlers.isMutationBusy;

  return (
    <AdminDataGrid scrollLabel="جدول المشاريع التجارية">
      <AdminDataGridHeader columns={columns} horizontalScroll flushInlineEnd>
        {show("selection") ? (
          <AdminDataGridCheckboxCell>
            <AdminDataGridCheckbox
              inputRef={selection.selectAllRef}
              checked={selection.allSelected}
              onChange={(event) => selection.toggleAll(event.currentTarget.checked)}
              label="تحديد الكل"
            />
          </AdminDataGridCheckboxCell>
        ) : null}
        {show("code") ? (
          <AdminDataGridSortLabel {...sortProps("code")}>الكود</AdminDataGridSortLabel>
        ) : null}
        {show("location") ? (
          <AdminDataGridSortLabel {...sortProps("location")}>
            الموقع / المنطقة
          </AdminDataGridSortLabel>
        ) : null}
        {show("featured") ? <span className="text-center">مميز</span> : null}
        {show("publication_status") ? (
          <span className="text-center">حالة النشر</span>
        ) : null}
        {show("updated_at") ? (
          <AdminDataGridSortLabel {...sortProps("updated_at")} className="mx-auto">
            آخر تحديث
          </AdminDataGridSortLabel>
        ) : null}
        {show("actions") ? (
          <AdminDataGridActionsHeaderCell sticky>الإجراءات</AdminDataGridActionsHeaderCell>
        ) : null}
      </AdminDataGridHeader>

      {rows.length ? (
        rows.map((item) => {
          const published = publicationMeta(item.publication_status);
          const isHidden = item.publication_status !== "published";
          const isArchived = item.publication_status === "archived";
          const pendingAction = handlers.rowPendingAction(item.id);

          return (
            <AdminDataGridRow
              key={item.id}
              columns={columns}
              horizontalScroll
              flushInlineEnd
              className="border-b border-white/[0.045] last:border-b-0"
            >
              {show("selection") ? (
                <AdminDataGridCheckboxCell>
                  <AdminDataGridCheckbox
                    checked={selection.selectedSet.has(item.id)}
                    onChange={(event) =>
                      selection.toggleOne(item.id, event.currentTarget.checked)
                    }
                    label={`تحديد ${item.code}`}
                  />
                </AdminDataGridCheckboxCell>
              ) : null}

              {show("code") ? (
                <div className="flex min-w-0 items-center gap-2.5">
                  <ProjectIcon type={type} />
                  <span className="truncate font-en text-sm font-semibold text-[#D8B87A]">
                    {item.code}
                  </span>
                </div>
              ) : null}

              {show("location") ? (
                <div className="truncate text-sm text-white/60">
                  {locationLabel(item)}
                </div>
              ) : null}

              {show("featured") ? (
                <div className="flex justify-center">
                  <AdminStatusPill tone={item.featured ? "green" : "muted"}>
                    {featuredLabel(item)}
                  </AdminStatusPill>
                </div>
              ) : null}
              {show("publication_status") ? (
                <div className="flex justify-center">
                  <AdminStatusPill tone={published.tone}>{published.label}</AdminStatusPill>
                </div>
              ) : null}
              {show("updated_at") ? (
                <div className="text-center text-xs text-white/50">
                  {formatDate(item.updated_at)}
                </div>
              ) : null}

              {show("actions") ? (
                <AdminDataGridActionsCell sticky>
                  <AdminDataGridActionButton
                    action="edit"
                    href={`/admin/projects/${item.id}`}
                  />
                  {!isArchived ? (
                    <AdminDataGridActionButton
                      action="visibility"
                      title={isHidden ? "نشر" : "إخفاء"}
                      isCurrentlyHidden={isHidden}
                      disabled={actionsDisabled}
                      pending={pendingAction === "status"}
                      onClick={() =>
                        handlers.onTogglePublication(item.id, item.publication_status)
                      }
                    />
                  ) : (
                    <AdminDataGridActionButton
                      action="restore"
                      title="استعادة كمسودة"
                      disabled={actionsDisabled}
                      pending={pendingAction === "restore"}
                      onClick={() => handlers.onRestore(item.id)}
                    />
                  )}
                  {withDuplicateAction ? (
                    <AdminDataGridActionButton
                      action="duplicate"
                      title="نسخ المشروع"
                      disabled={actionsDisabled || !handlers.onDuplicate}
                      pending={pendingAction === "duplicate"}
                      onClick={() => handlers.onDuplicate?.(item.id)}
                    />
                  ) : null}
                  {!isArchived ? (
                    <AdminDataGridActionButton
                      action="archive"
                      title="أرشفة المشروع"
                      disabled={actionsDisabled}
                      pending={pendingAction === "archive"}
                      onClick={() => handlers.onArchive(item.id)}
                    />
                  ) : null}
                  <AdminDataGridActionButton
                    action="delete"
                    title="حذف نهائي"
                    disabled={actionsDisabled}
                    pending={pendingAction === "delete"}
                    onClick={() => handlers.onRequestPermanentDelete(item)}
                  />
                </AdminDataGridActionsCell>
              ) : null}
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
