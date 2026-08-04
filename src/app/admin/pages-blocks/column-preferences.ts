"use server";

import { saveAdminColumnPreferences } from "../../../lib/admin/preferences/admin-column-preferences";
import {
  getPageCompositionColumnPreferenceConfig,
  getPageCompositionDefaultColumnKeys,
  getPageCompositionPersistableColumnKeys,
  isPageCompositionColumnPreferenceId,
  type PageCompositionColumnPreferenceId,
} from "../../../lib/page-blocks/admin-collection-columns";

export async function savePageCompositionColumnPreferences(
  collectionId: PageCompositionColumnPreferenceId,
  visibleColumns: string[],
) {
  if (!isPageCompositionColumnPreferenceId(collectionId)) {
    return { ok: false, message: "إعداد أعمدة غير معروف." };
  }

  const config = getPageCompositionColumnPreferenceConfig(collectionId);
  return saveAdminColumnPreferences({
    viewKey: config.viewKey,
    visibleColumns,
    allowedColumns: getPageCompositionPersistableColumnKeys(collectionId),
  });
}

export async function restorePageCompositionColumnPreferences(
  collectionId: PageCompositionColumnPreferenceId,
) {
  return savePageCompositionColumnPreferences(
    collectionId,
    getPageCompositionDefaultColumnKeys(collectionId),
  );
}
