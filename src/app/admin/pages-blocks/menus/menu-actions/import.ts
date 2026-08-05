"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { coordinateMediaReferenceDomainMutation } from "../../../../../lib/admin/media-catalog/domain-write-coordination";
import { buildMediaReferenceWriteScope } from "../../../../../lib/admin/media-catalog/reference-providers";
import { synchronizeMediaReferenceWriteScopesAfterDomainMutation } from "../../../../../lib/admin/media-catalog/synchronization";
import {
  backToMenus,
  getNumber,
  mediaWriteMutationErrorMessage,
  mutateMenuTree,
  navigationMutationMessage,
  parseImportedMenuItems,
  revalidateNavigation,
  sortParentsBeforeChildren,
} from "./helpers";

export async function importMenuJson(formData: FormData) {
  const actor = await requireAdminSession();
  const menuId = getNumber(formData, "id");
  const file = formData.get("json_file");
  if (!menuId) backToMenus("القائمة غير موجودة.");
  if (!(file instanceof File) || !file.size) backToMenus("اختر ملف JSON صالحًا للاستيراد.");

  let payload: unknown;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    backToMenus("ملف JSON غير صالح.");
  }
  const importedItems = sortParentsBeforeChildren(parseImportedMenuItems(payload));
  if (!importedItems.length) backToMenus("ملف الاستيراد لا يحتوي على عناصر قائمة.");

  const requestIdentity = `menu:import:${menuId}:${crypto.randomUUID()}`;
  const planned = importedItems.map((item, index) => ({
    item,
    leaseEntityIdentity: `${requestIdentity}:item:${index}:${String(item.id ?? "unknown")}`,
  }));

  const coordinated = await (async () => {
    try {
      return await coordinateMediaReferenceDomainMutation({
        scopes: planned.map(({ item, leaseEntityIdentity }) =>
          buildMediaReferenceWriteScope("menu_items", leaseEntityIdentity, { href: String(item.href ?? "#") }),
        ),
        actorId: actor.id,
        requestIdentity,
        mutate: async () => {
          const result = await mutateMenuTree(menuId, "import", { items: importedItems }, actor);
          const itemIds = Array.isArray(result.item_ids) ? result.item_ids.map(Number) : [];
          if (itemIds.length !== planned.length) throw new Error("Menu import item parity failed.");
          return { itemIds };
        },
        resolveEntityIdentity: () => String(menuId),
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
    } catch (error) {
      backToMenus(mediaWriteMutationErrorMessage(error, "تعذر استيراد عناصر القائمة."));
    }
  })();

  await revalidateNavigation(coordinated.mediaSynchronization);
  backToMenus(
    navigationMutationMessage(coordinated.mediaSynchronization, "تم استيراد عناصر القائمة كمسودات مخفية."),
  );
}
