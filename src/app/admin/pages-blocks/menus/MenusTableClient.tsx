"use client";

import Link from "next/link";
import { useMemo } from "react";

import AdminNotice from "../../../../components/admin/AdminNotice";
import { ADMIN_LIST_PAGE } from "../../../../lib/admin/admin-ui-styles";
import {
  ADMIN_DATA_GRID_ACTION_COLUMNS,
  ADMIN_DATA_GRID_RULES,
  AdminDataGrid,
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridRow,
  AdminDataGridSortLabel,
  AdminPageHeader,
  AdminStatusPill,
} from "../../../../components/admin/ui";
import { useAdminTable } from "../../../../components/admin/table-engine";
import AddMenuPanelClient from "./AddMenuPanelClient";
import BulkMenuController from "./BulkMenuController";
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
};

type MenuSortKey = "name" | "slug" | "item_count" | "status";

/**
 * RTL table: القائمة (1fr, يمين) → … → الإجراءات (ثابت، شمال).
 */
const columns = `44px minmax(260px, 1fr) 120px 72px 96px ${ADMIN_DATA_GRID_ACTION_COLUMNS.fiveCompact}`;

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

export default function MenusTableClient({ menus, message }: MenusTableClientProps) {
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

  function sortProps(key: MenuSortKey) {
    return {
      active: table.sort.key === key,
      direction: table.sort.direction,
      onClick: () => table.toggleSort(key),
    } as const;
  }

  return (
    <div className={ADMIN_LIST_PAGE.wrapper} dir="rtl">
      <AdminPageHeader
        eyebrow="Admin Panel"
        title="إدارة القوائم"
        description="هنا بتدير كل قوائم الموقع: القائمة الرئيسية، الموبايل، الفوتر، أو أي قائمة جديدة. الدخول على اسم القائمة يفتح Builder الشجرة الخاصة بها."
        meta={`${menus.length} قائمة`}
        actions={<AddMenuPanelClient />}
      />

      {message ? <AdminNotice variant="success" message={message} /> : null}

      <form id="bulk-menu-form" action={bulkMenuAction} />
      <BulkMenuController />

      <div className="bulk-menu-scope space-y-4">
        <div
          data-bulk-bar="menus"
          hidden
          className={ADMIN_LIST_PAGE.bulkBar}
        >
          <div className="text-sm font-bold text-white/72">
            تم تحديد <span data-bulk-count="menus" className="font-en text-[#D8B87A]">0</span> قائمة
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              form="bulk-menu-form"
              name="bulk_action"
              defaultValue="show"
              className="h-11 cursor-pointer rounded-2xl border border-white/10 bg-black/28 px-4 text-sm text-white outline-none focus:border-[#D8B87A]/45"
            >
              <option value="show">إظهار</option>
              <option value="hide">إخفاء</option>
              <option value="delete">حذف</option>
            </select>

            <button
              form="bulk-menu-form"
              className="h-11 cursor-pointer rounded-2xl border border-[#D8B87A]/30 bg-[#D8B87A] px-5 text-sm font-bold text-[#06101C] transition hover:bg-[#e4c88d]"
            >
              تنفيذ
            </button>

            <button
              type="button"
              data-bulk-clear="menus"
              className="h-11 cursor-pointer rounded-2xl border border-transparent px-4 text-sm font-semibold text-white/50 transition hover:text-white/80"
            >
              إلغاء التحديد
            </button>
          </div>
        </div>

        <AdminDataGrid summary={`${table.rows.length} قائمة`}>
          <AdminDataGridHeader columns={columns}>
            <div className="flex justify-center">
              <input
                type="checkbox"
                data-bulk-select-all="menus"
                className={ADMIN_DATA_GRID_RULES.checkbox}
                aria-label="تحديد كل القوائم"
              />
            </div>
            <div className="min-w-0 text-right">
              <AdminDataGridSortLabel {...sortProps("name")} className="justify-end">
                القائمة
              </AdminDataGridSortLabel>
            </div>
            <div className="text-center">
              <AdminDataGridSortLabel {...sortProps("slug")} className="justify-center">
                Slug
              </AdminDataGridSortLabel>
            </div>
            <div className="text-center">
              <AdminDataGridSortLabel {...sortProps("item_count")} className="justify-center">
                العناصر
              </AdminDataGridSortLabel>
            </div>
            <div className="text-center">
              <AdminDataGridSortLabel {...sortProps("status")} className="justify-center">
                الحالة
              </AdminDataGridSortLabel>
            </div>
            <div className="text-center">الإجراءات</div>
          </AdminDataGridHeader>

          {table.rows.length ? (
            table.rows.map((menu) => (
              <AdminDataGridRow key={menu.id} columns={columns} className="xl:items-center">
                <div className="flex justify-center">
                  <input
                    form="bulk-menu-form"
                    type="checkbox"
                    name="menu_ids"
                    value={menu.id}
                    data-bulk-item="menus"
                    className={ADMIN_DATA_GRID_RULES.checkbox}
                    aria-label={`تحديد ${menu.name}`}
                  />
                </div>

                <div className="min-w-0 text-right">
                  <Link
                    href={`/admin/pages-blocks/menus/${menu.id}`}
                    className="block truncate font-semibold text-white transition hover:text-[#D8B87A]"
                  >
                    {menu.name}
                  </Link>
                  <p className="mt-1 truncate text-xs text-white/38">{locationLabel(menu.location)}</p>
                </div>

                <div className="min-w-0 text-center">
                  <span className="font-en block truncate text-xs text-white/42">{menu.slug}</span>
                </div>

                <div className="text-center font-en text-sm tabular-nums text-white/60">{menu.item_count}</div>

                <div className="flex justify-center">
                  <AdminStatusPill tone={menu.is_active ? "green" : "gold"}>
                    {menuStatusLabel(menu.is_active)}
                  </AdminStatusPill>
                </div>

                <AdminDataGridActionsCell compact>
                  <AdminDataGridActionButton
                    action="edit"
                    href={`/admin/pages-blocks/menus/${menu.id}`}
                    size="compact"
                    title="فتح Builder الشجرة"
                  />

                  <AdminDataGridActionButton
                    href="/"
                    target="_blank"
                    tone="dark"
                    title="معاينة الموقع العام"
                    size="compact"
                  >
                    <PublicPreviewIcon />
                  </AdminDataGridActionButton>

                  <form action={toggleMenuVisibility} className="contents">
                    <input type="hidden" name="id" value={menu.id} />
                    <input type="hidden" name="is_active" value={menu.is_active ? "false" : "true"} />
                    <AdminDataGridActionButton
                      type="submit"
                      action="visibility"
                      size="compact"
                      hidden={menu.is_active}
                      title={menu.is_active ? "إخفاء" : "إظهار"}
                    />
                  </form>

                  <form action={duplicateMenu} className="contents">
                    <input type="hidden" name="id" value={menu.id} />
                    <AdminDataGridActionButton
                      type="submit"
                      action="duplicate"
                      size="compact"
                      title="تكرار القائمة بالكامل"
                    />
                  </form>

                  <form action={deleteMenu} className="contents">
                    <input type="hidden" name="id" value={menu.id} />
                    <AdminDataGridActionButton type="submit" action="delete" size="compact" title="حذف نهائي" />
                  </form>
                </AdminDataGridActionsCell>
              </AdminDataGridRow>
            ))
          ) : (
            <AdminDataGridEmpty>لا توجد قوائم بعد. اضغط «إضافة منيو» لإنشاء أول قائمة.</AdminDataGridEmpty>
          )}
        </AdminDataGrid>
      </div>
    </div>
  );
}
