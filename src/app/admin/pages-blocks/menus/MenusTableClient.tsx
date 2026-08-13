"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { AdminFeedbackRegion } from "../../../../components/admin/AdminFeedbackProvider";
import AdminEntityListFilters from "../../../../components/admin/entity-list/AdminEntityListFilters";
import {
  ADMIN_DATA_GRID_ACTION_COLUMNS,
  ADMIN_DATA_GRID_COLUMNS,
  AdminBulkActionBar,
  AdminColumnVisibilityMenu,
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
import {
  adminCollectionSearchIncludes,
  applyAdminEntityUrlPatch,
  useAdminBoundedClientPagination,
  type AdminEntityFilterDef,
} from "../../../../lib/admin/entity-list";
import { ADMIN_BULK_ACTION_LABELS } from "../../../../lib/admin/entity-list/bulk-action-labels";
import {
  getPageCompositionColumnPreferenceConfig,
  getPageCompositionDefaultColumnKeys,
  normalizePageCompositionVisibleColumnKeys,
} from "../../../../lib/page-blocks/admin-collection-columns";
import AddMenuPanelClient from "./AddMenuPanelClient";
import {
  restorePageCompositionColumnPreferences,
  savePageCompositionColumnPreferences,
} from "../column-preferences";
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
  initialVisibleColumns?: readonly string[] | null;
  preferenceError?: string | null;
};

type MenuSortKey = "name" | "slug" | "item_count" | "status";

/**
 * RTL table: القائمة (1fr, يمين) → … → الإجراءات (ثابت، شمال).
 */
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
  initialVisibleColumns = null,
  preferenceError = null,
}: MenusTableClientProps) {
  const searchParams = useSearchParams();
  const [pendingRowId, setPendingRowId] = useState<number | null>(null);
  const columnConfig = getPageCompositionColumnPreferenceConfig("menus");
  const defaultColumns = getPageCompositionDefaultColumnKeys("menus");
  const [visibleColumns, setVisibleColumns] = useState(() =>
    normalizePageCompositionVisibleColumnKeys("menus", initialVisibleColumns),
  );
  const visibleColumnSet = useMemo(
    () => new Set(visibleColumns),
    [visibleColumns],
  );
  const columns = useMemo(
    () =>
      [
        ADMIN_DATA_GRID_COLUMNS.checkbox,
        ADMIN_DATA_GRID_COLUMNS.primaryCompact,
        visibleColumnSet.has("slug") ? ADMIN_DATA_GRID_COLUMNS.slugCompact : null,
        visibleColumnSet.has("itemCount") ? ADMIN_DATA_GRID_COLUMNS.count : null,
        visibleColumnSet.has("status") ? ADMIN_DATA_GRID_COLUMNS.statusStandard : null,
        ADMIN_DATA_GRID_ACTION_COLUMNS.threeCompact,
      ]
        .filter((column) => column !== null)
        .join(" "),
    [visibleColumnSet],
  );
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
  const search = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "all";
  const location = searchParams.get("location") ?? "all";
  const filters = useMemo<readonly AdminEntityFilterDef[]>(() => [
    {
      id: "menus-status",
      paramKey: "status",
      label: "الحالة",
      type: "status",
      allValue: "all",
      placeholder: "الحالة",
      options: [
        { value: "active", label: "ظاهرة" },
        { value: "inactive", label: "مخفية" },
      ],
    },
    {
      id: "menus-location",
      paramKey: "location",
      label: "الموقع",
      type: "single_select",
      allValue: "all",
      placeholder: "الموقع",
      options: [...new Set(menus.map((menu) => menu.location))].map((value) => ({
        value,
        label: locationLabel(value),
      })),
    },
  ], [menus]);
  const filteredRows = useMemo(
    () => table.rows.filter((menu) => {
      if (
        search &&
        !adminCollectionSearchIncludes(
          `${menu.name} ${menu.slug} ${menu.location} ${locationLabel(menu.location)}`,
          search,
        )
      ) return false;
      if (status !== "all" && (menu.is_active ? "active" : "inactive") !== status) return false;
      return location === "all" || menu.location === location;
    }),
    [location, search, status, table.rows],
  );
  const pagination = useAdminBoundedClientPagination({
    rows: filteredRows,
    datasetKey: `${search}|${status}|${location}|${filteredRows.map((row) => row.id).sort().join("|")}`,
  });
  const paginatedRows = pagination.rows;
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

      <AdminFeedbackRegion
        channel="menu-builder:list:columns"
        label="حالة تفضيلات أعمدة القوائم"
        feedback={
          preferenceError
            ? {
                variant: "warning",
                title: "تعذر تحميل تفضيلات الأعمدة",
                message: preferenceError,
                layout: "inline",
                dismissible: true,
                lifecycle: "persistent",
              }
            : null
        }
      />

      <div className="space-y-4">
        <AdminEntityListFilters
          basePath="/admin/pages-blocks/menus"
          search={{ value: search, placeholder: "ابحث باسم القائمة أو المفتاح أو الموقع…", minLength: 1 }}
          filters={filters}
          values={{ status, location }}
          columnsControl={
            <AdminColumnVisibilityMenu
              columns={columnConfig.columns}
              visibleColumns={visibleColumns}
              defaultColumns={defaultColumns}
              onChange={setVisibleColumns}
              onPersist={(next) =>
                savePageCompositionColumnPreferences("menus", next)
              }
              onRestore={() =>
                restorePageCompositionColumnPreferences("menus")
              }
            />
          }
          contextOverrideActive={selection.selectedIds.length > 0}
          contextOverride={
            <AdminBulkActionBar
              selectedIds={selection.selectedIds}
              entityLabel="قائمة"
              action={bulkMenuAction}
              options={[
                {
                  value: "show",
                  label: ADMIN_BULK_ACTION_LABELS.showSelected,
                },
                {
                  value: "hide",
                  label: ADMIN_BULK_ACTION_LABELS.hideSelected,
                },
                {
                  value: "delete",
                  label: ADMIN_BULK_ACTION_LABELS.deleteSelected,
                },
              ]}
              idsFieldName="menu_ids"
              onClearSelection={selection.clearSelection}
            />
          }
          onQueryPatch={(patch, behavior = "push") => {
            const next = applyAdminEntityUrlPatch(new URLSearchParams(window.location.search), patch);
            const query = next.toString();
            window.history[behavior === "replace" ? "replaceState" : "pushState"](
              window.history.state,
              "",
              `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
            );
          }}
        />

        <AdminDataGrid className="!rounded-t-none !border-t-0" summary={`${filteredRows.length} قائمة`}>
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
            {visibleColumnSet.has("slug") ? (
              <AdminDataGridCenterCell>
                <AdminDataGridSortLabel {...sortProps("slug")} className="justify-center">
                  Slug
                </AdminDataGridSortLabel>
              </AdminDataGridCenterCell>
            ) : null}
            {visibleColumnSet.has("itemCount") ? (
              <AdminDataGridCenterCell>
                <AdminDataGridSortLabel {...sortProps("item_count")} className="justify-center">
                  العناصر
                </AdminDataGridSortLabel>
              </AdminDataGridCenterCell>
            ) : null}
            {visibleColumnSet.has("status") ? (
              <AdminDataGridCenterCell>
                <AdminDataGridSortLabel {...sortProps("status")} className="justify-center">
                  الحالة
                </AdminDataGridSortLabel>
              </AdminDataGridCenterCell>
            ) : null}
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

                {visibleColumnSet.has("slug") ? (
                  <AdminDataGridCenterCell>
                    <span className="font-en block truncate text-xs text-white/42">{menu.slug}</span>
                  </AdminDataGridCenterCell>
                ) : null}

                {visibleColumnSet.has("itemCount") ? (
                  <AdminDataGridCenterCell className="font-en text-sm tabular-nums text-white/60">{menu.item_count}</AdminDataGridCenterCell>
                ) : null}

                {visibleColumnSet.has("status") ? (
                  <AdminDataGridStatusCell>
                    <AdminStatusPill tone={menu.is_active ? "green" : "gold"}>
                      {menuStatusLabel(menu.is_active)}
                    </AdminStatusPill>
                  </AdminDataGridStatusCell>
                ) : null}

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
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalCount={pagination.totalCount}
          pageSize={String(pagination.pageSize)}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </div>
    </AdminPageExperience>
  );
}
