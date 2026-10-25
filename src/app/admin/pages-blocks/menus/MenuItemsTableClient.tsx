"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import VenesiaModal from "../../../../components/admin/VenesiaModal";
import {
  AdminFeedbackRegion,
  useAdminFeedback,
} from "../../../../components/admin/AdminFeedbackProvider";
import AdminEntityListFilters from "../../../../components/admin/entity-list/AdminEntityListFilters";
import {
  ADMIN_DATA_GRID_ACTION_COLUMNS,
  ADMIN_DATA_GRID_COLUMNS,
  ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE,
  AdminColumnVisibilityMenu,
  AdminDataGrid,
  AdminDataGridActionButton,
  AdminDataGridActionsHeaderCell,
  AdminDataGridCenterCell,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridPrimaryCell,
  AdminDataGridReorderHandle,
  AdminDataGridRow,
  AdminDataGridRowActions,
  AdminDataGridStatusCell,
  AdminTablePagination,
  type AdminRowActionsCapability,
} from "../../../../components/admin/ui";
import {
  adminCollectionSearchIncludes,
  useAdminBoundedClientPagination,
  type AdminBoundedClientQueryContract,
  type AdminEntityFilterDef,
} from "../../../../lib/admin/entity-list";
import {
  useAdminBoundedClientInstantMutation,
  type AdminEntityMutationRequest,
} from "../../../../lib/admin/entity-list/data-engine/instant-mutation";
import { resolvePublicPreviewHref } from "../../../../lib/admin/links/validate";
import {
  getPageCompositionColumnPreferenceConfig,
  getPageCompositionDefaultColumnKeys,
  normalizePageCompositionVisibleColumnKeys,
} from "../../../../lib/page-blocks/admin-collection-columns";

import {
  deleteMenuItem,
  reorderMenuItems,
  toggleMenuItemVisibility,
  updateMenuItem,
} from "./actions";
import MenuItemForm from "./MenuItemForm";
import type { Menu, MenuItem } from "./menu-builder-shared";
import {
  collectMenuItemDescendantIds,
  flattenMenuItemsForTable,
  getMenuItemTypeLabel,
} from "./menu-builder-shared";
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
  const router = useRouter();
  const { publishFeedback, clearFeedback } = useAdminFeedback();
  const feedbackChannel = `menu-builder:${menu.id}`;
  const instant = useAdminBoundedClientInstantMutation<MenuItem>({
    entity: "menu-items",
    initialRows: items,
    datasetKey: String(menu.id),
  });
  const activeItems = instant.rows;
  const rows = useMemo(
    () => flattenMenuItemsForTable(activeItems),
    [activeItems],
  );
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const draggedItemIdRef = useRef<number | null>(null);
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
        ADMIN_DATA_GRID_COLUMNS.primaryCompact,
        visibleColumnSet.has("order") ? ADMIN_DATA_GRID_COLUMNS.reorder : null,
        visibleColumnSet.has("order") ? ADMIN_DATA_GRID_COLUMNS.count : null,
        visibleColumnSet.has("status") ? ADMIN_DATA_GRID_COLUMNS.statusCompact : null,
        ADMIN_DATA_GRID_ACTION_COLUMNS.threeCompact,
      ]
        .filter((column) => column !== null)
        .join(" "),
    [visibleColumnSet],
  );
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
      options: [...new Set(activeItems.map((item) => item.item_type))].map((value) => ({
        value,
        label: getMenuItemTypeLabel(value),
      })),
    },
  ], [activeItems]);
  const queryContract = useMemo<
    AdminBoundedClientQueryContract<(typeof rows)[number]>
  >(
    () => ({
      mode: "bounded-client",
      search: { minLength: 1 },
      filters,
      matchesRow: ({ item, parentLabel }, query) => {
      if (
        query.search &&
        !adminCollectionSearchIncludes(
          `${item.label} ${item.href ?? ""} ${parentLabel ?? ""} ${item.linked_type ?? ""} ${item.linked_id ?? ""}`,
          query.search,
        )
      ) return false;
      const visibility = query.filters.visibility;
      const itemType = query.filters.item_type;
      if (visibility !== "all" && (item.is_visible ? "visible" : "hidden") !== visibility) return false;
      return itemType === "all" || item.item_type === itemType;
      },
      getRowId: ({ item }) => item.id,
    }),
    [filters],
  );
  const pagination = useAdminBoundedClientPagination({
    rows,
    datasetKey: String(menu.id),
    queryContract,
    defaultPageSize: PAGE_SIZE,
  });
  const search = pagination.search;
  const visibility = pagination.filterValues.visibility;
  const itemType = pagination.filterValues.item_type;
  const paginatedRows = pagination.rows;
  const manualReorderEnabled = !search && visibility === "all" && itemType === "all";
  const { getRowInteraction } = instant;
  const keyboardReorderFocusRef = useRef<{
    itemId: number;
    trigger: HTMLButtonElement;
    region: HTMLElement | null;
  } | null>(null);

  useEffect(() => {
    const intent = keyboardReorderFocusRef.current;
    if (
      !intent || getRowInteraction(intent.itemId).isPending ||
      (intent.trigger.isConnected && intent.trigger.disabled)
    ) return;
    keyboardReorderFocusRef.current = null;
    if (document.activeElement === document.body) {
      const target = intent.trigger.isConnected ? intent.trigger : intent.region;
      if (target?.isConnected) target.focus({ preventScroll: true });
    }
  }, [getRowInteraction, rows]);

  function itemSiblings(item: MenuItem) {
    return activeItems
      .filter((candidate) => candidate.parent_id === item.parent_id)
      .sort((left, right) => left.sort_order - right.sort_order || left.id - right.id);
  }

  function siblingMutationPending(item: MenuItem) {
    return itemSiblings(item).some((candidate) => instant.getRowInteraction(candidate.id).isPending);
  }

  async function runMenuItemMutation(
    request: AdminEntityMutationRequest<MenuItem>,
  ) {
    clearFeedback(feedbackChannel);
    try {
      const result = await instant.mutateAsync(request);
      publishFeedback(
        {
          variant:
            result.feedbackStatus === "warning" ? "warning" : "success",
          title:
            result.feedbackStatus === "warning"
              ? "تم الحفظ مع تنبيه"
              : "تم تنفيذ الإجراء",
          message: result.message,
          layout: "inline",
          dismissible: true,
          lifecycle: "manual",
        },
        { channel: feedbackChannel, placement: "global" },
      );
      router.refresh();
    } catch (error) {
      publishFeedback(
        {
          variant: "danger",
          title: "تعذر تنفيذ الإجراء",
          message:
            error instanceof Error
              ? error.message
              : "تعذر تنفيذ العملية. حاول مرة أخرى.",
          layout: "inline",
          dismissible: true,
          lifecycle: "manual",
        },
        {
          channel: feedbackChannel,
          placement: "global",
          reveal: true,
        },
      );
    }
  }

  async function moveSiblingTo(item: MenuItem, target: number, action = "reorder") {
    if (!manualReorderEnabled || siblingMutationPending(item)) return;
    const siblings = itemSiblings(item);
    const index = siblings.findIndex((candidate) => candidate.id === item.id);
    if (index < 0 || !Number.isSafeInteger(target) || target < 0 || target >= siblings.length || target === index) return;
    const ordered = [...siblings];
    const [moved] = ordered.splice(index, 1);
    ordered.splice(target, 0, moved);
    const sortOrderById = new Map(
      ordered.map((candidate, position) => [
        candidate.id,
        siblings[position].sort_order,
      ]),
    );
    await runMenuItemMutation({
      rowId: item.id,
      action,
      optimistic: (cache) =>
        cache.patchRows((candidate) =>
          sortOrderById.has(candidate.id)
            ? {
                ...candidate,
                sort_order:
                  sortOrderById.get(candidate.id) ?? candidate.sort_order,
              }
            : candidate,
        ),
      execute: () =>
        reorderMenuItems(
          menu.id,
          item.parent_id,
          ordered.map(({ id, updated_at }) => ({ id, updated_at })),
        ),
    });
  }

  async function moveSibling(item: MenuItem, direction: -1 | 1) {
    const index = itemSiblings(item).findIndex((candidate) => candidate.id === item.id);
    if (index < 0) return;
    await moveSiblingTo(item, index + direction, direction < 0 ? "reorder-up" : "reorder-down");
  }

  return (
    <div
      className="space-y-4"
      onFocusCapture={(event) => {
        const control = event.target;
        if (
          control instanceof HTMLElement &&
          (control.matches("[data-admin-grid-reorder-handle]") ||
            control.closest("[data-menu-item-reorder-arrows]") ||
            control.closest('[data-admin-row-action="visibility"]'))
        ) control.scrollIntoView({ block: "nearest", inline: "start" });
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">القائمة الرئيسية</h3>
          <p className="mt-1 text-sm text-white/45">
            الهرمية والرابط داخل اسم العنصر، وإعادة الترتيب تُحفظ عبر عقد القائمة الذري.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-[#D8B87A]/20 px-4 py-2 text-xs text-[#D8B87A]">
            {activeItems.length} عنصر
          </span>
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
        </div>
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
        onQueryPatch={pagination.applyQueryPatch}
      />

      <AdminDataGrid surface="standalone">
        <AdminDataGridHeader columns={columns} horizontalScroll>
          <AdminDataGridPrimaryCell presentation="text-only">اسم العنصر</AdminDataGridPrimaryCell>
          {visibleColumnSet.has("order") ? (
            <>
              <AdminDataGridCenterCell>سحب</AdminDataGridCenterCell>
              <AdminDataGridCenterCell>ترتيب</AdminDataGridCenterCell>
            </>
          ) : null}
          {visibleColumnSet.has("status") ? (
            <AdminDataGridStatusCell>الحالة</AdminDataGridStatusCell>
          ) : null}
          <AdminDataGridActionsHeaderCell>الإجراءات</AdminDataGridActionsHeaderCell>
        </AdminDataGridHeader>

        {paginatedRows.length ? (
          paginatedRows.map(({ item, level, isLastSibling, ancestorLines }, rowIndex) => {
            const hasChildren = activeItems.some(
              (row) => row.parent_id === item.id,
            );
            const previewHref = resolvePublicPreviewHref(item.href);
            const hidden = { access: "hidden" as const };
            const interaction = instant.getRowInteraction(item.id);
            const pendingAction = interaction.pendingAction;
            const siblings = itemSiblings(item);
            const reorderPosition = siblings.findIndex((candidate) => candidate.id === item.id);
            const reorderPending = siblingMutationPending(item);
            const capability: AdminRowActionsCapability = {
              entityType: "menu_item",
              entityId: item.id,
              entityLabel: item.label,
              actions: {
                edit: {
                  access: "allowed",
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
                  pending: pendingAction === "visibility",
                  onSelect: () =>
                    runMenuItemMutation({
                      rowId: item.id,
                      action: "visibility",
                      optimistic: (cache) =>
                        cache.patchRows((candidate) =>
                          candidate.id === item.id
                            ? {
                              ...candidate,
                              is_visible: !item.is_visible,
                            }
                            : candidate,
                        ),
                      execute: () =>
                        toggleMenuItemVisibility(
                          mutationFormData({
                            id: item.id,
                            menu_id: menu.id,
                            is_visible: !item.is_visible,
                          }),
                        ),
                    }),
                },
                featured: hidden,
                duplicate: hidden,
                archive: hidden,
                delete: {
                  access: "allowed",
                  pending: pendingAction === "delete",
                  onSelect: () => {
                    const affectedIds = new Set(
                      collectMenuItemDescendantIds(
                        item.id,
                        activeItems,
                      ),
                    );
                    return runMenuItemMutation({
                      rowId: item.id,
                      action: "delete",
                      optimistic: (cache) =>
                        cache.removeRows(affectedIds),
                      execute: () =>
                        deleteMenuItem(
                          mutationFormData({
                            id: item.id,
                            menu_id: menu.id,
                          }),
                        ),
                    });
                  },
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
              <AdminDataGridRow key={item.id} columns={columns} horizontalScroll divided={rowIndex > 0}>
                <AdminDataGridPrimaryCell presentation="text-only">
                  <MenuItemNameCell
                    label={item.label}
                    href={item.href}
                    level={level}
                    isLastSibling={isLastSibling}
                    ancestorLines={ancestorLines}
                    hasChildren={hasChildren}
                  />
                </AdminDataGridPrimaryCell>
                {visibleColumnSet.has("order") ? (
                  <>
                    <AdminDataGridCenterCell>
                      <AdminDataGridReorderHandle
                        label={item.label}
                        position={reorderPosition}
                        count={siblings.length}
                        disabled={!manualReorderEnabled || reorderPending}
                        pending={pendingAction?.startsWith("reorder") ?? false}
                        disabledReason={reorderPending ? "انتظر انتهاء الإجراء الحالي على عناصر المستوى نفسه." : siblings.length < 2 ? "لا يوجد عنصر آخر في المستوى نفسه لإعادة ترتيبه." : "ألغِ البحث والفلاتر لاستخدام الترتيب اليدوي."}
                        onMoveTo={(position) => {
                          const trigger = document.activeElement;
                          keyboardReorderFocusRef.current =
                            trigger instanceof HTMLButtonElement
                              ? {
                                  itemId: item.id,
                                  trigger,
                                  region: trigger.closest<HTMLElement>("[data-admin-data-grid-scroll]"),
                                }
                              : null;
                          void moveSiblingTo(item, position);
                        }}
                        onDragStart={(event) => {
                          if (!manualReorderEnabled || reorderPending) {
                            event.preventDefault();
                            return;
                          }
                          draggedItemIdRef.current = item.id;
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", String(item.id));
                        }}
                        onDragOver={(event) => {
                          const source = activeItems.find((candidate) => candidate.id === draggedItemIdRef.current);
                          if (!manualReorderEnabled || reorderPending || !source || source.parent_id !== item.parent_id) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const source = activeItems.find((candidate) => candidate.id === draggedItemIdRef.current);
                          draggedItemIdRef.current = null;
                          if (!manualReorderEnabled || reorderPending || !source || source.parent_id !== item.parent_id) return;
                          void moveSiblingTo(source, reorderPosition);
                        }}
                        onDragEnd={() => {
                          draggedItemIdRef.current = null;
                        }}
                      />
                    </AdminDataGridCenterCell>
                    <AdminDataGridCenterCell>
                      <span data-menu-item-reorder-arrows="" className="inline-flex items-center justify-center gap-1">
                        <AdminDataGridActionButton
                          size="inline"
                          title="تحريك لأعلى"
                          disabled={
                            !manualReorderEnabled || reorderPending ||
                            !activeItems.some(
                              (candidate) =>
                                candidate.parent_id === item.parent_id &&
                                candidate.sort_order < item.sort_order,
                            )
                          }
                          pending={pendingAction === "reorder-up"}
                          onClick={() => void moveSibling(item, -1)}
                        >↑</AdminDataGridActionButton>
                        <AdminDataGridActionButton
                          size="inline"
                          title="تحريك لأسفل"
                          disabled={
                            !manualReorderEnabled || reorderPending ||
                            !activeItems.some(
                              (candidate) =>
                                candidate.parent_id === item.parent_id &&
                                candidate.sort_order > item.sort_order,
                            )
                          }
                          pending={pendingAction === "reorder-down"}
                          onClick={() => void moveSibling(item, 1)}
                        >↓</AdminDataGridActionButton>
                      </span>
                    </AdminDataGridCenterCell>
                  </>
                ) : null}

                {visibleColumnSet.has("status") ? (
                  <AdminDataGridStatusCell>
                    <AdminDataGridRowActions capability={capability} display="visibility" size="compact" />
                  </AdminDataGridStatusCell>
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
            parentItems={activeItems}
            item={editingItem}
            action={updateMenuItem}
            submitLabel="حفظ"
          />
        ) : null}
      </VenesiaModal>
    </div>
  );
}
