import "server-only";

import { getSupabaseAdmin } from "../supabase-admin";
import { MAINTENANCE_MODE_SETTING_KEY } from "./constants";
import { clearMaintenanceModeCache } from "./read-maintenance-mode";
import { parseMaintenanceModeValue } from "./parse-maintenance-value";

export async function getMaintenanceModeSetting() {
  const { data, error } = await getSupabaseAdmin()
    .from("site_settings")
    .select("value")
    .eq("key", MAINTENANCE_MODE_SETTING_KEY)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return parseMaintenanceModeValue(data?.value);
}

export async function setMaintenanceModeSetting(enabled: boolean) {
  const { error } = await getSupabaseAdmin()
    .from("site_settings")
    .upsert(
      {
        key: MAINTENANCE_MODE_SETTING_KEY,
        value: { enabled },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );

  if (error) {
    throw new Error(error.message);
  }

  clearMaintenanceModeCache();
}
