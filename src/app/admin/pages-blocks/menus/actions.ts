"use server";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { revalidateNavigationCache } from "../../../../lib/cache/revalidate-public-cache-tags";
import { revalidateMediaCenterPublicPaths } from "../../../../lib/media-center/revalidate-public-paths";
import { revalidateFooterPublicPaths } from "../../../../lib/footer/revalidate-footer";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { normalizeSlugInput, slugifyFromTitle, validateSlugFormat } from "../../../../lib/admin/slug";
import { parseAdminLinkFromFormData } from "../../../../lib/admin/links/form-fields";
import {
  adminLinkToMenuItemColumns,
  parentOnlyMenuItemColumns,
} from "../../../../lib/admin/links/menu-bridge";
import { resolveAdminLink } from "../../../../lib/admin/links";
import { validateAdminLink } from "../../../../lib/admin/links/validate";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(formData: FormData, key: string) {
  const raw = getString(formData, key);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function createSlug(value: string) {
  const normalized = normalizeSlugInput(value);
  if (normalized) return normalized;
  return slugifyFromTitle(value);
}

function assertValidMenuSlug(slug: string) {
  const formatError = validateSlugFormat(slug);
  if (formatError) backToMenus(formatError);
}

function menusPath(message?: string) {
  return `/admin/pages-blocks/menus${message ? `?message=${encodeURIComponent(message)}` : ""}`;
}

type ImportedMenuItem = {
  id?: unknown;
  parent_id?: unknown;
  label?: unknown;
  item_type?: unknown;
  href?: unknown;
  linked_type?: unknown;
  linked_id?: unknown;
  anchor?: unknown;
  target?: unknown;
  css_class?: unknown;
  style_preset?: unknown;
  sort_order?: unknown;
};

function sortParentsBeforeChildren<T extends { parent_id?: unknown }>(items: T[]) {
  return [...items].sort((a, b) => (a.parent_id ? 1 : 0) - (b.parent_id ? 1 : 0));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseImportedMenuItems(payload: unknown): ImportedMenuItem[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (isRecord(payload) && Array.isArray(payload.items)) {
    return payload.items.filter(isRecord);
  }

  return [];
}

function menuPath(menuId: number | string, message?: string) {
  return `/admin/pages-blocks/menus/${menuId}${message ? `?message=${encodeURIComponent(message)}` : ""}`;
}

function backToMenus(message?: string): never {
  redirect(menusPath(message));
}

function backToMenu(menuId: number | string | null | undefined, message?: string): never {
  if (!menuId) backToMenus(message);
  redirect(menuPath(menuId, message));
}

async function getMenuIdFromItem(itemId: number) {
  const { data } = await getSupabaseAdmin().from("menu_items").select("menu_id").eq("id", itemId).maybeSingle();
  return data?.menu_id ? Number(data.menu_id) : null;
}

async function resolveMenuItemLink(formData: FormData) {
  const menuId = getNumber(formData, "menu_id");

  if (getBoolean(formData, "menu_item_is_parent")) {
    return parentOnlyMenuItemColumns();
  }

  const link = parseAdminLinkFromFormData(formData, "menu_link");
  if (link.link_kind === "none") {
    backToMenu(menuId, "اختر رابطًا للعنصر أو فعّل Parent بدون رابط.");
  }

  const validation = validateAdminLink(link);
  if (!validation.ok) backToMenu(menuId, validation.message);

  const resolvedHref = await resolveAdminLink({ ...link, anchor: null });
  return adminLinkToMenuItemColumns(link, resolvedHref);
}

function revalidateNavigation() {
  revalidateNavigationCache();
  revalidateFooterPublicPaths();
  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/projects");
  revalidatePath("/topics");
  revalidateMediaCenterPublicPaths();
  revalidatePath("/contact");
  revalidatePath("/admin/pages-blocks/menus");
}

export async function checkMenuSlugAvailable(slug: string) {
  await requireAdminSession();
  const normalized = createSlug(slug);
  const formatError = validateSlugFormat(normalized);
  if (formatError) {
    return { available: false as const, message: formatError };
  }

  const { data: existingMenu } = await getSupabaseAdmin().from("menus").select("id").eq("slug", normalized).maybeSingle();
  if (existingMenu?.id) {
    return { available: false as const, message: "الـ slug مستخدم بالفعل. اختار slug مختلف لأنه لا يمكن تكراره." };
  }

  return { available: true as const };
}

export async function createMenu(formData: FormData) {
  await requireAdminSession();
  const name = getString(formData, "name");
  const slug = createSlug(getString(formData, "slug") || name);
  const location = getString(formData, "location") || "main";

  if (!name) backToMenus("اكتب اسم القائمة.");
  assertValidMenuSlug(slug);

  const { data: existingMenu } = await getSupabaseAdmin().from("menus").select("id").eq("slug", slug).maybeSingle();
  if (existingMenu?.id) backToMenus("الـ slug مستخدم بالفعل. اختار slug مختلف لأنه لا يمكن تكراره.");

  const { data, error } = await getSupabaseAdmin()
    .from("menus")
    .insert({ name, slug, location, is_active: getBoolean(formData, "is_active") })
    .select("id")
    .single();

  if (error) backToMenus(error.message);
  revalidateNavigation();
  backToMenu(data.id, "تم إنشاء القائمة. ابدأ بإضافة عناصرها.");
}

export async function updateMenu(formData: FormData) {
  await requireAdminSession();
  const id = getNumber(formData, "id");
  const name = getString(formData, "name");
  const slug = createSlug(getString(formData, "slug") || name);
  const location = getString(formData, "location") || "main";

  if (!id || !name) backToMenus("بيانات القائمة غير مكتملة.");
  assertValidMenuSlug(slug);

  const { data: existingMenu } = await getSupabaseAdmin().from("menus").select("id").eq("slug", slug).neq("id", id).maybeSingle();
  if (existingMenu?.id) backToMenus("الـ slug مستخدم بالفعل في قائمة أخرى. اختار slug مختلف.");

  const { error } = await getSupabaseAdmin()
    .from("menus")
    .update({ name, slug, location, is_active: getBoolean(formData, "is_active"), updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) backToMenus(error.message);
  revalidateNavigation();
  backToMenus("تم تحديث القائمة.");
}

export async function toggleMenuVisibility(formData: FormData) {
  await requireAdminSession();
  const id = getNumber(formData, "id");
  const isActive = getBoolean(formData, "is_active");
  if (!id) backToMenus("القائمة غير موجودة.");

  const { error } = await getSupabaseAdmin().from("menus").update({ is_active: isActive, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) backToMenus(error.message);

  revalidateNavigation();
  backToMenus("تم تغيير حالة القائمة.");
}

export async function deleteMenu(formData: FormData) {
  await requireAdminSession();
  const id = getNumber(formData, "id");
  if (!id) backToMenus("القائمة غير موجودة.");

  await getSupabaseAdmin().from("menu_items").delete().eq("menu_id", id);
  const { error } = await getSupabaseAdmin().from("menus").delete().eq("id", id);
  if (error) backToMenus(error.message);

  revalidateNavigation();
  backToMenus("تم حذف القائمة.");
}

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

  revalidateNavigation();
  backToMenu(copiedMenu.id, "تم نسخ القائمة كمسودة مخفية.");
}

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
  revalidateNavigation();
  backToMenu(menuId, "تم تحديث العنصر.");
}

export async function deleteMenuItem(formData: FormData) {
  await requireAdminSession();
  const id = getNumber(formData, "id");
  const menuId = getNumber(formData, "menu_id") ?? (id ? await getMenuIdFromItem(id) : null);
  if (!id) backToMenu(menuId, "العنصر غير موجود.");

  const { error } = await getSupabaseAdmin().from("menu_items").delete().eq("id", id);
  if (error) backToMenu(menuId, error.message);

  revalidateNavigation();
  backToMenu(menuId, "تم حذف العنصر.");
}

export async function toggleMenuItemVisibility(formData: FormData) {
  await requireAdminSession();
  const id = getNumber(formData, "id");
  const menuId = getNumber(formData, "menu_id") ?? (id ? await getMenuIdFromItem(id) : null);
  const isVisible = getBoolean(formData, "is_visible");
  if (!id) backToMenu(menuId, "العنصر غير موجود.");

  const { error } = await getSupabaseAdmin().from("menu_items").update({ is_visible: isVisible, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) backToMenu(menuId, error.message);

  revalidateNavigation();
  backToMenu(menuId, "تم تغيير حالة العنصر.");
}

export async function moveMenuItemSortOrder(formData: FormData) {
  await requireAdminSession();
  const menuId = getNumber(formData, "menu_id");
  const currentId = getNumber(formData, "current_id");
  const targetId = getNumber(formData, "target_id");
  if (!menuId || !currentId || !targetId) backToMenu(menuId, "تعذر إعادة الترتيب.");

  const { data: rows, error: loadError } = await getSupabaseAdmin()
    .from("menu_items")
    .select("id, sort_order")
    .eq("menu_id", menuId)
    .in("id", [currentId, targetId]);

  if (loadError || !rows || rows.length !== 2) backToMenu(menuId, loadError?.message ?? "تعذر إعادة الترتيب.");

  const current = rows.find((row) => Number(row.id) === currentId);
  const target = rows.find((row) => Number(row.id) === targetId);
  if (!current || !target) backToMenu(menuId, "تعذر إعادة الترتيب.");

  const currentOrder = Number(current.sort_order ?? 0);
  const targetOrder = Number(target.sort_order ?? 0);
  const now = new Date().toISOString();

  const { error: updateCurrentError } = await getSupabaseAdmin()
    .from("menu_items")
    .update({ sort_order: targetOrder, updated_at: now })
    .eq("id", currentId);

  if (updateCurrentError) backToMenu(menuId, updateCurrentError.message);

  const { error: updateTargetError } = await getSupabaseAdmin()
    .from("menu_items")
    .update({ sort_order: currentOrder, updated_at: now })
    .eq("id", targetId);

  if (updateTargetError) backToMenu(menuId, updateTargetError.message);

  revalidateNavigation();
  backToMenu(menuId, "تم تحديث ترتيب العنصر.");
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
  revalidateNavigation();
  backToMenu(menuId, "تم نسخ العنصر كمسودة مخفية.");
}

export async function clearMenuItems(formData: FormData) {
  await requireAdminSession();
  const id = getNumber(formData, "id");
  if (!id) backToMenus("القائمة غير موجودة.");

  const { error } = await getSupabaseAdmin().from("menu_items").delete().eq("menu_id", id);
  if (error) backToMenus(error.message);

  revalidateNavigation();
  backToMenus("تم تفريغ عناصر القائمة.");
}

export async function bulkMenuAction(formData: FormData) {
  await requireAdminSession();
  const action = getString(formData, "bulk_action");
  const ids = formData
    .getAll("menu_ids")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (!ids.length) backToMenus("اختار قائمة واحدة على الأقل.");

  if (action === "show" || action === "hide") {
    const { error } = await getSupabaseAdmin()
      .from("menus")
      .update({ is_active: action === "show", updated_at: new Date().toISOString() })
      .in("id", ids);

    if (error) backToMenus(error.message);
    revalidateNavigation();
    backToMenus(action === "show" ? "تم إظهار القوائم المحددة." : "تم إخفاء القوائم المحددة.");
  }

  if (action === "delete") {
    await getSupabaseAdmin().from("menu_items").delete().in("menu_id", ids);
    const { error } = await getSupabaseAdmin().from("menus").delete().in("id", ids);

    if (error) backToMenus(error.message);
    revalidateNavigation();
    backToMenus("تم حذف القوائم المحددة.");
  }

  backToMenus("الإجراء الجماعي غير معروف.");
}

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

  revalidateNavigation();
  backToMenus("تم استيراد عناصر القائمة كمسودة مخفية.");
}
