"use client";

import Link from "next/link";
import { useMemo } from "react";

import AdminNotice from "../../../../components/admin/AdminNotice";
import { ADMIN_LIST_PAGE } from "../../../../lib/admin/admin-ui-styles";
import {
  CopyIcon,
  DownloadIcon,
  LayersIcon,
  MoreVerticalIcon,
  TrashIcon,
  UploadIcon,
  actionClassName,
} from "../../../../components/admin/AdminRowActions";
import {
  ADMIN_DATA_GRID_RULES,
  AdminDataGrid,
  AdminDataGridActionButton,
  AdminDataGridActions,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridRow,
  AdminPageHeader,
  AdminStatusPill,
} from "../../../../components/admin/ui";
import AddMenuPanelClient from "./AddMenuPanelClient";
import BulkMenuController from "./BulkMenuController";
import {
  bulkMenuAction,
  clearMenuItems,
  deleteMenu,
  duplicateMenu,
  importMenuJson,
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

const columns = `34px 42px minmax(220px,1fr) 150px 72px 96px ${ADMIN_LIST_PAGE.actionsColumnWidth}`;

function locationLabel(location: string) {
  const labels: Record<string, string> = {
    main: "Header / Main",
    mobile: "Mobile",
    footer: "Footer",
    custom: "Custom",
  };

  return labels[location] ?? location;
}

function MoreMenu({ menu }: { menu: MenuListRow }) {
  return (
    <details className="group relative inline-flex shrink-0">
      <summary
        title="إجراءات إضافية"
        aria-label="إجراءات إضافية"
        className={`${actionClassName("muted")} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
      >
        <MoreVerticalIcon />
      </summary>

      <div className="absolute end-0 top-12 z-[80] max-h-[70vh] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-[22px] border border-white/10 bg-[#080B10] p-2 text-right shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
        <Link
          href={`/admin/pages-blocks/menus/${menu.id}`}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm text-white/70 transition hover:bg-white/[0.045] hover:text-white"
        >
          <LayersIcon className="size-4 text-[#D8B87A]" />
          فتح Builder الشجرة
        </Link>

        <a
          href={`/api/admin/menus/${menu.id}/export`}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm text-white/70 transition hover:bg-white/[0.045] hover:text-white"
        >
          <DownloadIcon className="size-4 text-sky-300" />
          تصدير JSON
        </a>

        <form action={duplicateMenu}>
          <input type="hidden" name="id" value={menu.id} />
          <button className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-right text-sm text-white/70 transition hover:bg-white/[0.045] hover:text-white">
            <CopyIcon className="size-4 text-sky-300" />
            تكرار القائمة بالكامل
          </button>
        </form>

        <form action={clearMenuItems}>
          <input type="hidden" name="id" value={menu.id} />
          <button className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-right text-sm text-white/70 transition hover:bg-white/[0.045] hover:text-white">
            <TrashIcon className="size-4 text-red-300" />
            تفريغ العناصر فقط
          </button>
        </form>

        <details className="rounded-2xl px-3 py-3 text-sm text-white/70 open:bg-white/[0.025]">
          <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
            <UploadIcon className="size-4 text-emerald-300" />
            استيراد JSON
          </summary>
          <form action={importMenuJson} className="mt-3 grid gap-3">
            <input type="hidden" name="id" value={menu.id} />
            <input
              type="file"
              name="json_file"
              accept="application/json,.json"
              className="block w-full text-xs text-white/55 file:ml-3 file:rounded-xl file:border-0 file:bg-[#D8B87A] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#05070B]"
            />
            <button className="min-h-9 rounded-xl border border-emerald-400/18 text-xs text-emerald-300 transition hover:bg-emerald-400/10">
              استيراد كمسودة مخفية
            </button>
          </form>
        </details>

        <div className="my-2 h-px bg-white/10" />

        <form action={deleteMenu}>
          <input type="hidden" name="id" value={menu.id} />
          <button className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-right text-sm text-red-300 transition hover:bg-red-400/10">
            <TrashIcon className="size-4" />
            حذف نهائي
          </button>
        </form>
      </div>
    </details>
  );
}

export default function MenusTableClient({ menus, message }: MenusTableClientProps) {
  const sortedMenus = useMemo(
    () => [...menus].sort((a, b) => a.id - b.id),
    [menus],
  );

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

        <AdminDataGrid summary={`${sortedMenus.length} قائمة`}>
          <AdminDataGridHeader columns={columns}>
            <span className="text-center font-en text-white/45">#</span>
            <span className="flex justify-center">
              <input
                type="checkbox"
                data-bulk-select-all="menus"
                className={ADMIN_DATA_GRID_RULES.checkbox}
                aria-label="تحديد كل القوائم"
              />
            </span>
            <span className="text-right">القائمة</span>
            <span className="text-right">Slug</span>
            <span className="text-center">العناصر</span>
            <span className="text-center">الحالة</span>
            <span className="text-center">الإجراءات</span>
          </AdminDataGridHeader>

          {sortedMenus.length ? (
            sortedMenus.map((menu, index) => (
              <AdminDataGridRow key={menu.id} columns={columns} className="xl:items-center">
                <span className="text-center font-en text-white/40">{index + 1}</span>

                <span className="flex justify-center">
                  <input
                    form="bulk-menu-form"
                    type="checkbox"
                    name="menu_ids"
                    value={menu.id}
                    data-bulk-item="menus"
                    className={ADMIN_DATA_GRID_RULES.checkbox}
                    aria-label={`تحديد ${menu.name}`}
                  />
                </span>

                <div className="min-w-0 text-right">
                  <Link
                    href={`/admin/pages-blocks/menus/${menu.id}`}
                    className="font-semibold text-white transition hover:text-[#D8B87A]"
                  >
                    {menu.name}
                  </Link>
                  <p className="mt-1 text-xs text-white/38">{locationLabel(menu.location)}</p>
                </div>

                <div className="min-w-0 font-mono text-xs text-white/42">{menu.slug}</div>

                <div className="text-center text-white/60">{menu.item_count}</div>

                <div className="flex justify-center">
                  <AdminStatusPill tone={menu.is_active ? "green" : "gold"}>
                    {menu.is_active ? "ظاهرة" : "مخفية"}
                  </AdminStatusPill>
                </div>

                <AdminDataGridActions>
                  <AdminDataGridActionButton action="edit" href={`/admin/pages-blocks/menus/${menu.id}`} />

                  <form action={toggleMenuVisibility} className="inline-flex shrink-0">
                    <input type="hidden" name="id" value={menu.id} />
                    <input type="hidden" name="is_active" value={menu.is_active ? "false" : "true"} />
                    <AdminDataGridActionButton
                      type="submit"
                      action="visibility"
                      hidden={menu.is_active}
                      title={menu.is_active ? "إخفاء" : "إظهار"}
                    />
                  </form>

                  <form action={duplicateMenu} className="inline-flex shrink-0">
                    <input type="hidden" name="id" value={menu.id} />
                    <AdminDataGridActionButton type="submit" action="duplicate" />
                  </form>

                  <form action={deleteMenu} className="inline-flex shrink-0">
                    <input type="hidden" name="id" value={menu.id} />
                    <AdminDataGridActionButton type="submit" action="delete" />
                  </form>

                  <MoreMenu menu={menu} />
                </AdminDataGridActions>
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
