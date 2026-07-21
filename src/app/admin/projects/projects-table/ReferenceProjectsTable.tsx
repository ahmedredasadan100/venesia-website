import Link from "next/link";
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
import type { ProjectResidentialColumnKey } from "../../../../lib/admin/projects/projects-list-config";
import {
  featuredLabel,
  formatDate,
  isProjectColumnVisible,
  publicationMeta,
} from "./projects-table-utils";
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

type ReferenceProjectsTableProps = {
  type: ProjectCategory;
  rows: ProjectGridRow[];
  columns: string;
  visibleColumns: readonly ProjectResidentialColumnKey[];
  sort: ProjectTableSortState;
  onSort: (field: ReferenceProjectSortKey) => void;
  selection: ProjectTableSelection;
  handlers: ProjectRowActionHandlers;
};

export default function ReferenceProjectsTable({
  type,
  rows,
  columns,
  visibleColumns,
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

  const show = (key: ProjectResidentialColumnKey) =>
    isProjectColumnVisible(visibleColumns, key);

  const actionsDisabled = handlers.isMutationBusy;

  return (
    <AdminDataGrid scrollLabel="جدول المشاريع السكنية">
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
        {show("project") ? (
          <div className="min-w-0 text-right">
            <AdminDataGridSortLabel {...sortProps("arabic_name")} className="justify-end">
              المشروع
            </AdminDataGridSortLabel>
          </div>
        ) : null}
        {show("code") ? (
          <div className="text-center">
            <AdminDataGridSortLabel {...sortProps("code")} className="justify-center">
              الكود
            </AdminDataGridSortLabel>
          </div>
        ) : null}
        {show("featured") ? (
          <div className="text-center">
            <AdminDataGridSortLabel {...sortProps("featured")} className="justify-center">
              مميز
            </AdminDataGridSortLabel>
          </div>
        ) : null}
        {show("publication_status") ? (
          <div className="text-center">
            <AdminDataGridSortLabel {...sortProps("publication_status")} className="justify-center">
              حالة النشر
            </AdminDataGridSortLabel>
          </div>
        ) : null}
        {show("updated_at") ? (
          <div className="text-center">
            <AdminDataGridSortLabel {...sortProps("updated_at")} className="justify-center">
              التحديث
            </AdminDataGridSortLabel>
          </div>
        ) : null}
        {show("actions") ? (
          <AdminDataGridActionsHeaderCell sticky>الإجراءات</AdminDataGridActionsHeaderCell>
        ) : null}
      </AdminDataGridHeader>

      {rows.length ? (
        rows.map((item) => {
          const published = publicationMeta(item.publication_status);
          const isPublished = item.publication_status === "published";
          const isArchived = item.publication_status === "archived";
          const previewPath = item.slug ? `/projects/${item.slug}` : null;
          const pendingAction = handlers.rowPendingAction(item.id);

          return (
            <AdminDataGridRow
              key={item.id}
              columns={columns}
              horizontalScroll
              flushInlineEnd
              divided
            >
              {show("selection") ? (
                <AdminDataGridCheckboxCell>
                  <AdminDataGridCheckbox
                    checked={selection.selectedSet.has(item.id)}
                    onChange={(event) =>
                      selection.toggleOne(item.id, event.currentTarget.checked)
                    }
                    label={`تحديد ${item.arabic_name}`}
                  />
                </AdminDataGridCheckboxCell>
              ) : null}

              {show("project") ? (
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
              ) : null}

              {show("code") ? (
                <div className="min-w-0 text-center">
                  <span
                    className="font-en block truncate text-sm font-medium text-[#D8B87A]/85"
                    title={item.code}
                  >
                    {item.code}
                  </span>
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
                <div className="text-center font-en text-xs tabular-nums text-white/55">
                  {formatDate(item.updated_at)}
                </div>
              ) : null}

              {show("actions") ? (
                <AdminDataGridActionsCell compact sticky>
                  <AdminDataGridActionButton
                    action="edit"
                    href={`/admin/projects/${item.id}`}
                    size="compact"
                    title="تعديل المشروع"
                  />

                  {previewPath ? (
                    <AdminDataGridActionButton
                      action="preview"
                      href={previewPath}
                      target="_blank"
                      title="معاينة الصفحة العامة"
                      size="compact"
                    />
                  ) : (
                    <AdminDataGridActionButton
                      action="preview"
                      disabled
                      title="لا يوجد معرّف رابط للمعاينة"
                      size="compact"
                    />
                  )}

                  {!isArchived ? (
                    <AdminDataGridActionButton
                      action="visibility"
                      size="compact"
                      isCurrentlyHidden={!isPublished}
                      title={isPublished ? "إخفاء من الموقع" : "نشر في الموقع"}
                      disabled={actionsDisabled}
                      pending={pendingAction === "status"}
                      onClick={() =>
                        handlers.onTogglePublication(item.id, item.publication_status)
                      }
                    />
                  ) : (
                    <AdminDataGridActionButton
                      action="restore"
                      size="compact"
                      title="استعادة كمسودة"
                      disabled={actionsDisabled}
                      pending={pendingAction === "restore"}
                      onClick={() => handlers.onRestore(item.id)}
                    />
                  )}

                  <AdminDataGridActionButton
                    action="duplicate"
                    size="compact"
                    title="نسخ المشروع"
                    disabled={actionsDisabled || !handlers.onDuplicate}
                    pending={pendingAction === "duplicate"}
                    onClick={() => handlers.onDuplicate?.(item.id)}
                  />

                  {!isArchived ? (
                    <AdminDataGridActionButton
                      action="archive"
                      size="compact"
                      title="أرشفة المشروع"
                      disabled={actionsDisabled}
                      pending={pendingAction === "archive"}
                      onClick={() => handlers.onArchive(item.id)}
                    />
                  ) : null}

                  <AdminDataGridActionButton
                    action="delete"
                    size="compact"
                    title="حذف نهائي — يتطلب تأكيدًا"
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
