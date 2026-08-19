import "server-only";

import { z } from "zod";

import { getSupabaseAdmin } from "../../supabase-admin";

export type TrackingHubProject = {
  id: number;
  slug: string;
  arabicName: string;
  type: string;
  publicationStatus: string;
  stageCount: number;
  updateCount: number;
};

const trackingHubProjectSchema = z.object({
  id: z.coerce.number().int().positive(),
  slug: z.string(),
  arabic_name: z.string(),
  type: z.string(),
  publication_status: z.string(),
  project_tracking_stages: z.array(
    z.object({
      project_tracking_items: z.array(
        z.object({
          project_tracking_updates: z.array(
            z.object({ count: z.coerce.number().int().nonnegative() }),
          ),
        }),
      ),
    }),
  ),
});

export async function loadProjectTrackingHub(): Promise<{ projects: TrackingHubProject[]; schemaAvailable: boolean }> {
  const { data, error } = await getSupabaseAdmin()
    .from("projects")
    .select(
      "id,slug,arabic_name,type,publication_status,project_tracking_stages(project_tracking_items(project_tracking_updates(count)))",
    )
    .order("updated_at", { ascending: false });
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      const projectsResult = await getSupabaseAdmin()
        .from("projects")
        .select("id,slug,arabic_name,type,publication_status")
        .order("updated_at", { ascending: false });
      if (projectsResult.error) throw projectsResult.error;
      return {
        projects: (projectsResult.data ?? []).map((project) => ({
          id: project.id,
          slug: project.slug,
          arabicName: project.arabic_name,
          type: project.type,
          publicationStatus: project.publication_status,
          stageCount: 0,
          updateCount: 0,
        })),
        schemaAvailable: false,
      };
    }
    throw error;
  }
  const projects = z.array(trackingHubProjectSchema).parse(data ?? []);
  return {
    schemaAvailable: true,
    projects: projects.map((project) => ({
      id: project.id,
      slug: project.slug,
      arabicName: project.arabic_name,
      type: project.type,
      publicationStatus: project.publication_status,
      stageCount: project.project_tracking_stages.length,
      updateCount: project.project_tracking_stages.reduce(
        (stageSum, stage) =>
          stageSum +
          stage.project_tracking_items.reduce(
            (itemSum, item) =>
              itemSum + (item.project_tracking_updates[0]?.count ?? 0),
            0,
          ),
        0,
      ),
    })),
  };
}
