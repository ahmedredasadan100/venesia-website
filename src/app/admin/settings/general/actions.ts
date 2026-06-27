"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { setMaintenanceModeSetting } from "../../../../lib/maintenance/site-settings";

export async function updateMaintenanceModeAction(enabled: boolean) {
  await requireAdminSession();
  await setMaintenanceModeSetting(enabled);
  revalidatePath("/");
  revalidatePath("/maintenance");
  revalidatePath("/admin/settings/general");
}
