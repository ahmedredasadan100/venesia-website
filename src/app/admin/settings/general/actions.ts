"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { ADMIN_SESSION_COOKIE, getAdminAuthConfig, verifyAdminSessionToken } from "../../../../lib/admin/auth/session";
import { setMaintenanceModeSetting } from "../../../../lib/maintenance/site-settings";

async function assertAdminSession() {
  const config = getAdminAuthConfig();
  if (!config.configured) {
    throw new Error("Admin auth is not configured.");
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!verifyAdminSessionToken(token, config.secret)) {
    throw new Error("Unauthorized");
  }
}

export async function updateMaintenanceModeAction(enabled: boolean) {
  await assertAdminSession();
  await setMaintenanceModeSetting(enabled);
  revalidatePath("/");
  revalidatePath("/maintenance");
  revalidatePath("/admin/settings/general");
}
