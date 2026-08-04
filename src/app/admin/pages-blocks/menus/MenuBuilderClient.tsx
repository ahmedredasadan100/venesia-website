"use client";

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
  message?: string | null;
  messageWarning?: boolean;
  loadError?: string | null;
  initialVisibleColumns?: readonly string[] | null;
  preferenceError?: string | null;
};

export default function MenuBuilderClient({
  menu,
  items,
  message,
  messageWarning = false,
  loadError = null,
  initialVisibleColumns = null,
  preferenceError = null,
}: MenuBuilderClientProps) {
  const tabs = [
    {
      id: "items",
      navigationLabel: "العناصر",
      sectionHeading: "عناصر القائمة",
      sectionDescription: "أدر الروابط والعناصر الفرعية وترتيب ظهورها داخل هذه القائمة.",
      icon: "content" as const,
      content: (
        <AdminCard className="p-5 md:p-6">
          <MenuItemsTableClient
            menu={menu}
            items={items}
            initialVisibleColumns={initialVisibleColumns}
            preferenceError={preferenceError}
          />
        </AdminCard>
      ),
    },
    {
      id: "menu-settings",
      navigationLabel: "بيانات القائمة",
      sectionHeading: "بيانات القائمة",
      sectionDescription: "حدّث الاسم والمسار والموقع وحالة التفعيل لهذه القائمة.",
      icon: "settings" as const,
      content: (
        <AdminCard className="p-5 md:p-6">
          <form action={updateMenu} className="grid max-w-2xl gap-4">
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
      navigationLabel: "إضافة عنصر",
      sectionHeading: "إضافة عنصر جديد",
      sectionDescription: "أضف عنصرًا داخل هذه القائمة واربطه بالوجهة المناسبة.",
      icon: "section" as const,
      content: (
        <AdminCard className="p-5 md:p-6">
          <div>
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
      <AdminModuleTabs
        tabs={tabs}
        activePanelContext={
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
        }
      />
    </div>
  );
}
