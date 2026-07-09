"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  auditMenuAction,
  backToMenu,
  getBoolean,
  getNumber,
  getString,
  resolveMenuItemLink,
  revalidateNavigation,
} from "./helpers";

export async function createMenuItem(formData: FormData) {
  await requireAdminSession();
  const menuId = getNumber(formData, "menu_id");
  const parentId = getNumber(formData, "parent_id");
  const label = getString(formData, "label");
  const { itemType, href, linkedType, linkedId, anchor, target } = await resolveMenuItemLink(formData);

  if (!menuId || !label) backToMenu(menuId, "اختار القائمة واكتب اسم العنصر.");

  const { error } = await getSupabaseAdmin().from("menu_items").insert({
    menu_id: menuId,
    parent_id: parentId,
    label,
    item_type: itemType,
    href,
    linked_type: linkedType,
    linked_id: linkedId,
    anchor,
    target,
    css_class: getString(formData, "css_class") || null,
    style_preset: getString(formData, "style_preset") || "default",
    is_visible: getBoolean(formData, "is_visible"),
    sort_order: getNumber(formData, "sort_order") ?? 0,
  });

  if (error) backToMenu(menuId, error.message);
  await auditMenuAction("menu_item", "create", { entityLabel: label, metadata: { menu_id: menuId } });
  revalidateNavigation();
  backToMenu(menuId, "تم إضافة عنصر للقائمة.");
}

export async function updateMenuItem(formData: FormData) {
  await requireAdminSession();
  const id = getNumber(formData, "id");
  const menuId = getNumber(formData, "menu_id");
  const parentId = getNumber(formData, "parent_id");
  const label = getString(formData, "label");
  const { itemType, href, linkedType, linkedId, anchor, target } = await resolveMenuItemLink(formData);

  if (!id || !menuId || !label) backToMenu(menuId, "بيانات العنصر غير مكتملة.");

  const { error } = await getSupabaseAdmin()
    .from("menu_items")
    .update({
      parent_id: parentId,
      label,
      item_type: itemType,
      href,
      linked_type: linkedType,
      linked_id: linkedId,
      anchor,
      target,
      css_class: getString(formData, "css_class") || null,
      style_preset: getString(formData, "style_preset") || "default",
      is_visible: getBoolean(formData, "is_visible"),
      sort_order: getNumber(formData, "sort_order") ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) backToMenu(menuId, error.message);
  await auditMenuAction("menu_item", "update", { entityId: id, entityLabel: label, metadata: { menu_id: menuId } });
  revalidateNavigation();
  backToMenu(menuId, "تم تحديث العنصر.");
}
