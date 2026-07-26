"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { coordinateMediaReferenceEntityMutation } from "../../../../../lib/admin/media-catalog/domain-write-coordination";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  auditMenuAction,
  backToMenu,
  getBoolean,
  getNumber,
  getString,
  mediaWriteMutationErrorMessage,
  navigationMutationMessage,
  resolveMenuItemLink,
  revalidateNavigation,
} from "./helpers";

export async function createMenuItem(formData: FormData) {
  const adminUser = await requireAdminSession();
  const menuId = getNumber(formData, "menu_id");
  const parentId = getNumber(formData, "parent_id");
  const label = getString(formData, "label");
  const { itemType, href, linkedType, linkedId, anchor, target } = await resolveMenuItemLink(formData);

  if (!menuId || !label) backToMenu(menuId, "اختر القائمة واكتب اسم العنصر.");

  const intendedRow = {
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
  };
  const leaseEntityIdentity = `new:${crypto.randomUUID()}`;
  const coordinated = await (async () => {
    try {
      return await coordinateMediaReferenceEntityMutation({
        domainKey: "menu_items",
        leaseEntityIdentity,
        intendedRow,
        actorId: adminUser.id,
        requestIdentity: `menu_item:create:${crypto.randomUUID()}`,
        mutate: async () => {
          const { data, error } = await getSupabaseAdmin()
            .from("menu_items")
            .insert(intendedRow)
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          return { id: Number(data.id) };
        },
        resolveEntityIdentity: (value) => String(value.id),
      });
    } catch (error) {
      backToMenu(
        menuId,
        mediaWriteMutationErrorMessage(error, "تعذر إضافة عنصر القائمة."),
      );
    }
  })();

  await auditMenuAction("menu_item", "create", {
    entityId: coordinated.value.id,
    entityLabel: label,
    metadata: { menu_id: menuId },
  });
  await revalidateNavigation(coordinated.mediaSynchronization);
  backToMenu(
    menuId,
    navigationMutationMessage(coordinated.mediaSynchronization, "تم إضافة عنصر للقائمة."),
  );
}

export async function updateMenuItem(formData: FormData) {
  const adminUser = await requireAdminSession();
  const id = getNumber(formData, "id");
  const menuId = getNumber(formData, "menu_id");
  const parentId = getNumber(formData, "parent_id");
  const label = getString(formData, "label");
  const { itemType, href, linkedType, linkedId, anchor, target } = await resolveMenuItemLink(formData);

  if (!id || !menuId || !label) backToMenu(menuId, "بيانات العنصر غير مكتملة.");

  const intendedRow = {
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
  };
  const coordinated = await (async () => {
    try {
      return await coordinateMediaReferenceEntityMutation({
        domainKey: "menu_items",
        leaseEntityIdentity: String(id),
        intendedRow,
        actorId: adminUser.id,
        requestIdentity: `menu_item:update:${id}:${crypto.randomUUID()}`,
        mutate: async () => {
          const { error } = await getSupabaseAdmin()
            .from("menu_items")
            .update(intendedRow)
            .eq("id", id);
          if (error) throw new Error(error.message);
          return { id };
        },
        resolveEntityIdentity: (value) => String(value.id),
      });
    } catch (error) {
      backToMenu(
        menuId,
        mediaWriteMutationErrorMessage(error, "تعذر تحديث عنصر القائمة."),
      );
    }
  })();

  await auditMenuAction("menu_item", "update", {
    entityId: id,
    entityLabel: label,
    metadata: { menu_id: menuId },
  });
  await revalidateNavigation(coordinated.mediaSynchronization);
  backToMenu(
    menuId,
    navigationMutationMessage(coordinated.mediaSynchronization, "تم تحديث العنصر."),
  );
}
