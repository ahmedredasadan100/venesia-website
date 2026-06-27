import "server-only";

import type { ProjectCategory } from "./public-types";
import { getSupabaseAdmin } from "../supabase-admin";
import {
  parseProjectRow,
  type ProjectEditBundle,
  type ProjectListRow,
  type ProjectMediaRow,
} from "./types";

const LIST_COLUMNS =
  "id, code, slug, arabic_name, location_label, map_area, featured, publication_status, updated_at";

export async function listProjectsByType(type: ProjectCategory): Promise<ProjectListRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("projects")
    .select(LIST_COLUMNS)
    .eq("type", type)
    .order("homepage_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ProjectListRow[];
}

export async function getProjectEditBundle(id: number): Promise<ProjectEditBundle | null> {
  const supabase = getSupabaseAdmin();

  const [{ data: project, error: projectError }, { data: floorPlans }, { data: deliverySpecItems }, { data: media }] =
    await Promise.all([
      supabase.from("projects").select("*").eq("id", id).maybeSingle(),
      supabase.from("project_floor_plans").select("*").eq("project_id", id).order("sort_order", { ascending: true }),
      supabase
        .from("project_delivery_spec_items")
        .select("*")
        .eq("project_id", id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("project_media")
        .select("*")
        .eq("project_id", id)
        .order("collection", { ascending: true })
        .order("sort_order", { ascending: true }),
    ]);

  if (projectError) throw new Error(projectError.message);
  if (!project) return null;

  return {
    project: parseProjectRow(project as Record<string, unknown>),
    floorPlans: (floorPlans ?? []) as ProjectEditBundle["floorPlans"],
    deliverySpecItems: (deliverySpecItems ?? []) as ProjectEditBundle["deliverySpecItems"],
    media: (media ?? []) as ProjectMediaRow[],
  };
}

export async function countProjectsByType() {
  const supabase = getSupabaseAdmin();
  const [residential, commercial] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("type", "residential"),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("type", "commercial"),
  ]);

  return {
    residential: residential.count ?? 0,
    commercial: commercial.count ?? 0,
    residentialError: residential.error?.message ?? null,
    commercialError: commercial.error?.message ?? null,
  };
}
