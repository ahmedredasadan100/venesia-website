import Link from "next/link";
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
import AdminStatusPill from "../../../../components/admin/ui/AdminStatusPill";
import type { ProjectCategory } from "../../../../config/projects-data";
import { featuredLabel, formatDate, publicationMeta } from "./projects-table-utils";
import type {
  ProjectGridRow,
  ProjectRowActionHandlers,
  ProjectTableSelection,
  ProjectTableSortState,
} from "./projects-table-types";

export type ReferenceProjectSortKey =
  | "arabic_name"
  | "code"
  | "featured"
  | "publication_status"
  | "updated_at";

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

function DeleteIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={ADMIN_DATA_GRID_RULES.actionIcon} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M7 7l1 13h8l1-13" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

type ReferenceProjectsTableProps = {
  type: ProjectCategory;
  rows: ProjectGridRow[];
  columns: string;
  sort: ProjectTableSortState;
  onSort: (field: ReferenceProjectSortKey) => void;
  selection: ProjectTableSelection;
  handlers: ProjectRowActionHandlers;
};

export default function ReferenceProjectsTable({
  type,
  rows,
  columns,
  sort,
  onSort,
  selection,
  handlers,
}: ReferenceProjectsTableProps) {
  function sortProps(key: ReferenceProjectSortKey) {
    return {
      active: sort.field === key,
      direction: sort.field === key ? sort.direction : ("asc" as const),
      onClick: () => onSort(key),
    } as const;
  }

  const publishedCount = rows.filter(
    (item) => item.publication_status === "published",
  ).length;

  return (
    <AdminDataGrid
      summary={`${rows.length} مشروع${publishedCount ? ` — ${publishedCount} منشور` : ""}`}
    >
      <AdminDataGridHeader columns={columns}>
        <div className="flex justify-center">
          <AdminDataGridCheckbox
            inputRef={selection.selectAllRef}
            checked={selection.allSelected}
            onChange={(event) => selection.toggleAll(event.currentTarget.checked)}
            label="تحديد الكل"
          />
        </div>
        <div className="min-w-0 text-right">
          <AdminDataGridSortLabel {...sortProps("arabic_name")} className="justify-end">
            المشروع
          </AdminDataGridSortLabel>
        </div>
        <div className="text-center">
          <AdminDataGridSortLabel {...sortProps("code")} className="justify-center">
            الكود
          </AdminDataGridSortLabel>
        </div>
        <div className="text-center">
          <AdminDataGridSortLabel {...sortProps("featured")} className="justify-center">
            مميز
          </AdminDataGridSortLabel>
        </div>
        <div className="text-center">
          <AdminDataGridSortLabel {...sortProps("publication_status")} className="justify-center">
            حالة النشر
          </AdminDataGridSortLabel>
        </div>
        <div className="text-center">
          <AdminDataGridSortLabel {...sortProps("updated_at")} className="justify-center">
            التحديث
          </AdminDataGridSortLabel>
        </div>
        <div className="text-center">الإجراءات</div>
      </AdminDataGridHeader>

      {rows.length ? (
        rows.map((item) => {
          const published = publicationMeta(item.publication_status);
          const isPublished = item.publication_status === "published";
          const isArchived = item.publication_status === "archived";
          const previewPath = item.slug ? `/projects/${item.slug}` : null;
          const pending = handlers.isRowPending(item.id);
          const pendingAction = handlers.rowPendingAction(item.id);

          return (
            <AdminDataGridRow
              key={item.id}
              columns={columns}
              divided
            >
              <div className="flex justify-center">
                <AdminDataGridCheckbox
                  checked={selection.selectedSet.has(item.id)}
                  onChange={(event) =>
                    selection.toggleOne(item.id, event.currentTarget.checked)
                  }
                  label={`تحديد ${item.arabic_name}`}
                />
              </div>

              <div className="flex min-w-0 items-center gap-3">
                <ProjectIcon type={type} />
                <div className="min-w-0 text-right">
                  <Link
                    href={`/admin/projects/${item.id}`}
                    className="block truncate font-semibold text-white transition hover:text-[#D8B87A]"
                    title={`تعديل ${item.arabic_name}`}
                  >
                    {item.arabic_name}
                  </Link>
                </div>
              </div>

              <div className="min-w-0 text-center">
                <span
                  className="font-en block truncate text-sm font-medium text-[#D8B87A]/85"
                  title={item.code}
                >
                  {item.code}
                </span>
              </div>

              <div className="flex justify-center">
                <AdminStatusPill tone={item.featured ? "green" : "muted"}>
                  {featuredLabel(item)}
                </AdminStatusPill>
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
                    isCurrentlyHidden={!isPublished}
                    title={isPublished ? "إخفاء من الموقع" : "نشر في الموقع"}
                    disabled={pending || handlers.isBulkPending}
                    pending={pendingAction === "status"}
                    onClick={() =>
                      handlers.onTogglePublication(item.id, item.publication_status)
                    }
                  />
                ) : (
                  <AdminDataGridActionButton
                    tone="dark"
                    size="compact"
                    title="استعادة كمسودة"
                    disabled={pending || handlers.isBulkPending}
                    pending={pendingAction === "restore"}
                    onClick={() => handlers.onRestore(item.id)}
                  >
                    <RestoreIcon />
                  </AdminDataGridActionButton>
                )}

                <AdminDataGridActionButton
                  action="duplicate"
                  size="compact"
                  title="نسخ المشروع"
                  disabled={pending || handlers.isBulkPending || !handlers.onDuplicate}
                  pending={pendingAction === "duplicate"}
                  onClick={() => handlers.onDuplicate?.(item.id)}
                />

                {!isArchived ? (
                  <AdminDataGridActionButton
                    tone="dark"
                    size="compact"
                    title="أرشفة المشروع"
                    disabled={pending || handlers.isBulkPending}
                    pending={pendingAction === "archive"}
                    onClick={() => handlers.onArchive(item.id)}
                  >
                    <ArchiveIcon />
                  </AdminDataGridActionButton>
                ) : null}

                <AdminDataGridActionButton
                  tone="dark"
                  size="compact"
                  title="حذف نهائي — يتطلب تأكيدًا"
                  disabled={pending || handlers.isBulkPending}
                  pending={pendingAction === "delete"}
                  onClick={() => handlers.onRequestPermanentDelete(item)}
                >
                  <DeleteIcon />
                </AdminDataGridActionButton>
              </AdminDataGridActionsCell>
            </AdminDataGridRow>
          );
        })
      ) : (
        <AdminDataGridEmpty>
          <p className="text-base font-semibold text-white">
            لا توجد مشاريع سكنية في هذه القائمة
          </p>
          <p className="mt-2 text-sm leading-7 text-white/45">
            أضف مشروعًا سكنيًا جديدًا من زر «إضافة مشروع» أعلى الصفحة، أو راجع مركز المشروعات إن كنت تبحث عن مشروع
            تجاري.
          </p>
        </AdminDataGridEmpty>
      )}
    </AdminDataGrid>
  );
}
