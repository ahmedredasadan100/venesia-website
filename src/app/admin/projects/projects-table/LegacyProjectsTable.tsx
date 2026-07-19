import {
  ADMIN_DATA_GRID_RULES,
  AdminDataGrid,
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
  AdminDataGridCheckbox,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridRow,
  AdminDataGridSortLabel,
} from "../../../../components/admin/ui";
import { useAdminTable } from "../../../../components/admin/table-engine";
import AdminStatusPill from "../../../../components/admin/ui/AdminStatusPill";
import type { ProjectCategory } from "../../../../config/projects-data";
import { duplicateProjectAjax } from "../actions";
import {
  featuredLabel,
  formatDate,
  locationLabel,
  publicationMeta,
} from "./projects-table-utils";
import type { ProjectGridRow, ProjectRowActionHandlers } from "./projects-table-types";

export type LegacyProjectSortKey = "code" | "location" | "updated_at";

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
  table: ReturnType<typeof useAdminTable<ProjectGridRow, LegacyProjectSortKey>>;
  columns: string;
  withDuplicateAction: boolean;
  handlers: ProjectRowActionHandlers;
};

export default function LegacyProjectsTable({
  type,
  table,
  columns,
  withDuplicateAction,
  handlers,
}: LegacyProjectsTableProps) {
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
                    isCurrentlyHidden={isHidden}
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
