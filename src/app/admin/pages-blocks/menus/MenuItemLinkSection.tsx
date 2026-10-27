"use client";

import { useState, type ReactNode } from "react";

import {
  AdminCard,
  AdminFormControlHeader,
  AdminFormGrid,
  AdminFormSwitch,
  AdminLinkField,
} from "../../../../components/admin/ui";
import { AdminModuleTabIcon } from "../../../../components/admin/ui/AdminModuleTabs";
import { menuItemToAdminLink } from "../../../../lib/admin/links/menu-bridge";
import type { MenuItem } from "./menu-builder-shared";

type MenuItemLinkSectionProps = {
  item?: MenuItem;
  children?: ReactNode;
};

export default function MenuItemLinkSection({
  item,
  children,
}: MenuItemLinkSectionProps) {
  const [isParentOnly, setIsParentOnly] = useState(
    item?.item_type === "parent",
  );
  const defaultLink = menuItemToAdminLink(item);

  const parentControl = (
    <AdminFormSwitch
      name="menu_item_is_parent"
      label={<AdminFormControlHeader title="عنصر أب بدون رابط (Parent)" icon={<AdminModuleTabIcon name="section" />} presentation="leading-icon" />}
      checked={isParentOnly}
      onChange={(event) => setIsParentOnly(event.target.checked)}
      embedded
      embeddedLayout="inline"
    />
  );

  const linkControl = !isParentOnly ? (
    <AdminLinkField
      prefix="menu_link"
      label="الرابط"
      defaultValue={defaultLink}
      helperText="اختر محتوى داخلي من النظام أو رابطًا خارجيًا — بدون كتابة Internal URL يدويًا."
      showAnchor
      presentation="inline"
      actionPresentation="bare"
    />
  ) : null;

  if (children) {
    return (
      <>
        <AdminFormGrid columns={3}>
          {children}
          <AdminCard presentation="premium" className="p-3">
            {parentControl}
          </AdminCard>
        </AdminFormGrid>
        {linkControl ? (
          <AdminCard presentation="premium" className="p-3">
            {linkControl}
          </AdminCard>
        ) : null}
      </>
    );
  }

  return (
    <AdminCard presentation="premium" className="space-y-4 p-3">
      {parentControl}
      {linkControl}
    </AdminCard>
  );
}
