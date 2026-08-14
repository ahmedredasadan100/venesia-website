"use server";

import { saveAdminColumnPreferences } from "../../../../lib/admin/preferences/admin-column-preferences";
import {
  PROJECT_LOCATION_MANAGEMENT_COLUMN_CONTRACT_VERSION,
  getProjectLocationManagementDefaultColumnKeys,
  getProjectLocationManagementListViewKey,
  getProjectLocationManagementPreferenceColumnKeys,
  type ProjectLocationLevel,
} from "../../../../lib/admin/projects/location-management-contract";

export async function saveProjectLocationTablePreferences(
  level: ProjectLocationLevel,
  visibleColumns: string[],
) {
  return saveAdminColumnPreferences({
    viewKey: getProjectLocationManagementListViewKey(level),
    visibleColumns,
    allowedColumns: getProjectLocationManagementPreferenceColumnKeys(level),
    contractVersion: PROJECT_LOCATION_MANAGEMENT_COLUMN_CONTRACT_VERSION,
  });
}

export async function restoreProjectLocationTablePreferences(
  level: ProjectLocationLevel,
) {
  return saveProjectLocationTablePreferences(level, [
    ...getProjectLocationManagementDefaultColumnKeys(level),
  ]);
}
