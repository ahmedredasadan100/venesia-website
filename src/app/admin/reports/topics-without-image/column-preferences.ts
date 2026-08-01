"use server";

import {
  TOPICS_WITHOUT_IMAGE_LIST_VIEW_KEY,
  TOPICS_WITHOUT_IMAGE_PREFERENCE_COLUMN_KEYS,
} from "../../../../lib/admin/media-catalog/topics-without-image-list-config";
import { saveAdminColumnPreferences } from "../../../../lib/admin/preferences/admin-column-preferences";

export async function saveTopicsWithoutImageColumnPreferences(
  visibleColumns: string[],
) {
  return saveAdminColumnPreferences({
    viewKey: TOPICS_WITHOUT_IMAGE_LIST_VIEW_KEY,
    visibleColumns,
    allowedColumns: TOPICS_WITHOUT_IMAGE_PREFERENCE_COLUMN_KEYS,
  });
}
