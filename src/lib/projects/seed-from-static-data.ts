import "server-only";

import { PROJECTS } from "../../config/projects-data";
import { getSupabaseAdmin } from "../supabase-admin";
import { parseLegacySpecString } from "./floor-plan-specs";
import {
  isProjectsStaticReimportAllowed,
  projectsStaticReimportBlockedMessage,
} from "./static-reimport-policy";
import { mapStaticProjectToDbRow, type SeedResult } from "./types";

async function replaceProjectChildren(
  projectId: number,
  project: (typeof PROJECTS)[number],
) {
  const supabase = getSupabaseAdmin();
  const details = project.residentialDetails;
  let floorPlans = 0;
  let deliveryItems = 0;
  let media = 0;

  await supabase.from("project_floor_plans").delete().eq("project_id", projectId);
  await supabase.from("project_delivery_spec_items").delete().eq("project_id", projectId);
  await supabase.from("project_media").delete().eq("project_id", projectId);

  if (details?.availableAreas?.length) {
    const rows = details.availableAreas.map((area, index) => ({
      project_id: projectId,
      area: area.area,
      label: area.label ?? null,
      plan_image: area.planImage,
      specs: area.specs.map(parseLegacySpecString),
      featured: area.featured ?? false,
      sort_order: index,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("project_floor_plans").insert(rows);
    if (error) throw new Error(error.message);
    floorPlans = rows.length;
  }

  if (details?.deliverySpecs?.items?.length) {
    const rows = details.deliverySpecs.items.map((body, index) => ({
      project_id: projectId,
      body,
      sort_order: index,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("project_delivery_spec_items").insert(rows);
    if (error) throw new Error(error.message);
    deliveryItems = rows.length;
  }

  const mediaRows: {
    project_id: number;
    collection: "overview" | "delivery_specs" | "gallery";
    image: string;
    label: string;
    sort_order: number;
    updated_at: string;
  }[] = [];

  details?.overview.images?.forEach((item, index) => {
    mediaRows.push({
      project_id: projectId,
      collection: "overview",
      image: item.image,
      label: item.label,
      sort_order: index,
      updated_at: new Date().toISOString(),
    });
  });

  details?.deliverySpecs?.images?.forEach((item, index) => {
    mediaRows.push({
      project_id: projectId,
      collection: "delivery_specs",
      image: item.image,
      label: item.label,
      sort_order: index,
      updated_at: new Date().toISOString(),
    });
  });

  if (mediaRows.length) {
    const { error } = await supabase.from("project_media").insert(mediaRows);
    if (error) throw new Error(error.message);
    media = mediaRows.length;
  }

  return { floorPlans, deliveryItems, media };
}

/**
 * Idempotent import from config/projects-data.ts into Supabase.
 * Upserts by slug; replaces child rows for floor plans, delivery items, and media.
 * Execution journey is intentionally excluded.
 */
export async function seedProjectsFromStaticData(): Promise<SeedResult> {
  if (!isProjectsStaticReimportAllowed()) {
    throw new Error(projectsStaticReimportBlockedMessage());
  }

  const supabase = getSupabaseAdmin();
  const errors: string[] = [];
  let upserted = 0;
  let floorPlans = 0;
  let deliveryItems = 0;
  let media = 0;

  for (const project of PROJECTS) {
    try {
      const payload = mapStaticProjectToDbRow(project);
      const existing = await supabase
        .from("projects")
        .select("id, created_at")
        .eq("slug", project.slug)
        .maybeSingle<{ id: number; created_at: string }>();

      if (existing.error) throw new Error(existing.error.message);

      const row = {
        ...payload,
        created_at: existing.data?.created_at ?? new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("projects")
        .upsert(row, { onConflict: "slug" })
        .select("id")
        .single<{ id: number }>();

      if (error || !data) throw new Error(error?.message ?? "Upsert failed.");

      const childCounts = await replaceProjectChildren(data.id, project);
      upserted += 1;
      floorPlans += childCounts.floorPlans;
      deliveryItems += childCounts.deliveryItems;
      media += childCounts.media;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown seed error.";
      errors.push(`${project.slug}: ${message}`);
    }
  }

  return { upserted, floorPlans, deliveryItems, media, errors };
}

export async function getProjectsTableReady() {
  const { count, error } = await getSupabaseAdmin()
    .from("projects")
    .select("id", { count: "exact", head: true });

  if (error) {
    return { ready: false as const, error: error.message, count: 0 };
  }

  return { ready: true as const, error: null, count: count ?? 0 };
}
