"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  auditMenuAction,
  backToMenu,
  backToMenus,
  getMenuIdFromItem,
  getNumber,
  revalidateNavigation,
  sortParentsBeforeChildren,
} from "./helpers";

export async function duplicateMenu(formData: FormData) {
  await requireAdminSession();
  const id = getNumber(formData, "id");
  if (!id) backToMenus("القائمة غير موجودة.");

  const [{ data: menu, error: menuError }, { data: items, error: itemsError }] = await Promise.all([
    getSupabaseAdmin().from("menus").select("name, slug, location, is_active").eq("id", id).maybeSingle(),
    getSupabaseAdmin().from("menu_items").select("*").eq("menu_id", id).order("sort_order", { ascending: true }),
  ]);

  if (menuError || !menu) backToMenus(menuError?.message ?? "القائمة غير موجودة.");
  if (itemsError) backToMenus(itemsError.message);

  const suffix = Date.now().toString().slice(-5);
  const { data: copiedMenu, error: copyError } = await getSupabaseAdmin()
    .from("menus")
    .insert({ name: `${menu.name} - نسخة`, slug: `${menu.slug}-copy-${suffix}`, location: `${menu.location}-copy`, is_active: false })
    .select("id")
    .single();

  if (copyError) backToMenus(copyError.message);

  const idMap = new Map<number, number>();
  const sortedItems = sortParentsBeforeChildren(items ?? []);

  for (const item of sortedItems) {
    const { data: newItem, error } = await getSupabaseAdmin()
      .from("menu_items")
      .insert({
        menu_id: copiedMenu.id,
        parent_id: item.parent_id ? idMap.get(Number(item.parent_id)) ?? null : null,
        label: item.label,
        item_type: item.item_type,
        href: item.href,
        linked_type: item.linked_type,
        linked_id: item.linked_id,
        anchor: item.anchor,
        target: item.target,
        css_class: item.css_class,
        style_preset: item.style_preset,
        is_visible: false,
        sort_order: item.sort_order,
      })
      .select("id")
      .single();

    if (error) backToMenus(error.message);
    idMap.set(Number(item.id), Number(newItem.id));
  }

  await auditMenuAction("menu", "duplicate", {
    entityId: copiedMenu.id,
    entityLabel: `${menu.name} - نسخة`,
    metadata: { source_menu_id: id, items_copied: sortedItems.length },
  });
  await revalidateNavigation();
  backToMenu(copiedMenu.id, "تم نسخ القائمة كمسودة مخفية.");
}

export async function duplicateMenuItem(formData: FormData) {
  await requireAdminSession();
  const id = getNumber(formData, "id");
  const menuId = getNumber(formData, "menu_id") ?? (id ? await getMenuIdFromItem(id) : null);
  if (!id || !menuId) backToMenu(menuId, "العنصر غير موجود.");

  const { data: item, error } = await getSupabaseAdmin().from("menu_items").select("*").eq("id", id).maybeSingle();
  if (error || !item) backToMenu(menuId, error?.message ?? "العنصر غير موجود.");

  const { error: insertError } = await getSupabaseAdmin().from("menu_items").insert({
    menu_id: menuId,
    parent_id: item.parent_id,
    label: `${item.label} - نسخة`,
    item_type: item.item_type,
    href: item.href,
    linked_type: item.linked_type,
    linked_id: item.linked_id,
    anchor: item.anchor,
    target: item.target,
    css_class: item.css_class,
    style_preset: item.style_preset,
    is_visible: false,
    sort_order: Number(item.sort_order ?? 0) + 1,
  });

  if (insertError) backToMenu(menuId, insertError.message);
  await auditMenuAction("menu_item", "duplicate", {
    entityLabel: `${item.label} - نسخة`,
    metadata: { menu_id: menuId, source_item_id: id },
  });
  await revalidateNavigation();
  backToMenu(menuId, "تم نسخ العنصر كمسودة مخفية.");
}
