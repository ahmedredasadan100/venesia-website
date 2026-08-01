"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AdminFeedbackRegion } from "../../../../components/admin/AdminFeedbackProvider";
import {
  ADMIN_DATA_GRID_ACTION_COLUMNS,
  ADMIN_DATA_GRID_COLUMNS,
  ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE,
  AdminBulkActionBar,
  AdminDataGridCheckbox,
  AdminDataGrid,
  AdminDataGridCenterCell,
  AdminDataGridCheckboxCell,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridPrimaryCell,
  AdminDataGridRow,
  AdminDataGridRowActions,
  AdminDataGridSortLabel,
  AdminDataGridStatusCell,
  AdminPageExperience,
  AdminPageHeader,
  AdminStatusPill,
  AdminTablePagination,
  type AdminRowActionsCapability,
  useAdminGridSelection,
} from "../../../../components/admin/ui";
import { useAdminTable } from "../../../../components/admin/table-engine";
import AddMenuPanelClient from "./AddMenuPanelClient";
import {
  bulkMenuAction,
  deleteMenu,
  duplicateMenu,
  toggleMenuVisibility,
} from "./actions";

export type MenuListRow = {
  id: number;
  name: string;
  slug: string;
  location: string;
  is_active: boolean;
  item_count: number;
};

type MenusTableClientProps = {
  menus: MenuListRow[];
  message?: string | null;
  messageWarning?: boolean;
  loadError?: string | null;
};

type MenuSortKey = "name" | "slug" | "item_count" | "status";

/**
 * RTL table: القائمة (1fr, يمين) → … → الإجراءات (ثابت، شمال).
 */
const columns = `${ADMIN_DATA_GRID_COLUMNS.checkbox} ${ADMIN_DATA_GRID_COLUMNS.primaryCompact} ${ADMIN_DATA_GRID_COLUMNS.slugCompact} ${ADMIN_DATA_GRID_COLUMNS.count} ${ADMIN_DATA_GRID_COLUMNS.statusStandard} ${ADMIN_DATA_GRID_ACTION_COLUMNS.threeCompact}`;
const PAGE_SIZE = Number(ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE);

function mutationFormData(fields: Record<string, string | number | boolean>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, String(value));
  return formData;
}

function locationLabel(location: string) {
  const labels: Record<string, string> = {
    main: "Header / Main",
    mobile: "Mobile",
    footer: "Footer",
    custom: "Custom",
  };

  return labels[location] ?? location;
}

function menuStatusLabel(isActive: boolean) {
  return isActive ? "ظاهرة" : "مخفية";
}

export default function MenusTableClient({
  menus,
  message,
  messageWarning = false,
  loadError = null,
}: MenusTableClientProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [pendingRowId, setPendingRowId] = useState<number | null>(null);
  const sortAccessors = useMemo(
    () => ({
      name: (item: MenuListRow) => item.name,
      slug: (item: MenuListRow) => item.slug,
      item_count: (item: MenuListRow) => item.item_count,
      status: (item: MenuListRow) => menuStatusLabel(item.is_active),
    }),
    [],
  );

  const table = useAdminTable<MenuListRow, MenuSortKey>({
    initialRows: menus,
    getRowId: (item) => item.id,
    sortAccessors,
  });
  const totalPages = Math.max(1, Math.ceil(table.rows.length / pageSize));
  const resolvedCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRows = useMemo(
    () => table.rows.slice((resolvedCurrentPage - 1) * pageSize, resolvedCurrentPage * pageSize),
    [pageSize, resolvedCurrentPage, table.rows],
  );
  const visibleIds = useMemo(() => paginatedRows.map((row) => row.id), [paginatedRows]);
  const selection = useAdminGridSelection<number>(visibleIds);

  async function runMenuMutation(rowId: number, action: () => Promise<void>) {
    setPendingRowId(rowId);
    try {
      await action();
    } finally {
      setPendingRowId(null);
    }
  }

  function sortProps(key: MenuSortKey) {
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
        title="إدارة القوائم"
        description="هنا بتدير كل قوائم الموقع: القائمة الرئيسية، الموبايل، الفوتر، أو أي قائمة جديدة. الدخول على اسم القائمة يفتح Builder الشجرة الخاصة بها."
        meta={`${menus.length} قائمة`}
        actions={loadError ? undefined : <AddMenuPanelClient />}
      />

      <AdminFeedbackRegion
        channel="menu-builder:list"
        label="نتائج إجراءات القوائم"
        feedback={
          loadError
            ? {
                variant: "danger",
                title: "تعذر تحميل القوائم",
                message: loadError,
                layout: "inline",
                dismissible: true,
                lifecycle: "persistent",
              }
            : message
              ? {
                  variant: messageWarning ? "warning" : "success",
                  title: messageWarning ? "تم الحفظ مع تنبيه" : "تم تنفيذ الإجراء",
                  message,
                  layout: "inline",
                  dismissible: true,
                  lifecycle: "manual",
                  dismissSearchParams: ["message", "notice"],
                }
              : null
        }
      />

      <div className="space-y-4">
        <AdminBulkActionBar
          selectedIds={selection.selectedIds}
          entityLabel="قائمة"
          action={bulkMenuAction}
          options={[
            { value: "show", label: "إظهار" },
            { value: "hide", label: "إخفاء" },
            { value: "delete", label: "حذف" },
          ]}
          idsFieldName="menu_ids"
          onClearSelection={selection.clearSelection}
        />

        <AdminDataGrid summary={`${table.rows.length} قائمة`}>
          <AdminDataGridHeader columns={columns}>
            <AdminDataGridCheckboxCell>
              <AdminDataGridCheckbox
                inputRef={selection.selectAllRef}
                checked={selection.allSelected}
                onChange={(event) => selection.toggleAll(event.currentTarget.checked)}
                label="تحديد كل القوائم"
              />
            </AdminDataGridCheckboxCell>
            <AdminDataGridPrimaryCell>
              <AdminDataGridSortLabel {...sortProps("name")} className="justify-end">
                القائمة
              </AdminDataGridSortLabel>
            </AdminDataGridPrimaryCell>
            <AdminDataGridCenterCell>
              <AdminDataGridSortLabel {...sortProps("slug")} className="justify-center">
                Slug
              </AdminDataGridSortLabel>
            </AdminDataGridCenterCell>
            <AdminDataGridCenterCell>
              <AdminDataGridSortLabel {...sortProps("item_count")} className="justify-center">
                العناصر
              </AdminDataGridSortLabel>
            </AdminDataGridCenterCell>
            <AdminDataGridCenterCell>
              <AdminDataGridSortLabel {...sortProps("status")} className="justify-center">
                الحالة
              </AdminDataGridSortLabel>
            </AdminDataGridCenterCell>
            <div className="text-center">الإجراءات</div>
          </AdminDataGridHeader>

          {paginatedRows.length ? (
            paginatedRows.map((menu) => {
              const rowPending = pendingRowId === menu.id;
              const hidden = { access: "hidden" as const };
              const capability: AdminRowActionsCapability = {
                entityType: "menu",
                entityId: menu.id,
                entityLabel: menu.name,
                actions: {
                  edit: { access: "allowed", href: `/admin/pages-blocks/menus/${menu.id}` },
                  preview: {
                    access: "disabled",
                    disabledReason: "القائمة لا تملك مسار معاينة عامًا خاصًا بها.",
                  },
                  information: {
                    access: "allowed",
                    title: `معلومات ${menu.name}`,
                    items: [
                      { label: "Slug", value: menu.slug },
                      { label: "الموقع", value: locationLabel(menu.location) },
                      { label: "عدد العناصر", value: String(menu.item_count) },
                      { label: "الحالة", value: menuStatusLabel(menu.is_active) },
                    ],
                  },
                  copyPublicLink: hidden,
                  visibility: {
                    access: "allowed",
                    isVisible: menu.is_active,
                    pending: rowPending,
                    onSelect: () =>
                      runMenuMutation(
                        menu.id,
                        () => toggleMenuVisibility(mutationFormData({ id: menu.id, is_active: !menu.is_active })),
                      ),
                  },
                  featured: hidden,
                  duplicate: {
                    access: "allowed",
                    pending: rowPending,
                    onSelect: () =>
                      runMenuMutation(
                        menu.id,
                        () => duplicateMenu(mutationFormData({ id: menu.id })),
                      ),
                  },
                  archive: hidden,
                  delete: {
                    access: "allowed",
                    pending: rowPending,
                    onSelect: () =>
                      runMenuMutation(
                        menu.id,
                        () => deleteMenu(mutationFormData({ id: menu.id })),
                      ),
                    confirmation: {
                      mode: "shared",
                      title: "تأكيد حذف القائمة",
                      description: `حذف القائمة «${menu.name}» نهائيًا مع عناصرها؟`,
                      confirmLabel: "حذف القائمة",
                    },
                  },
                },
              };

              return (
              <AdminDataGridRow key={menu.id} columns={columns}>
                <AdminDataGridCheckboxCell>
                  <AdminDataGridCheckbox
                    checked={selection.selectedSet.has(menu.id)}
                    onChange={(event) => selection.toggleOne(menu.id, event.currentTarget.checked)}
                    label={`تحديد ${menu.name}`}
                  />
                </AdminDataGridCheckboxCell>

                <AdminDataGridPrimaryCell>
                  <Link
                    href={`/admin/pages-blocks/menus/${menu.id}`}
                    className="block truncate font-semibold text-white transition hover:text-[#D8B87A]"
                  >
                    {menu.name}
                  </Link>
                  <p className="mt-1 truncate text-xs text-white/38">{locationLabel(menu.location)}</p>
                </AdminDataGridPrimaryCell>

                <AdminDataGridCenterCell>
                  <span className="font-en block truncate text-xs text-white/42">{menu.slug}</span>
                </AdminDataGridCenterCell>

                <AdminDataGridCenterCell className="font-en text-sm tabular-nums text-white/60">{menu.item_count}</AdminDataGridCenterCell>

                <AdminDataGridStatusCell>
                  <AdminStatusPill tone={menu.is_active ? "green" : "gold"}>
                    {menuStatusLabel(menu.is_active)}
                  </AdminStatusPill>
                </AdminDataGridStatusCell>

                <AdminDataGridRowActions capability={capability} size="compact" />
              </AdminDataGridRow>
              );
            })
          ) : (
            <AdminDataGridEmpty>لا توجد قوائم بعد. اضغط «إضافة منيو» لإنشاء أول قائمة.</AdminDataGridEmpty>
          )}
        </AdminDataGrid>

        <AdminTablePagination
          basePath="/admin/pages-blocks/menus"
          currentPage={resolvedCurrentPage}
          totalPages={totalPages}
          totalCount={table.rows.length}
          pageSize={String(pageSize)}
          onPageChange={setCurrentPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setCurrentPage(1);
          }}
          pending={pendingRowId !== null}
        />
      </div>
    </AdminPageExperience>
  );
}
