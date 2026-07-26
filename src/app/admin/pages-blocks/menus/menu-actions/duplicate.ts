"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import {
  coordinateMediaReferenceDomainMutation,
  MediaDomainMutationError,
} from "../../../../../lib/admin/media-catalog/domain-write-coordination";
import { buildMediaReferenceWriteScope } from "../../../../../lib/admin/media-catalog/reference-providers";
import { synchronizeMediaReferenceWriteScopesAfterDomainMutation } from "../../../../../lib/admin/media-catalog/synchronization";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  auditMenuAction,
  backToMenu,
  backToMenus,
  getMenuIdFromItem,
  getNumber,
  mediaWriteMutationErrorMessage,
  navigationMutationMessage,
  revalidateNavigation,
  sortParentsBeforeChildren,
} from "./helpers";

export async function duplicateMenu(formData: FormData) {
  const adminUser = await requireAdminSession();
  const id = getNumber(formData, "id");
  if (!id) backToMenus("القائمة غير موجودة.");

  const [{ data: menu, error: menuError }, { data: items, error: itemsError }] = await Promise.all([
    getSupabaseAdmin().from("menus").select("name, slug, location, is_active").eq("id", id).maybeSingle(),
    getSupabaseAdmin().from("menu_items").select("*").eq("menu_id", id).order("sort_order", { ascending: true }),
  ]);

  if (menuError || !menu) backToMenus(menuError?.message ?? "القائمة غير موجودة.");
  if (itemsError) backToMenus(itemsError.message);

  const suffix = Date.now().toString().slice(-5);
  const copiedMenuLabel = `${menu.name} - نسخة`;
  const requestIdentity = `menu:duplicate:${id}:${crypto.randomUUID()}`;
  const sortedItems = sortParentsBeforeChildren(items ?? []);
  const plannedItems = sortedItems.map((item, index) => ({
    item,
    leaseEntityIdentity: `${requestIdentity}:item:${index}:${String(item.id)}`,
  }));
  const scopes = plannedItems.map(({ item, leaseEntityIdentity }) =>
    buildMediaReferenceWriteScope("menu_items", leaseEntityIdentity, { href: item.href }),
  );

  const coordinated = await (async () => {
    try {
      return await coordinateMediaReferenceDomainMutation({
        scopes,
        actorId: adminUser.id,
        requestIdentity,
        mutate: async () => {
          let domainWriteCommitted = false;
          try {
            const { data: copiedMenu, error: copyError } = await getSupabaseAdmin()
              .from("menus")
              .insert({
                name: copiedMenuLabel,
                slug: `${menu.slug}-copy-${suffix}`,
                location: `${menu.location}-copy`,
                is_active: false,
              })
              .select("id")
              .single();
            if (copyError) throw new Error(copyError.message);
            domainWriteCommitted = true;

            const idMap = new Map<number, number>();
            const synchronizedItems: Array<{
              entityIdentity: number;
              leaseEntityIdentity: string;
            }> = [];

            for (const { item, leaseEntityIdentity } of plannedItems) {
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
              if (error) throw new Error(error.message);
              const newItemId = Number(newItem.id);
              idMap.set(Number(item.id), newItemId);
              synchronizedItems.push({ entityIdentity: newItemId, leaseEntityIdentity });
            }

            return { copiedMenuId: Number(copiedMenu.id), synchronizedItems };
          } catch (error) {
            if (domainWriteCommitted) {
              throw new MediaDomainMutationError(
                error instanceof Error ? error.message : "menu_duplicate_partial_write",
                true,
                { cause: error },
              );
            }
            throw error;
          }
        },
        resolveEntityIdentity: (value) => String(value.copiedMenuId),
        synchronize: ({ value, leaseToken }) =>
          synchronizeMediaReferenceWriteScopesAfterDomainMutation(
            value.synchronizedItems.map((item) => ({
              domainKey: "menu_items",
              entityIdentity: item.entityIdentity,
              leaseEntityIdentity: item.leaseEntityIdentity,
            })),
            leaseToken,
          ),
      });
    } catch (error) {
      backToMenus(mediaWriteMutationErrorMessage(error, "تعذر نسخ القائمة."));
    }
  })();

  await auditMenuAction("menu", "duplicate", {
    entityId: coordinated.value.copiedMenuId,
    entityLabel: copiedMenuLabel,
    metadata: { source_menu_id: id, items_copied: sortedItems.length },
  });
  await revalidateNavigation(coordinated.mediaSynchronization);
  backToMenu(
    coordinated.value.copiedMenuId,
    navigationMutationMessage(
      coordinated.mediaSynchronization,
      "تم نسخ القائمة كمسودة مخفية.",
    ),
  );
}

export async function duplicateMenuItem(formData: FormData) {
  const adminUser = await requireAdminSession();
  const id = getNumber(formData, "id");
  const menuId = getNumber(formData, "menu_id") ?? (id ? await getMenuIdFromItem(id) : null);
  if (!id || !menuId) backToMenu(menuId, "العنصر غير موجود.");

  const { data: item, error } = await getSupabaseAdmin().from("menu_items").select("*").eq("id", id).maybeSingle();
  if (error || !item) backToMenu(menuId, error?.message ?? "العنصر غير موجود.");

  const intendedRow = {
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
  };
  const leaseEntityIdentity = `new:${crypto.randomUUID()}`;
  const coordinated = await (async () => {
    try {
      return await coordinateMediaReferenceDomainMutation({
        scopes: [buildMediaReferenceWriteScope("menu_items", leaseEntityIdentity, intendedRow)],
        actorId: adminUser.id,
        requestIdentity: `menu_item:duplicate:${id}:${crypto.randomUUID()}`,
        mutate: async () => {
          const { data: newItem, error: insertError } = await getSupabaseAdmin()
            .from("menu_items")
            .insert(intendedRow)
            .select("id")
            .single();
          if (insertError) throw new Error(insertError.message);
          return { id: Number(newItem.id) };
        },
        resolveEntityIdentity: (value) => String(value.id),
        synchronize: ({ value, leaseToken }) =>
          synchronizeMediaReferenceWriteScopesAfterDomainMutation(
            [{
              domainKey: "menu_items",
              entityIdentity: value.id,
              leaseEntityIdentity,
            }],
            leaseToken,
          ),
      });
    } catch (mutationError) {
      backToMenu(
        menuId,
        mediaWriteMutationErrorMessage(mutationError, "تعذر نسخ عنصر القائمة."),
      );
    }
  })();

  await auditMenuAction("menu_item", "duplicate", {
    entityId: coordinated.value.id,
    entityLabel: intendedRow.label,
    metadata: { menu_id: menuId, source_item_id: id },
  });
  await revalidateNavigation(coordinated.mediaSynchronization);
  backToMenu(
    menuId,
    navigationMutationMessage(
      coordinated.mediaSynchronization,
      "تم نسخ العنصر كمسودة مخفية.",
    ),
  );
}
