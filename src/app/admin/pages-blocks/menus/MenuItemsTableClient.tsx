"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import VenesiaModal from "../../../../components/admin/VenesiaModal";
import { AdminFeedbackRegion } from "../../../../components/admin/AdminFeedbackProvider";
import AdminEntityListFilters from "../../../../components/admin/entity-list/AdminEntityListFilters";
import {
  ADMIN_DATA_GRID_ACTION_COLUMNS,
  ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE,
  AdminColumnVisibilityMenu,
  AdminDataGrid,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridRow,
  AdminDataGridRowActions,
  AdminStatusPill,
  AdminTablePagination,
  type AdminRowActionsCapability,
} from "../../../../components/admin/ui";
import {
  adminCollectionSearchIncludes,
  applyAdminEntityUrlPatch,
  useAdminBoundedClientPagination,
  type AdminEntityFilterDef,
} from "../../../../lib/admin/entity-list";
import { resolvePublicPreviewHref } from "../../../../lib/admin/links/validate";
import {
  getPageCompositionColumnPreferenceConfig,
  getPageCompositionDefaultColumnKeys,
  normalizePageCompositionVisibleColumnKeys,
} from "../../../../lib/page-blocks/admin-collection-columns";

import {
  deleteMenuItem,
  toggleMenuItemVisibility,
  updateMenuItem,
} from "./actions";
import MenuItemForm from "./MenuItemForm";
import type { Menu, MenuItem } from "./menu-builder-shared";
import { flattenMenuItemsForTable, getMenuItemTypeLabel } from "./menu-builder-shared";
import {
  restorePageCompositionColumnPreferences,
  savePageCompositionColumnPreferences,
} from "../column-preferences";

const TREE_UNIT = 18;
const PAGE_SIZE = Number(ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE);

function mutationFormData(fields: Record<string, string | number | boolean>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, String(value));
  return formData;
}

function MenuFolderIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0 text-[#D8B87A]/70" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H8l1.5 2H15.5A1.5 1.5 0 0 1 17 8.5V14A1.5 1.5 0 0 1 15.5 15.5H4.5A1.5 1.5 0 0 1 3 14V6.5Z" />
    </svg>
  );
}

function MenuChildIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3 w-3 shrink-0 text-[#D8B87A]/35" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 6H6v8" />
      <path d="M6 14h6" />
    </svg>
  );
}

function MenuTreeGutter({
  level,
  isLastSibling,
  ancestorLines,
}: {
  level: number;
  isLastSibling: boolean;
  ancestorLines: boolean[];
}) {
  if (level === 0) return null;

  const width = level * TREE_UNIT;

  return (
    <div className="relative shrink-0 self-stretch" style={{ width }} aria-hidden="true">
      {ancestorLines.map((showLine, depth) =>
        showLine ? (
          <span
            key={`line-${depth}`}
            className="absolute top-0 bottom-0 w-px bg-[#D8B87A]/22"
            style={{ right: (level - depth) * TREE_UNIT - TREE_UNIT / 2 }}
          />
        ) : null,
      )}

      <span
        className="absolute w-px bg-[#D8B87A]/48"
        style={{
          right: TREE_UNIT / 2,
          top: 0,
          bottom: isLastSibling ? "50%" : 0,
        }}
      />
      <span
        className="absolute h-px bg-[#D8B87A]/48"
        style={{ right: TREE_UNIT / 2, top: "50%", width: TREE_UNIT / 2 }}
      />
    </div>
  );
}

function MenuItemHrefChip({ href }: { href: string | null }) {
  if (!href) {
    return <span className="text-[10px] text-white/28">—</span>;
  }

  return (
    <span
      className="mt-1.5 inline-flex max-w-full min-w-0 items-center rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] leading-4 text-white/45"
      dir="ltr"
      title={href}
    >
      <span className="truncate">{href}</span>
    </span>
  );
}

function MenuItemNameCell({
  label,
  href,
  level,
  isLastSibling,
  ancestorLines,
  hasChildren,
}: {
  label: string;
  href: string | null;
  level: number;
  isLastSibling: boolean;
  ancestorLines: boolean[];
  hasChildren: boolean;
}) {
  const isChild = level > 0;
  const isParent = hasChildren;

  return (
    <div className="flex min-w-0 items-start text-right" dir="rtl">
      <MenuTreeGutter level={level} isLastSibling={isLastSibling} ancestorLines={ancestorLines} />

      <div className="min-w-0 flex-1" style={{ paddingRight: isChild ? 6 : 0 }}>
        <div className="flex items-center justify-start gap-2">
          {isParent ? <MenuFolderIcon /> : null}
          {isChild ? <MenuChildIcon /> : null}

          <p
            className={`min-w-0 truncate ${
              isParent
                ? "text-[15px] font-bold text-white"
                : isChild
                  ? "text-sm font-medium text-white/68"
                  : "text-[15px] font-semibold text-white/92"
            }`}
          >
            {label}
          </p>
        </div>

        <div className={isParent || isChild ? "pr-5" : ""}>
          <MenuItemHrefChip href={href} />
        </div>
      </div>
    </div>
  );
}

type MenuItemsTableClientProps = {
  menu: Menu;
  items: MenuItem[];
  initialVisibleColumns?: readonly string[] | null;
  preferenceError?: string | null;
};

export default function MenuItemsTableClient({
  menu,
  items,
  initialVisibleColumns = null,
  preferenceError = null,
}: MenuItemsTableClientProps) {
  const searchParams = useSearchParams();
  const rows = useMemo(() => flattenMenuItemsForTable(items), [items]);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [pendingRowId, setPendingRowId] = useState<number | null>(null);
  const columnConfig = getPageCompositionColumnPreferenceConfig("menuItems");
  const defaultColumns = getPageCompositionDefaultColumnKeys("menuItems");
  const [visibleColumns, setVisibleColumns] = useState(() =>
    normalizePageCompositionVisibleColumnKeys(
      "menuItems",
      initialVisibleColumns,
    ),
  );
  const visibleColumnSet = useMemo(
    () => new Set(visibleColumns),
    [visibleColumns],
  );
  const columns = useMemo(
    () =>
      [
        visibleColumnSet.has("order") ? "48px" : null,
        "minmax(0,1fr)",
        visibleColumnSet.has("status") ? "88px" : null,
        ADMIN_DATA_GRID_ACTION_COLUMNS.threeCompact,
      ]
        .filter((column): column is string => Boolean(column))
        .join(" "),
    [visibleColumnSet],
  );
  const search = searchParams.get("q") ?? "";
  const visibility = searchParams.get("visibility") ?? "all";
  const itemType = searchParams.get("item_type") ?? "all";
  const filters = useMemo<readonly AdminEntityFilterDef[]>(() => [
    {
      id: "menu-items-visibility",
      paramKey: "visibility",
      label: "الظهور",
      type: "status",
      allValue: "all",
      placeholder: "الظهور",
      options: [
        { value: "visible", label: "ظاهر" },
        { value: "hidden", label: "مخفي" },
      ],
    },
    {
      id: "menu-items-type",
      paramKey: "item_type",
      label: "نوع العنصر",
      type: "single_select",
      allValue: "all",
      placeholder: "نوع العنصر",
      options: [...new Set(items.map((item) => item.item_type))].map((value) => ({
        value,
        label: getMenuItemTypeLabel(value),
      })),
    },
  ], [items]);
  const filteredRows = useMemo(
    () => rows.filter(({ item, parentLabel }) => {
      if (
        search &&
        !adminCollectionSearchIncludes(
          `${item.label} ${item.href ?? ""} ${parentLabel ?? ""} ${item.linked_type ?? ""} ${item.linked_id ?? ""}`,
          search,
        )
      ) return false;
      if (visibility !== "all" && (item.is_visible ? "visible" : "hidden") !== visibility) return false;
      return itemType === "all" || item.item_type === itemType;
    }),
    [itemType, rows, search, visibility],
  );
  const pagination = useAdminBoundedClientPagination({
    rows: filteredRows,
    datasetKey: `${menu.id}|${search}|${visibility}|${itemType}|${filteredRows.map(({ item }) => item.id).sort().join("|")}`,
    defaultPageSize: PAGE_SIZE,
  });
  const paginatedRows = pagination.rows;

  async function runMenuItemMutation(itemId: number, action: () => Promise<void>) {
    setPendingRowId(itemId);
    try {
      await action();
    } finally {
      setPendingRowId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">القائمة الرئيسية</h3>
          <p className="mt-1 text-sm text-white/45">
            الهرمية والرابط داخل اسم العنصر. إعادة الترتيب متوقفة حتى يتوفر عقد حفظ ذري.
          </p>
        </div>
        <span className="rounded-full border border-[#D8B87A]/20 px-4 py-2 text-xs text-[#D8B87A]">
          {items.length} عنصر
        </span>
      </div>

      <AdminFeedbackRegion
        channel={`menu-builder:${menu.id}:columns`}
        label="حالة تفضيلات أعمدة عناصر القائمة"
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

      <AdminEntityListFilters
        basePath={`/admin/pages-blocks/menus/${menu.id}`}
        search={{ value: search, placeholder: "ابحث بعنوان العنصر أو الرابط أو الكيان المرتبط…", minLength: 1 }}
        filters={filters}
        values={{ visibility, item_type: itemType }}
        columnsControl={
          <AdminColumnVisibilityMenu
            columns={columnConfig.columns}
            visibleColumns={visibleColumns}
            defaultColumns={defaultColumns}
            onChange={setVisibleColumns}
            onPersist={(next) =>
              savePageCompositionColumnPreferences("menuItems", next)
            }
            onRestore={() =>
              restorePageCompositionColumnPreferences("menuItems")
            }
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

      <AdminDataGrid className="!rounded-t-none !border-t-0">
        <AdminDataGridHeader columns={columns} className="gap-3">
          {visibleColumnSet.has("order") ? (
            <span className="text-center">#</span>
          ) : null}
          <span className="text-right">اسم العنصر</span>
          {visibleColumnSet.has("status") ? (
            <span className="text-center">الحالة</span>
          ) : null}
          <span className="text-center">الإجراءات</span>
        </AdminDataGridHeader>

        {paginatedRows.length ? (
          paginatedRows.map(({ item, level, isLastSibling, ancestorLines }) => {
            const hasChildren = items.some((row) => row.parent_id === item.id);
            const previewHref = resolvePublicPreviewHref(item.href);
            const hidden = { access: "hidden" as const };
            const rowPending = pendingRowId === item.id;
            const capability: AdminRowActionsCapability = {
              entityType: "menu_item",
              entityId: item.id,
              entityLabel: item.label,
              actions: {
                edit: {
                  access: "allowed",
                  pending: rowPending,
                  onSelect: () => setEditingItem(item),
                },
                preview: previewHref
                  ? { access: "allowed", href: previewHref, target: "_blank", rel: "noreferrer" }
                  : { access: "disabled", disabledReason: "لا يملك العنصر مسارًا عامًا مستقلاً يمكن معاينته من هنا." },
                information: {
                  access: "allowed",
                  title: `معلومات ${item.label}`,
                  items: [
                    { label: "الرابط", value: item.href ?? "بدون رابط" },
                    { label: "المستوى", value: String(level) },
                    { label: "الحالة", value: item.is_visible ? "ظاهر" : "مخفي" },
                  ],
                },
                copyPublicLink: hidden,
                visibility: {
                  access: "allowed",
                  isVisible: item.is_visible,
                  pending: rowPending,
                  onSelect: () =>
                    runMenuItemMutation(
                      item.id,
                      () =>
                        toggleMenuItemVisibility(
                          mutationFormData({
                            id: item.id,
                            menu_id: menu.id,
                            is_visible: !item.is_visible,
                          }),
                        ),
                    ),
                },
                featured: hidden,
                duplicate: hidden,
                archive: hidden,
                delete: {
                  access: "allowed",
                  pending: rowPending,
                  onSelect: () =>
                    runMenuItemMutation(
                      item.id,
                      () => deleteMenuItem(mutationFormData({ id: item.id, menu_id: menu.id })),
                    ),
                  confirmation: {
                    mode: "shared",
                    title: "تأكيد حذف عنصر القائمة",
                    description: `حذف العنصر «${item.label}» من ${menu.name}؟`,
                    confirmLabel: "حذف العنصر",
                  },
                },
              },
            };

            return (
              <AdminDataGridRow key={item.id} columns={columns} className="gap-3">
                {visibleColumnSet.has("order") ? (
                  <span className="text-center font-en text-sm text-white/45">{item.sort_order}</span>
                ) : null}

                <MenuItemNameCell
                  label={item.label}
                  href={item.href}
                  level={level}
                  isLastSibling={isLastSibling}
                  ancestorLines={ancestorLines}
                  hasChildren={hasChildren}
                />

                {visibleColumnSet.has("status") ? (
                  <span className="flex justify-center">
                    <AdminStatusPill tone={item.is_visible ? "green" : "muted"}>
                      {item.is_visible ? "ظاهر" : "مخفي"}
                    </AdminStatusPill>
                  </span>
                ) : null}

                <AdminDataGridRowActions capability={capability} size="compact" />
              </AdminDataGridRow>
            );
          })
        ) : (
          <AdminDataGridEmpty>القائمة فارغة. أضف أول عنصر من تاب «إضافة عنصر جديد».</AdminDataGridEmpty>
        )}
      </AdminDataGrid>

      <AdminTablePagination
        basePath={`/admin/pages-blocks/menus/${menu.id}`}
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        totalCount={pagination.totalCount}
        pageSize={String(pagination.pageSize)}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        pending={pendingRowId !== null}
      />

      <VenesiaModal
        open={Boolean(editingItem)}
        title="تعديل عنصر القائمة"
        description="نفس الحقول والتحقق السابق — بدون تغيير منطق الحفظ."
        size="lg"
        onClose={() => setEditingItem(null)}
      >
        {editingItem ? (
          <MenuItemForm
            key={editingItem.id}
            menu={menu}
            parentItems={items}
            item={editingItem}
            action={updateMenuItem}
            submitLabel="حفظ"
          />
        ) : null}
      </VenesiaModal>
    </div>
  );
}
