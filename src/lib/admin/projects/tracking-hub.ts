import "server-only";

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

export async function loadProjectTrackingHub(): Promise<{ projects: TrackingHubProject[]; schemaAvailable: boolean }> {
  const { data: projects, error } = await getSupabaseAdmin().from("projects").select("id,slug,arabic_name,type,publication_status").order("updated_at", { ascending: false });
  if (error) throw error;
  const ids = (projects ?? []).map((project) => project.id);
  if (!ids.length) return { projects: [], schemaAvailable: true };
  const stages = await getSupabaseAdmin().from("project_tracking_stages").select("id,project_id").in("project_id", ids);
  if (stages.error) {
    if (stages.error.code === "42P01" || stages.error.code === "PGRST205") return { projects: (projects ?? []).map((project) => ({ id: project.id, slug: project.slug, arabicName: project.arabic_name, type: project.type, publicationStatus: project.publication_status, stageCount: 0, updateCount: 0 })), schemaAvailable: false };
    throw stages.error;
  }
  const stageIds = (stages.data ?? []).map((stage) => stage.id);
  const items = stageIds.length ? await getSupabaseAdmin().from("project_tracking_items").select("id,stage_id").in("stage_id", stageIds) : { data: [], error: null };
  if (items.error) throw items.error;
  const itemIds = (items.data ?? []).map((item) => item.id);
  const updates = itemIds.length ? await getSupabaseAdmin().from("project_tracking_updates").select("id,item_id").in("item_id", itemIds) : { data: [], error: null };
  if (updates.error) throw updates.error;
  const stageToProject = new Map((stages.data ?? []).map((stage) => [stage.id, stage.project_id]));
  const itemToProject = new Map((items.data ?? []).map((item) => [item.id, stageToProject.get(item.stage_id)]));
  return { schemaAvailable: true, projects: (projects ?? []).map((project) => ({ id: project.id, slug: project.slug, arabicName: project.arabic_name, type: project.type, publicationStatus: project.publication_status, stageCount: (stages.data ?? []).filter((stage) => stage.project_id === project.id).length, updateCount: (updates.data ?? []).filter((update) => itemToProject.get(update.item_id) === project.id).length })) };
}
