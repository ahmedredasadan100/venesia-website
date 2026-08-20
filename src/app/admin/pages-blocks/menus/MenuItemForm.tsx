import {
  AdminFormListboxSelect,
  AdminFormSwitch,
} from "../../../../components/admin/ui";
import type { Menu, MenuItem } from "./menu-builder-shared";
import { menuFieldClassName, menuLabelClassName } from "./menu-builder-shared";
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
    <form
      action={action}
      className="grid gap-4 rounded-[26px] border border-white/10 bg-white/[0.025] p-5 lg:grid-cols-12"
    >
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <input type="hidden" name="menu_id" value={menu.id} />

      <AdminFormListboxSelect
        name="parent_id"
        label="Parent"
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
        className="lg:col-span-2"
      />

      <label className={`${menuLabelClassName()} lg:col-span-2`}>
        الاسم
        <input
          name="label"
          defaultValue={item?.label ?? ""}
          placeholder="مثال: مشروعاتنا"
          className={menuFieldClassName("w-full")}
        />
      </label>

      <MenuItemLinkSection item={item} />

      <label className={`${menuLabelClassName()} lg:col-span-1`}>
        الترتيب
        <input
          name="sort_order"
          type="number"
          defaultValue={item?.sort_order ?? 0}
          className={menuFieldClassName("w-full")}
        />
      </label>

      <label className={`${menuLabelClassName()} lg:col-span-3`}>
        CSS Class
        <input
          name="css_class"
          defaultValue={item?.css_class ?? ""}
          placeholder="مثال: nav-item-featured"
          className={menuFieldClassName("w-full text-left dir-ltr")}
        />
      </label>

      <AdminFormListboxSelect
        name="style_preset"
        label="Style Preset"
        defaultValue={item?.style_preset ?? "default"}
        options={[
          "default",
          "premium-dark",
          "gold-card",
          "compact-list",
          "cinematic-hero",
          "minimal",
        ].map((value) => ({ value, label: value }))}
        className="lg:col-span-2"
      />

      <AdminFormSwitch
        name="is_visible"
        label="ظاهر"
        defaultChecked={item?.is_visible ?? true}
        surface
        className="lg:col-span-2"
      />

      <div className="flex items-end lg:col-span-1">
        <button
          type="submit"
          className="min-h-11 w-full rounded-2xl bg-[#D8B87A] px-4 text-sm font-semibold text-[#05070B] transition hover:bg-[#E6C985]"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
