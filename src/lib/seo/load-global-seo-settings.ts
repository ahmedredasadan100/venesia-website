import "server-only";

import { unstable_cache } from "next/cache";

import { getSupabaseAdmin } from "../supabase-admin";
import { logError } from "../logging";
import { getGlobalSeoDefaults } from "./global-seo-defaults";
import { parseGlobalSeoValue } from "./parse-global-seo";
import { GLOBAL_SEO_SETTING_KEY, type GlobalSeoSettings } from "./global-seo-types";

async function queryGlobalSeoSettings(): Promise<GlobalSeoSettings> {
  const { data, error } = await getSupabaseAdmin()
    .from("site_settings")
    .select("value")
    .eq("key", GLOBAL_SEO_SETTING_KEY)
    .maybeSingle();

  if (error) {
    logError("loadGlobalSeoSettings failed", error);
    return getGlobalSeoDefaults();
  }

  if (!data?.value) {
    return getGlobalSeoDefaults();
  }

  return parseGlobalSeoValue(data.value);
}

export async function loadGlobalSeoSettings(): Promise<GlobalSeoSettings> {
  return unstable_cache(
    async () => queryGlobalSeoSettings(),
    ["global-seo-settings"],
    { revalidate: 300, tags: ["seo-global", "site-settings"] },
  )();
}
