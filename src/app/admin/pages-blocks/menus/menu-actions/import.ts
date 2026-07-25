"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  auditMenuAction,
  backToMenus,
  getNumber,
  parseImportedMenuItems,
  revalidateNavigation,
  sortParentsBeforeChildren,
} from "./helpers";

export async function importMenuJson(formData: FormData) {
  await requireAdminSession();
  const menuId = getNumber(formData, "id");
  const file = formData.get("json_file");

  if (!menuId) backToMenus("القائمة غير موجودة.");
  if (!(file instanceof File) || !file.size) backToMenus("اختار ملف JSON صالح للاستيراد.");

  let payload: unknown;

  try {
    payload = JSON.parse(await file.text());
  } catch {
    backToMenus("ملف JSON غير صالح.");
  }

  const importedItems = parseImportedMenuItems(payload);
  if (!importedItems.length) backToMenus("ملف الاستيراد لا يحتوي على عناصر قائمة.");

  const idMap = new Map<number, number>();
  const sortedItems = sortParentsBeforeChildren(importedItems);

  for (const item of sortedItems) {
    const oldId = Number(item.id);
    const oldParentId = Number(item.parent_id);

    const { data: newItem, error } = await getSupabaseAdmin()
      .from("menu_items")
      .insert({
        menu_id: menuId,
        parent_id: oldParentId ? idMap.get(oldParentId) ?? null : null,
        label: String(item.label ?? "عنصر مستورد"),
        item_type: String(item.item_type ?? "custom"),
        href: String(item.href ?? "#"),
        linked_type: item.linked_type ?? null,
        linked_id: item.linked_id ?? null,
        anchor: item.anchor ?? null,
        target: item.target === "_blank" ? "_blank" : "_self",
        css_class: item.css_class ?? null,
        style_preset: item.style_preset ?? "default",
        is_visible: false,
        sort_order: Number(item.sort_order ?? 0),
      })
      .select("id")
      .single();

    if (error) backToMenus(error.message);
    if (oldId && newItem?.id) idMap.set(oldId, Number(newItem.id));
  }

  await auditMenuAction("menu", "update", {
    entityId: menuId,
    metadata: { import: true, imported_items_count: sortedItems.length },
  });
  await revalidateNavigation();
  backToMenus("تم استيراد عناصر القائمة كمسودة مخفية.");
}
