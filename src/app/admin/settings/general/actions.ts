"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { setMaintenanceModeSetting } from "../../../../lib/maintenance/site-settings";

export async function updateMaintenanceModeAction(enabled: boolean) {
  await requireAdminSession();
  await setMaintenanceModeSetting(enabled);

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("site_settings", "update"),
    entityType: "site_settings",
    entityLabel: "maintenance_mode",
    metadata: { enabled },
  });

  revalidatePath("/");
  revalidatePath("/maintenance");
  revalidatePath("/admin/settings/general");
}
