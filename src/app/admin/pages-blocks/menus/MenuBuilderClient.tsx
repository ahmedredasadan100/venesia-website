"use client";

import { AdminFormPendingFields } from "../../../../components/admin/ui/AdminFormRuntime";

import { resolveAdminNoticeFeedback } from "../../../../lib/admin/entity-list/feedback-codes";
import { AdminFeedbackRegion } from "../../../../components/admin/AdminFeedbackProvider";
import AdminModuleTabs from "../../../../components/admin/ui/AdminModuleTabs";
import {
  AdminCard,
  AdminFormListboxSelect,
  AdminFormSwitch,
} from "../../../../components/admin/ui";

import { createMenuItem, updateMenu } from "./actions";
import MenuItemForm from "./MenuItemForm";
import MenuItemsTableClient from "./MenuItemsTableClient";
import type { Menu, MenuItem } from "./menu-builder-shared";
import { MENU_BUILDER_NOTICE_CODES, menuFieldClassName, menuLabelClassName } from "./menu-builder-shared";

type MenuBuilderClientProps = {
  menu: Menu;
  items: MenuItem[];
  message?: string | null;
  messageNotice?: string | null;
  loadError?: string | null;
  initialVisibleColumns?: readonly string[] | null;
  preferenceError?: string | null;
};

export default function MenuBuilderClient({
  menu,
  items,
  message,
  messageNotice = null,
  loadError = null,
  initialVisibleColumns = null,
  preferenceError = null,
}: MenuBuilderClientProps) {
  const tabs = [
    {
      id: "items",
      navigationLabel: "العناصر",
      sectionHeading: "عناصر القائمة",
      sectionDescription:
        "أدر الروابط والعناصر الفرعية وترتيب ظهورها داخل هذه القائمة.",
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
      sectionDescription:
        "حدّث الاسم والمسار والموقع وحالة التفعيل لهذه القائمة.",
      icon: "settings" as const,
      content: (
        <AdminCard className="p-5 md:p-6">
          <form action={updateMenu} className="grid max-w-2xl gap-4">
            <AdminFormPendingFields>
              <input type="hidden" name="id" value={menu.id} />
              <label className={menuLabelClassName()}>
                الاسم
                <input
                  name="name"
                  defaultValue={menu.name}
                  className={menuFieldClassName("w-full")}
                />
              </label>
              <label className={menuLabelClassName()}>
                Slug
                <input
                  name="slug"
                  defaultValue={menu.slug}
                  className={menuFieldClassName("w-full text-left dir-ltr")}
                />
              </label>
              <AdminFormListboxSelect
                name="location"
                label="Location"
                defaultValue={menu.location}
                options={[
                  { value: "main", label: "Header / Main" },
                  { value: "mobile", label: "Mobile" },
                  { value: "footer", label: "Footer" },
                  { value: "custom", label: "Custom" },
                ]}
              />
              <AdminFormSwitch
                name="is_active"
                label="نشطة"
                defaultChecked={menu.is_active}
                surface
              />
              <button className="min-h-11 w-fit rounded-2xl bg-[#D8B87A] px-5 text-sm font-semibold text-[#05070B] transition hover:bg-[#E6C985]">
                حفظ بيانات القائمة
              </button>
            </AdminFormPendingFields>
          </form>
        </AdminCard>
      ),
    },
    {
      id: "add-item",
      navigationLabel: "إضافة عنصر",
      sectionHeading: "إضافة عنصر جديد",
      sectionDescription:
        "أضف عنصرًا داخل هذه القائمة واربطه بالوجهة المناسبة.",
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
            placement="global"
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
                  ? resolveAdminNoticeFeedback(MENU_BUILDER_NOTICE_CODES, messageNotice ?? "saved", message)
                  : null
            }
          />
        }
      />
    </div>
  );
}
