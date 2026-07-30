"use server";

import { saveAdminColumnPreferences } from "../../../../lib/admin/preferences/admin-column-preferences";
import {
  getProjectsDefaultColumnKeys,
  getProjectsListViewKey,
  getProjectsPreferenceColumnKeys,
  type ProjectColumnKey,
} from "../../../../lib/admin/projects/projects-list-config";
import type { ProjectCategory } from "../../../../config/projects-data";

export async function saveProjectsTablePreferences(
  type: ProjectCategory,
  visibleColumns: string[],
) {
  return saveAdminColumnPreferences({
    viewKey: getProjectsListViewKey(type),
    visibleColumns,
    allowedColumns: getProjectsPreferenceColumnKeys(),
  });
}

export async function restoreProjectsTablePreferences(type: ProjectCategory) {
  return saveProjectsTablePreferences(type, [
    ...getProjectsDefaultColumnKeys(),
  ] as ProjectColumnKey[]);
}
