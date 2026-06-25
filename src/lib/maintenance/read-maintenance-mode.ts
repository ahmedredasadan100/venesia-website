import { MAINTENANCE_MODE_SETTING_KEY } from "./constants";
import { parseMaintenanceModeValue } from "./parse-maintenance-value";

const CACHE_TTL_MS = 5_000;

let cache: { value: boolean; expiresAt: number } | null = null;

export function clearMaintenanceModeCache() {
  cache = null;
}

export async function isMaintenanceModeEnabled() {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.value;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    cache = { value: false, expiresAt: now + CACHE_TTL_MS };
    return false;
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/site_settings?select=value&key=eq.${encodeURIComponent(MAINTENANCE_MODE_SETTING_KEY)}&limit=1`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      cache = { value: false, expiresAt: now + CACHE_TTL_MS };
      return false;
    }

    const rows = (await response.json()) as Array<{ value?: unknown }>;
    const enabled = parseMaintenanceModeValue(rows[0]?.value);
    cache = { value: enabled, expiresAt: now + CACHE_TTL_MS };
    return enabled;
  } catch {
    cache = { value: false, expiresAt: now + CACHE_TTL_MS };
    return false;
  }
}
