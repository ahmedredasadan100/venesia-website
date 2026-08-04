"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import type { GlobalSeoHealthSnapshot } from "../../../../lib/seo/global-seo-health-types";
import { runGlobalSeoHealth } from "../../../../lib/seo/run-global-seo-health";

export async function runSitemapCheckAction(): Promise<GlobalSeoHealthSnapshot> {
  await requireAdminSession();
  const snapshot = await runGlobalSeoHealth();
  revalidatePath("/admin/seo/sitemap");
  return snapshot;
}
