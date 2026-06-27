"use client";

import { useState } from "react";

import { AdminLinkField } from "../../../../components/admin/ui";
import { menuItemToAdminLink } from "../../../../lib/admin/links/menu-bridge";
import type { MenuItem } from "./menu-builder-shared";

type MenuItemLinkSectionProps = {
  item?: MenuItem;
};

export default function MenuItemLinkSection({ item }: MenuItemLinkSectionProps) {
  const [isParentOnly, setIsParentOnly] = useState(item?.item_type === "parent");
  const defaultLink = menuItemToAdminLink(item);

  return (
    <div className="space-y-4 lg:col-span-12">
      <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-white/70">
        <input
          type="checkbox"
          name="menu_item_is_parent"
          checked={isParentOnly}
          onChange={(event) => setIsParentOnly(event.target.checked)}
          className="size-4 accent-[#D8B87A]"
        />
        عنصر أب بدون رابط (Parent)
      </label>

      {!isParentOnly ? (
        <AdminLinkField
          prefix="menu_link"
          label="الرابط"
          defaultValue={defaultLink}
          helperText="اختر محتوى داخلي من النظام أو رابطًا خارجيًا — بدون كتابة Internal URL يدويًا."
          showAnchor
        />
      ) : null}
    </div>
  );
}
