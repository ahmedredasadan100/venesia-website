"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { coordinateMediaReferenceDomainMutation } from "../../../../../lib/admin/media-catalog/domain-write-coordination";
import { buildMediaReferenceWriteScope } from "../../../../../lib/admin/media-catalog/reference-providers";
import { synchronizeMediaReferenceWriteScopesAfterDomainMutation } from "../../../../../lib/admin/media-catalog/synchronization";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  backToMenu,
  getMenuIdFromItem,
  getNumber,
  menuInteractionFailure,
  menuInteractionSuccess,
  mediaWriteMutationErrorMessage,
  mutateMenuTree,
  navigationMutationMessage,
  revalidateNavigation,
  sortParentsBeforeChildren,
} from "./helpers";

export async function duplicateMenu(formData: FormData) {
  const actor = await requireAdminSession();
  const id = getNumber(formData, "id");
  if (!id) return menuInteractionFailure("menu_not_found", "القائمة غير موجودة.");

  const [{ data: menu, error: menuError }, { data: items, error: itemsError }] = await Promise.all([
    getSupabaseAdmin().from("menus").select("name").eq("id", id).maybeSingle(),
    getSupabaseAdmin().from("menu_items").select("id,parent_id,href").eq("menu_id", id).order("sort_order"),
  ]);
  if (menuError || !menu) {
    return menuInteractionFailure(
      "menu_not_found",
      menuError?.message ?? "القائمة غير موجودة.",
    );
  }
  if (itemsError) {
    return menuInteractionFailure("menu_items_read_failed", itemsError.message);
  }

  const requestIdentity = `menu:duplicate:${id}:${crypto.randomUUID()}`;
  const planned = sortParentsBeforeChildren(items ?? []).map((item, index) => ({
    item,
    leaseEntityIdentity: `${requestIdentity}:item:${index}:${item.id}`,
  }));

  try {
    const coordinated = await coordinateMediaReferenceDomainMutation({
        scopes: planned.map(({ item, leaseEntityIdentity }) =>
          buildMediaReferenceWriteScope("menu_items", leaseEntityIdentity, { href: item.href }),
        ),
        actorId: actor.id,
        requestIdentity,
        mutate: async () => {
          const result = await mutateMenuTree(id, "duplicate_menu", {}, actor);
          const itemIds = Array.isArray(result.item_ids) ? result.item_ids.map(Number) : [];
          if (itemIds.length !== planned.length) throw new Error("Menu duplicate item parity failed.");
          return { menuId: Number(result.menu_id), itemIds };
        },
        resolveEntityIdentity: (value) => String(value.menuId),
        synchronize: ({ value, leaseToken }) =>
          synchronizeMediaReferenceWriteScopesAfterDomainMutation(
            value.itemIds.map((itemId, index) => ({
              domainKey: "menu_items",
              entityIdentity: itemId,
              leaseEntityIdentity: planned[index].leaseEntityIdentity,
            })),
            leaseToken,
          ),
      });

    await revalidateNavigation(coordinated.mediaSynchronization);
    return menuInteractionSuccess(
      coordinated.mediaSynchronization,
      "تم نسخ القائمة كمسودة مخفية.",
      { menuId: coordinated.value.menuId },
    );
  } catch (error) {
    return menuInteractionFailure(
      "menu_duplicate_failed",
      mediaWriteMutationErrorMessage(error, "تعذر نسخ القائمة."),
    );
  }
}

export async function duplicateMenuItem(formData: FormData) {
  const actor = await requireAdminSession();
  const id = getNumber(formData, "id");
  const menuId = getNumber(formData, "menu_id") ?? (id ? await getMenuIdFromItem(id) : null);
  if (!id || !menuId) backToMenu(menuId, "العنصر غير موجود.");

  const { data: item, error } = await getSupabaseAdmin()
    .from("menu_items")
    .select("href")
    .eq("id", id)
    .eq("menu_id", menuId)
    .maybeSingle();
  if (error || !item) backToMenu(menuId, error?.message ?? "العنصر غير موجود.");

  const leaseEntityIdentity = `new:${crypto.randomUUID()}`;
  const coordinated = await (async () => {
    try {
      return await coordinateMediaReferenceDomainMutation({
        scopes: [buildMediaReferenceWriteScope("menu_items", leaseEntityIdentity, { href: item.href })],
        actorId: actor.id,
        requestIdentity: `menu_item:duplicate:${id}:${crypto.randomUUID()}`,
        mutate: async () => {
          const result = await mutateMenuTree(menuId, "duplicate_item", { item_id: id }, actor);
          return { id: Number(result.item_id) };
        },
        resolveEntityIdentity: (value) => String(value.id),
        synchronize: ({ value, leaseToken }) =>
          synchronizeMediaReferenceWriteScopesAfterDomainMutation(
            [{ domainKey: "menu_items", entityIdentity: value.id, leaseEntityIdentity }],
            leaseToken,
          ),
      });
    } catch (mutationError) {
      backToMenu(menuId, mediaWriteMutationErrorMessage(mutationError, "تعذر نسخ عنصر القائمة."));
    }
  })();

  await revalidateNavigation(coordinated.mediaSynchronization);
  backToMenu(
    menuId,
    navigationMutationMessage(coordinated.mediaSynchronization, "تم نسخ العنصر كمسودة مخفية."),
  );
}
