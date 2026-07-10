"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { runSitemapDiagnostics } from "../../../../lib/seo/run-sitemap-diagnostics";
import type { SitemapMonitorSnapshot } from "../../../../lib/seo/sitemap-monitor-types";

export async function runSitemapCheckAction(): Promise<SitemapMonitorSnapshot> {
  await requireAdminSession();
  const snapshot = await runSitemapDiagnostics();
  revalidatePath("/admin/seo/sitemap");
  return snapshot;
}
