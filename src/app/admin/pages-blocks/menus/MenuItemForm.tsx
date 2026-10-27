"use client";

import { AdminFormPendingFields } from "../../../../components/admin/ui/AdminFormRuntime";
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
import { AdminModuleTabIcon } from "../../../../components/admin/ui/AdminModuleTabs";
import type { Menu, MenuItem } from "./menu-builder-shared";
import MenuItemLinkSection from "./MenuItemLinkSection";

type MenuItemFormProps = {
  menu: Menu;
  parentItems: MenuItem[];
  item?: MenuItem;
  defaultParentId?: number | null;
  submitLabel: string;
  action: (formData: FormData) => Promise<void>;
};

export default function MenuItemForm({
  menu,
  parentItems,
  item,
  defaultParentId,
  submitLabel,
  action,
}: MenuItemFormProps) {
  return (
    <form action={action}>
      <AdminFormPendingFields>
        {item ? <input type="hidden" name="id" value={item.id} /> : null}
        <input type="hidden" name="menu_id" value={menu.id} />

        <AdminFormGrid columns={1}>
          <MenuItemLinkSection item={item}>
            <AdminCard presentation="premium" className="p-3">
              <label className={adminFormLabelClassName()}>
                <AdminFormControlHeader title="الاسم" icon={<AdminModuleTabIcon name="content" />} presentation="leading-icon" />
                <input
                  name="label"
                  defaultValue={item?.label ?? ""}
                  placeholder="مثال: مشروعاتنا"
                  className={adminFormFieldClassName()}
                />
              </label>
            </AdminCard>

            <AdminCard presentation="premium" className="p-3">
              <AdminFormListboxSelect
                name="parent_id"
                label={<AdminFormControlHeader title="Parent" icon={<AdminModuleTabIcon name="section" />} presentation="leading-icon" />}
                defaultValue={String(item?.parent_id ?? defaultParentId ?? "")}
                options={[
                  { value: "", label: "بدون أب" },
                  ...parentItems
                    .filter((parent) => parent.id !== item?.id)
                    .map((parent) => ({
                      value: String(parent.id),
                      label: parent.label,
                    })),
                ]}
                sizing="full"
              />
            </AdminCard>

          </MenuItemLinkSection>

          <AdminFormGrid columns={2}>
            <AdminCard presentation="premium" className="p-3">
              <label className={adminFormLabelClassName()}>
                <AdminFormControlHeader title="الترتيب" icon={<AdminModuleTabIcon name="section" />} presentation="leading-icon" />
                <input
                  name="sort_order"
                  type="number"
                  defaultValue={item?.sort_order ?? 0}
                  className={adminFormFieldClassName()}
                />
              </label>
            </AdminCard>

            <AdminCard presentation="premium" className="p-3">
              <label className={adminFormLabelClassName()}>
                <AdminFormControlHeader title="CSS Class" icon={<AdminModuleTabIcon name="settings" />} presentation="leading-icon" />
                <input
                  name="css_class"
                  defaultValue={item?.css_class ?? ""}
                  placeholder="مثال: nav-item-featured"
                  dir="ltr"
                  className={adminFormFieldClassName("text-left font-en")}
                />
              </label>
            </AdminCard>

            <AdminCard presentation="premium" className="p-3">
              <AdminFormListboxSelect
                name="style_preset"
                label={<AdminFormControlHeader title="Style Preset" icon={<AdminModuleTabIcon name="settings" />} presentation="leading-icon" />}
                defaultValue={item?.style_preset ?? "default"}
                options={[
                  "default",
                  "premium-dark",
                  "gold-card",
                  "compact-list",
                  "cinematic-hero",
                  "minimal",
                ].map((value) => ({ value, label: value }))}
                sizing="full"
              />
            </AdminCard>

            <AdminCard presentation="premium" className="p-3">
              <AdminFormSwitch
                name="is_visible"
                label={<AdminFormControlHeader title="ظاهر" icon={<AdminModuleTabIcon name="publish" />} presentation="leading-icon" />}
                defaultChecked={item?.is_visible ?? true}
                embedded
              />
            </AdminCard>
          </AdminFormGrid>

          <div className="flex flex-wrap gap-3">
            <AdminActionButton type="submit" variant="primary">
              {submitLabel}
            </AdminActionButton>
          </div>
        </AdminFormGrid>
      </AdminFormPendingFields>
    </form>
  );
}
