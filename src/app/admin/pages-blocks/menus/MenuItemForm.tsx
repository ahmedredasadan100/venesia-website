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
    <form action={action} className="grid gap-4 rounded-[26px] border border-white/10 bg-white/[0.025] p-5 lg:grid-cols-12">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <input type="hidden" name="menu_id" value={menu.id} />

      <label className={`${menuLabelClassName()} lg:col-span-2`}>
        Parent
        <select
          name="parent_id"
          defaultValue={item?.parent_id ?? defaultParentId ?? ""}
          className={menuFieldClassName("w-full")}
        >
          <option value="">بدون أب</option>
          {parentItems
            .filter((parent) => parent.id !== item?.id)
            .map((parent) => (
              <option key={parent.id} value={parent.id}>
                {parent.label}
              </option>
            ))}
        </select>
      </label>

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

      <label className={`${menuLabelClassName()} lg:col-span-2`}>
        Style Preset
        <select name="style_preset" defaultValue={item?.style_preset ?? "default"} className={menuFieldClassName("w-full")}>
          <option value="default">default</option>
          <option value="premium-dark">premium-dark</option>
          <option value="gold-card">gold-card</option>
          <option value="compact-list">compact-list</option>
          <option value="cinematic-hero">cinematic-hero</option>
          <option value="minimal">minimal</option>
        </select>
      </label>

      <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-white/62 lg:col-span-2">
        <input
          type="checkbox"
          name="is_visible"
          defaultChecked={item?.is_visible ?? true}
          className="size-4 accent-[#D8B87A]"
        />
        ظاهر
      </label>

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
