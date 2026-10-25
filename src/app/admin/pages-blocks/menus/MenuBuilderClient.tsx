"use client";

import { AdminFormPendingFields } from "../../../../components/admin/ui/AdminFormRuntime";

import { resolveAdminNoticeFeedback } from "../../../../lib/admin/entity-list/feedback-codes";
import { AdminFeedbackRegion } from "../../../../components/admin/AdminFeedbackProvider";
import AdminModuleTabs, { AdminModuleTabIcon } from "../../../../components/admin/ui/AdminModuleTabs";
import {
  AdminActionButton,
  AdminCard,
  AdminFormControlHeader,
  AdminFormGrid,
  AdminFormListboxSelect,
  AdminFormSwitch,
  adminFormFieldClassName,
  adminFormLabelClassName,
} from "../../../../components/admin/ui";

import { createMenuItem, updateMenu } from "./actions";
import MenuItemForm from "./MenuItemForm";
import MenuItemsTableClient from "./MenuItemsTableClient";
import type { Menu, MenuItem } from "./menu-builder-shared";
import { MENU_BUILDER_NOTICE_CODES } from "./menu-builder-shared";

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
        <AdminCard className="p-3 md:p-6">
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
      sectionHeaderPresentation: "control" as const,
      icon: "settings" as const,
      content: (
        <form action={updateMenu}>
          <AdminFormPendingFields>
            <input type="hidden" name="id" value={menu.id} />
            <AdminFormGrid columns={1}>
              <AdminFormGrid columns={2}>
                <AdminCard presentation="premium" className="p-3">
                  <label className={adminFormLabelClassName()}>
                    <AdminFormControlHeader title="الاسم" icon={<AdminModuleTabIcon name="content" />} presentation="leading-icon" />
                    <input
                      name="name"
                      defaultValue={menu.name}
                      className={adminFormFieldClassName()}
                    />
                  </label>
                </AdminCard>
                <AdminCard presentation="premium" className="p-3">
                  <label className={adminFormLabelClassName()}>
                    <AdminFormControlHeader title="Slug" icon={<AdminModuleTabIcon name="settings" />} presentation="leading-icon" />
                    <input
                      name="slug"
                      defaultValue={menu.slug}
                      dir="ltr"
                      className={adminFormFieldClassName("text-left font-en")}
                    />
                  </label>
                </AdminCard>
                <AdminCard presentation="premium" className="p-3">
                  <AdminFormListboxSelect
                    name="location"
                    label={<AdminFormControlHeader title="Location" icon={<AdminModuleTabIcon name="location" />} presentation="leading-icon" />}
                    defaultValue={menu.location}
                    options={[
                      { value: "main", label: "Header / Main" },
                      { value: "mobile", label: "Mobile" },
                      { value: "footer", label: "Footer" },
                      { value: "custom", label: "Custom" },
                    ]}
                    sizing="full"
                  />
                </AdminCard>
                <AdminCard presentation="premium" className="p-3">
                  <AdminFormSwitch
                    name="is_active"
                    label={<AdminFormControlHeader title="نشطة" icon={<AdminModuleTabIcon name="publish" />} presentation="leading-icon" />}
                    defaultChecked={menu.is_active}
                    embedded
                  />
                </AdminCard>
              </AdminFormGrid>
              <div className="flex flex-wrap gap-3">
                <AdminActionButton type="submit" variant="primary">
                  حفظ بيانات القائمة
                </AdminActionButton>
              </div>
            </AdminFormGrid>
          </AdminFormPendingFields>
        </form>
      ),
    },
    {
      id: "add-item",
      navigationLabel: "إضافة عنصر",
      sectionHeading: "إضافة عنصر جديد",
      sectionDescription:
        "أضف عنصرًا داخل هذه القائمة واربطه بالوجهة المناسبة.",
      sectionHeaderPresentation: "control" as const,
      icon: "section" as const,
      content: (
        <MenuItemForm
          menu={menu}
          parentItems={items}
          action={createMenuItem}
          submitLabel="إضافة"
        />
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
