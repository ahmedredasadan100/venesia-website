"use client";

import Link from "next/link";
import { useMemo } from "react";

import {
  ADMIN_DATA_GRID_ACTION_COLUMNS,
  ADMIN_DATA_GRID_COLUMNS,
  AdminBulkActionBar,
  AdminDataGrid,
  AdminDataGridCenterCell,
  AdminDataGridCheckbox,
  AdminDataGridCheckboxCell,
  AdminDataGridEmpty,
  AdminListEmptyState,
  AdminDataGridHeader,
  AdminDataGridPrimaryCell,
  AdminDataGridRow,
  AdminDataGridSortLink,
  AdminDataGridStatusCell,
  AdminStatusPill,
  useAdminGridSelection,
} from "../../../../components/admin/ui";
import { bulkUpdateMediaContent } from "./actions";
import MediaBulkPublishGate from "../../../../components/admin/content-workflow/MediaBulkPublishGate";
import MediaCategoryBadge from "./MediaCategoryBadge";
import MediaRowActions from "./MediaRowActions";
import { isMediaEditableContentType, type MediaListContentType } from "./media-content-config";

export type MediaListRow = {
  id: number;
  title: string | null;
  slug: string | null;
  content_type: MediaListContentType | string | null;
  category: string | null;
  category_slug: string | null;
  status: string | null;
};

type SortMeta = {
  active: boolean;
  direction: "asc" | "desc";
};

type MediaTableClientProps = {
  rows: MediaListRow[];
  currentListPath: string;
  titleSortHref: string;
  statusSortHref: string;
  titleSort: SortMeta;
  statusSort: SortMeta;
};

const MEDIA_TABLE_COLUMNS = `${ADMIN_DATA_GRID_COLUMNS.checkbox} ${ADMIN_DATA_GRID_COLUMNS.primaryStandard} ${ADMIN_DATA_GRID_COLUMNS.slug} ${ADMIN_DATA_GRID_COLUMNS.statusStandard} ${ADMIN_DATA_GRID_ACTION_COLUMNS.fiveCompact}`;

function getStatusTone(status?: string | null): "green" | "gold" | "muted" | "red" {
  if (status === "published") return "green";
  if (status === "unpublished") return "red";
  if (status === "archived") return "muted";
  return "gold";
}

function getStatusLabel(status?: string | null) {
  if (status === "published") return "منشور";
  if (status === "unpublished") return "مخفي";
  if (status === "archived") return "أرشيف";
  return "مسودة";
}

function getStatusHint(status?: string | null) {
  if (status === "published") return "متاح للعرض في المركز الإعلامي";
  if (status === "unpublished") return "محفوظ لكن غير معروض للجمهور";
  if (status === "archived") return "غير نشط — محفوظ للأرشيف";
  return "غير منشور — يمكن متابعة التحرير";
}

export default function MediaTableClient({
  rows,
  currentListPath,
  titleSortHref,
  statusSortHref,
  titleSort,
  statusSort,
}: MediaTableClientProps) {
  const visibleIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const selection = useAdminGridSelection(visibleIds);

  return (
    <div className="space-y-4">
      <MediaBulkPublishGate formId="media-bulk-form" />
      <AdminBulkActionBar
        formId="media-bulk-form"
        selectedIds={selection.selectedIds}
        entityLabel="عنصر"
        action={bulkUpdateMediaContent}
        idsFieldName="media_ids"
        actionFieldName="bulk_action"
        hiddenFields={{ redirect_to: currentListPath }}
        options={[
          { value: "publish", label: "نشر" },
          { value: "unpublish", label: "إخفاء" },
          { value: "archive", label: "أرشفة" },
          { value: "feature", label: "تعيين كمميز" },
          { value: "unfeature", label: "إلغاء التمييز" },
        ]}
        onClearSelection={selection.clearSelection}
      />

      <AdminDataGrid>
        <AdminDataGridHeader columns={MEDIA_TABLE_COLUMNS}>
          <AdminDataGridCheckboxCell>
            <AdminDataGridCheckbox
              inputRef={selection.selectAllRef}
              checked={selection.allSelected}
              onChange={(event) => selection.toggleAll(event.currentTarget.checked)}
              label="تحديد الكل"
            />
          </AdminDataGridCheckboxCell>
          <AdminDataGridPrimaryCell>
            <AdminDataGridSortLink href={titleSortHref} active={titleSort.active} direction={titleSort.direction}>
              العنوان
            </AdminDataGridSortLink>
          </AdminDataGridPrimaryCell>
          <AdminDataGridCenterCell>التصنيف</AdminDataGridCenterCell>
          <AdminDataGridCenterCell>
            <AdminDataGridSortLink href={statusSortHref} active={statusSort.active} direction={statusSort.direction}>
              الحالة
            </AdminDataGridSortLink>
          </AdminDataGridCenterCell>
          <AdminDataGridCenterCell>الإجراءات</AdminDataGridCenterCell>
        </AdminDataGridHeader>

        {rows.length > 0 ? (
          rows.map((row, index) => (
            <AdminDataGridRow key={row.id} columns={MEDIA_TABLE_COLUMNS} divided={index > 0}>
              <AdminDataGridCheckboxCell>
                <AdminDataGridCheckbox
                  checked={selection.selectedSet.has(row.id)}
                  onChange={(event) => selection.toggleOne(row.id, event.currentTarget.checked)}
                  label={`تحديد ${row.title || "عنصر"}`}
                />
              </AdminDataGridCheckboxCell>

              <AdminDataGridPrimaryCell>
                {isMediaEditableContentType(row.content_type) ? (
                  <Link
                    href={`/admin/content/media/${row.id}`}
                    className="block truncate text-base font-bold text-white transition hover:text-[#F4D99A]"
                  >
                    {row.title || "بدون عنوان"}
                  </Link>
                ) : (
                  <h3 className="truncate text-base font-bold text-white">{row.title || "بدون عنوان"}</h3>
                )}
                {row.slug ? <p className="truncate font-en text-xs text-white/35">{row.slug}</p> : null}
              </AdminDataGridPrimaryCell>

              <AdminDataGridCenterCell>
                <MediaCategoryBadge label={row.category} contentType={row.content_type} />
              </AdminDataGridCenterCell>

              <AdminDataGridStatusCell>
                <span title={getStatusHint(row.status)}>
                  <AdminStatusPill tone={getStatusTone(row.status)}>{getStatusLabel(row.status)}</AdminStatusPill>
                </span>
              </AdminDataGridStatusCell>

              <MediaRowActions item={row} currentListPath={currentListPath} />
            </AdminDataGridRow>
          ))
        ) : (
          <AdminDataGridEmpty>
            <AdminListEmptyState
              title="لا يوجد محتوى مطابق"
              description="جرّب تعديل معايير البحث أو إعادة تعيين الفلاتر، أو أنشئ محتوى جديدًا."
              action={{ href: "/admin/content/media/new", label: "إضافة محتوى جديد" }}
            />
          </AdminDataGridEmpty>
        )}
      </AdminDataGrid>
    </div>
  );
}
