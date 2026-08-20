"use client";

import { useState } from "react";

import {
  AdminFormSwitch,
  AdminLinkField,
} from "../../../../components/admin/ui";
import { menuItemToAdminLink } from "../../../../lib/admin/links/menu-bridge";
import type { MenuItem } from "./menu-builder-shared";

type MenuItemLinkSectionProps = {
  item?: MenuItem;
};

export default function MenuItemLinkSection({
  item,
}: MenuItemLinkSectionProps) {
  const [isParentOnly, setIsParentOnly] = useState(
    item?.item_type === "parent",
  );
  const defaultLink = menuItemToAdminLink(item);

  return (
    <div className="space-y-4 lg:col-span-12">
      <AdminFormSwitch
        name="menu_item_is_parent"
        label="عنصر أب بدون رابط (Parent)"
        checked={isParentOnly}
        onChange={(event) => setIsParentOnly(event.target.checked)}
        surface
      />

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
