"use server";

import { saveAdminColumnPreferences } from "../../../lib/admin/preferences/admin-column-preferences";
import {
  PROJECT_TRACKING_COLUMN_CONTRACT_VERSION,
  getProjectTrackingColumnKeys,
  getProjectTrackingColumnViewKey,
  type ProjectTrackingColumnKind,
} from "../../../lib/admin/projects/tracking-column-preferences";

export async function saveProjectTrackingColumnPreferences(
  kind: ProjectTrackingColumnKind,
  visibleColumns: string[],
) {
  return saveAdminColumnPreferences({
    viewKey: getProjectTrackingColumnViewKey(kind),
    visibleColumns,
    allowedColumns: getProjectTrackingColumnKeys(kind),
    contractVersion: PROJECT_TRACKING_COLUMN_CONTRACT_VERSION,
  });
}

export async function restoreProjectTrackingColumnPreferences(
  kind: ProjectTrackingColumnKind,
) {
  return saveProjectTrackingColumnPreferences(kind, [
    ...getProjectTrackingColumnKeys(kind),
  ]);
}
