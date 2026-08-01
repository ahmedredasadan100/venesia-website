"use server";

import {
  ACTIVITY_LOG_LIST_VIEW_KEY,
  ACTIVITY_LOG_PREFERENCE_COLUMN_KEYS,
} from "../../../lib/admin/audit/activity-log-list-config";
import { saveAdminColumnPreferences } from "../../../lib/admin/preferences/admin-column-preferences";

export async function saveActivityLogColumnPreferences(
  visibleColumns: string[],
) {
  return saveAdminColumnPreferences({
    viewKey: ACTIVITY_LOG_LIST_VIEW_KEY,
    visibleColumns,
    allowedColumns: ACTIVITY_LOG_PREFERENCE_COLUMN_KEYS,
  });
}
