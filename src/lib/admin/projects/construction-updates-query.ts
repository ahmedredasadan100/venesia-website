import "server-only";

import { logError } from "../../logging";
import { getSupabaseAdmin } from "../../supabase-admin";

export type ConstructionProjectRow = {
  id: number;
  code: string;
  slug: string;
  arabic_name: string;
  status: string;
  status_label: string;
  progress: number;
  publication_status: string;
  updated_at: string;
};

export type ConstructionSiteUpdateRow = {
  id: number;
  title: string;
  slug: string;
  status: string | null;
  published_at: string | null;
  updated_at: string | null;
};

export type ConstructionUpdatesPlanningData = {
  projects: ConstructionProjectRow[];
  siteUpdates: ConstructionSiteUpdateRow[];
};

export async function getConstructionUpdatesPlanningData(): Promise<ConstructionUpdatesPlanningData> {
  const [
    { data: projects, error: projectsError },
    { data: siteUpdates, error: siteUpdatesError },
  ] = await Promise.all([
    getSupabaseAdmin()
      .from("projects")
      .select("id, code, slug, arabic_name, status, status_label, progress, publication_status, updated_at")
      .eq("type", "residential")
      .order("updated_at", { ascending: false }),
    getSupabaseAdmin()
      .from("topics")
      .select("id, title, slug, status, published_at, updated_at")
      .eq("content_type", "site_update")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  if (projectsError || siteUpdatesError) {
    logError(
      "getConstructionUpdatesPlanningData failed",
      projectsError || siteUpdatesError,
    );
    throw new Error("تعذر تحميل بيانات تخطيط تحديثات التنفيذ. حاول مرة أخرى.");
  }

  return {
    projects: (projects ?? []) as ConstructionProjectRow[],
    siteUpdates: (siteUpdates ?? []) as ConstructionSiteUpdateRow[],
  };
}
