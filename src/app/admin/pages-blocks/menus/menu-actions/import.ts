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
  backToMenus,
  getNumber,
  mediaWriteMutationErrorMessage,
  navigationMutationMessage,
  parseImportedMenuItems,
  revalidateNavigation,
  sortParentsBeforeChildren,
} from "./helpers";

export async function importMenuJson(formData: FormData) {
  const adminUser = await requireAdminSession();
  const menuId = getNumber(formData, "id");
  const file = formData.get("json_file");

  if (!menuId) backToMenus("القائمة غير موجودة.");
  if (!(file instanceof File) || !file.size) backToMenus("اختر ملف JSON صالح للاستيراد.");

  let payload: unknown;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    backToMenus("ملف JSON غير صالح.");
  }

  const importedItems = parseImportedMenuItems(payload);
  if (!importedItems.length) backToMenus("ملف الاستيراد لا يحتوي على عناصر قائمة.");

  const requestIdentity = `menu:import:${menuId}:${crypto.randomUUID()}`;
  const plannedItems = sortParentsBeforeChildren(importedItems).map((item, index) => ({
    item,
    leaseEntityIdentity: `${requestIdentity}:item:${index}:${String(item.id ?? "unknown")}`,
    intendedRow: {
      href: String(item.href ?? "#"),
    },
  }));
  const coordinated = await (async () => {
    try {
      return await coordinateMediaReferenceDomainMutation({
        scopes: plannedItems.map((item) =>
          buildMediaReferenceWriteScope(
            "menu_items",
            item.leaseEntityIdentity,
            item.intendedRow,
          ),
        ),
        actorId: adminUser.id,
        requestIdentity,
        mutate: async () => {
          const idMap = new Map<number, number>();
          const synchronizedItems: Array<{
            entityIdentity: number;
            leaseEntityIdentity: string;
          }> = [];
          try {
            for (const { item, intendedRow, leaseEntityIdentity } of plannedItems) {
              const oldId = Number(item.id);
              const oldParentId = Number(item.parent_id);
              const { data: newItem, error } = await getSupabaseAdmin()
                .from("menu_items")
                .insert({
                  menu_id: menuId,
                  parent_id: oldParentId ? idMap.get(oldParentId) ?? null : null,
                  label: String(item.label ?? "عنصر مستورد"),
                  item_type: String(item.item_type ?? "custom"),
                  href: intendedRow.href,
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
              if (error) throw new Error(error.message);
              const newItemId = Number(newItem.id);
              if (oldId) idMap.set(oldId, newItemId);
              synchronizedItems.push({ entityIdentity: newItemId, leaseEntityIdentity });
            }
          } catch (error) {
            if (synchronizedItems.length) {
              throw new MediaDomainMutationError(
                error instanceof Error ? error.message : "menu_import_partial_write",
                true,
                { cause: error },
              );
            }
            throw error;
          }

          return { synchronizedItems };
        },
        resolveEntityIdentity: () => String(menuId),
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
      backToMenus(mediaWriteMutationErrorMessage(error, "تعذر استيراد عناصر القائمة."));
    }
  })();

  await auditMenuAction("menu", "update", {
    entityId: menuId,
    metadata: { import: true, imported_items_count: plannedItems.length },
  });
  await revalidateNavigation(coordinated.mediaSynchronization);
  backToMenus(
    navigationMutationMessage(
      coordinated.mediaSynchronization,
      "تم استيراد عناصر القائمة كمسودة مخفية.",
    ),
  );
}
