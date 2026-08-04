import "server-only";

import { cache } from "react";
import { unstable_cache, unstable_noStore as noStore } from "next/cache";

import { getSupabaseAdmin } from "../supabase-admin";
import { logError } from "../logging";
import { resolveGlobalSeoEffectiveContract } from "./resolve-global-seo-effective";
import {
  GLOBAL_SEO_SETTING_KEY,
  type GlobalSeoEffectiveContract,
  type GlobalSeoSettings,
} from "./global-seo-types";

async function queryGlobalSeoEffectiveContract(): Promise<GlobalSeoEffectiveContract> {
  const { data, error } = await getSupabaseAdmin()
    .from("site_settings")
    .select("value")
    .eq("key", GLOBAL_SEO_SETTING_KEY)
    .maybeSingle();

  if (error) {
    logError("loadGlobalSeoSettings failed", error, { resource: "site_settings:seo" });
    return resolveGlobalSeoEffectiveContract({
      databaseStatus: "error",
      databaseError: error.message,
    });
  }

  if (!data?.value) {
    return resolveGlobalSeoEffectiveContract({ databaseStatus: "missing" });
  }

  return resolveGlobalSeoEffectiveContract({
    databaseStatus: "loaded",
    databaseValue: data.value,
  });
}

export const loadGlobalSeoEffectiveContract = cache(async function loadGlobalSeoEffectiveContract(): Promise<GlobalSeoEffectiveContract> {
  return unstable_cache(
    async () => queryGlobalSeoEffectiveContract(),
    ["global-seo-settings"],
    { revalidate: 300, tags: ["seo-global", "site-settings"] },
  )();
});

export const loadGlobalSeoSettings = cache(async function loadGlobalSeoSettings(): Promise<GlobalSeoSettings> {
  return (await loadGlobalSeoEffectiveContract()).settings;
});

/** Admin diagnostics/editor truth must never be hidden behind the public 300s cache snapshot. */
export async function loadGlobalSeoEffectiveContractForAdmin(): Promise<GlobalSeoEffectiveContract> {
  noStore();
  return queryGlobalSeoEffectiveContract();
}
