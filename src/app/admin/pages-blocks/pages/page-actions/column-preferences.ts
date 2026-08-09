"use server";

import { saveAdminColumnPreferences } from "../../../../../lib/admin/preferences/admin-column-preferences";
import {
  getPagesDefaultColumnKeys,
  getPagesPreferenceColumnKeys,
  PAGES_LIST_COLUMN_CONTRACT_VERSION,
  PAGES_LIST_VIEW_KEY,
  type PageColumnKey,
} from "../../../../../lib/admin/pages/pages-list-config";

export async function savePagesTablePreferences(visibleColumns: string[]) {
  return saveAdminColumnPreferences({
    viewKey: PAGES_LIST_VIEW_KEY,
    visibleColumns,
    allowedColumns: getPagesPreferenceColumnKeys(),
    contractVersion: PAGES_LIST_COLUMN_CONTRACT_VERSION,
  });
}

export async function restorePagesTablePreferences() {
  return savePagesTablePreferences([
    ...getPagesDefaultColumnKeys(),
  ] as PageColumnKey[]);
}
