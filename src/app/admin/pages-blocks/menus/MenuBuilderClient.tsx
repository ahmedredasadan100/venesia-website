"use client";

import Link from "next/link";

import { AdminFeedbackRegion } from "../../../../components/admin/AdminFeedbackProvider";
import AdminModuleTabs from "../../../../components/admin/ui/AdminModuleTabs";
import { AdminCard } from "../../../../components/admin/ui";

import { createMenuItem, updateMenu } from "./actions";
import MenuItemForm from "./MenuItemForm";
import MenuItemsTableClient from "./MenuItemsTableClient";
import type { Menu, MenuItem } from "./menu-builder-shared";
import { menuFieldClassName, menuLabelClassName } from "./menu-builder-shared";

type MenuBuilderClientProps = {
  menu: Menu;
  items: MenuItem[];
  databaseReady: boolean;
  message?: string | null;
  messageWarning?: boolean;
  loadError?: string | null;
};

export default function MenuBuilderClient({
  menu,
  items,
  databaseReady,
  message,
  messageWarning = false,
  loadError = null,
}: MenuBuilderClientProps) {
  const tabs = [
    {
      id: "items",
      label: "القائمة الرئيسية",
      content: (
        <AdminCard className="p-5 md:p-6">
          <MenuItemsTableClient menu={menu} items={items} />
        </AdminCard>
      ),
    },
    {
      id: "menu-settings",
      label: "بيانات القائمة",
      content: (
        <AdminCard className="p-5 md:p-6">
          <h3 className="text-lg font-semibold text-white">بيانات القائمة</h3>
          <p className="mt-1 text-sm text-white/45">الاسم، الـ slug، الموقع، وحالة التفعيل.</p>
          <form action={updateMenu} className="mt-5 grid max-w-2xl gap-4">
            <input type="hidden" name="id" value={menu.id} />
            <label className={menuLabelClassName()}>
              الاسم
              <input name="name" defaultValue={menu.name} className={menuFieldClassName("w-full")} />
            </label>
            <label className={menuLabelClassName()}>
              Slug
              <input name="slug" defaultValue={menu.slug} className={menuFieldClassName("w-full text-left dir-ltr")} />
            </label>
            <label className={menuLabelClassName()}>
              Location
              <select name="location" defaultValue={menu.location} className={menuFieldClassName("w-full")}>
                <option value="main">Header / Main</option>
                <option value="mobile">Mobile</option>
                <option value="footer">Footer</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-white/62">
              <input type="checkbox" name="is_active" defaultChecked={menu.is_active} className="size-4 accent-[#D8B87A]" />
              نشطة
            </label>
            <button className="min-h-11 w-fit rounded-2xl bg-[#D8B87A] px-5 text-sm font-semibold text-[#05070B] transition hover:bg-[#E6C985]">
              حفظ بيانات القائمة
            </button>
          </form>
        </AdminCard>
      ),
    },
    {
      id: "add-item",
      label: "إضافة عنصر جديد",
      content: (
        <AdminCard className="p-5 md:p-6">
          <h3 className="text-lg font-semibold text-white">إضافة عنصر جديد</h3>
          <p className="mt-1 text-sm leading-7 text-white/45">
            العنصر الجديد يضاف داخل هذه القائمة فقط. يمكن جعله Parent أو ربطه بصفحة/موضوع/تصنيف/مشروع.
          </p>
          <div className="mt-5">
            <MenuItemForm
              menu={menu}
              parentItems={items}
              action={createMenuItem}
              submitLabel="إضافة"
            />
          </div>
        </AdminCard>
      ),
    },
  ];

  return (
    <div className="contents" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/pages-blocks/menus"
          className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/58 transition hover:border-[#D8B87A]/30 hover:text-[#D8B87A]"
        >
          ← الرجوع لكل القوائم
        </Link>
        <span
          className={
            databaseReady
              ? "rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs text-emerald-300"
              : "rounded-full border border-[#D8B87A]/25 bg-[#D8B87A]/10 px-4 py-2 text-xs text-[#F4D99A]"
          }
        >
          {databaseReady ? "Database Ready" : "Fallback محتمل حتى تجهز الداتا"}
        </span>
      </div>

      <AdminFeedbackRegion
        channel={`menu-builder:${menu.id}`}
        label="نتائج محرر القائمة"
        feedback={
          loadError
            ? {
                variant: "danger",
                title: "تعذر تحميل عناصر القائمة",
                message: loadError,
                layout: "inline",
                dismissible: true,
                lifecycle: "persistent",
              }
            : message
              ? {
                  variant: messageWarning ? "warning" : "success",
                  title: messageWarning ? "تم الحفظ مع تنبيه" : "تم الحفظ",
                  message,
                  layout: "inline",
                  dismissible: true,
                  lifecycle: "manual",
                  dismissSearchParams: ["message", "notice"],
                }
              : null
        }
      />

      <AdminCard className="p-5 md:p-6">
        <AdminModuleTabs tabs={tabs} />
      </AdminCard>
    </div>
  );
}
