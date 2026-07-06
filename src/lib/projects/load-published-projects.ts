import "server-only";

import { cache } from "react";

import { getSupabaseAdmin } from "../supabase-admin";
import { logError } from "../logging";
import { mapProjectBundleToPublicProject, mapProjectRowToPublicProject } from "./map-public-project";
import type { ProjectHubFilterId, PublicProject } from "./public-types";
import {
  getFeaturedProjects,
  getProjectStats,
  getProjectsByFilter,
  sortProjectsByHomepageOrder,
} from "./public-helpers";
import { parseProjectRow, type ProjectMediaRow } from "./types";

const PUBLIC_PROJECT_COLUMNS =
  "id, slug, code, type, arabic_name, english_name, image, hero_image, location_label, map_area, short_description, featured, show_on_homepage, homepage_order, brochure_url, publication_status, overview_title, overview_body, overview_bullets, overview_video_image, district_title, district_subtitle, district_body, district_bullets, district_image, delivery_specs_title, delivery_specs_subtitle, contact_cta, quick_facts, location_data, cta, detail_tabs, created_at, updated_at, category_label, status, status_label, description, core_specs, delivery_label, area_label, progress, units_label, floors_label, seo_title, seo_description, seo_keywords, focus_keyword, og_image";

type LoadPublishedProjectsOptions = {
  showOnHomepageOnly?: boolean;
};

async function queryPublishedProjects(options?: LoadPublishedProjectsOptions) {
  let query = getSupabaseAdmin()
    .from("projects")
    .select(PUBLIC_PROJECT_COLUMNS)
    .eq("publication_status", "published")
    .order("homepage_order", { ascending: true })
    .order("id", { ascending: true });

  if (options?.showOnHomepageOnly) {
    query = query.eq("show_on_homepage", true);
  }

  const { data, error } = await query;
  if (error) {
    logError("queryPublishedProjects failed", error, options ?? {});
    return [];
  }

  return (data ?? []).map((row) => parseProjectRow(row as Record<string, unknown>));
}

/** All published projects for public pages — single runtime source of truth. */
export async function loadPublishedProjects(
  options?: LoadPublishedProjectsOptions,
): Promise<PublicProject[]> {
  const rows = await queryPublishedProjects(options);
  return rows.map((row) => mapProjectRowToPublicProject(row));
}

export async function loadPublishedProjectSlugs(): Promise<string[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("projects")
    .select("slug")
    .eq("publication_status", "published")
    .order("homepage_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    logError("loadPublishedProjectSlugs failed", error);
    return [];
  }

  return (data ?? []).map((row) => String(row.slug)).filter(Boolean);
}

export const loadProjectBySlug = cache(async function loadProjectBySlug(
  slug: string,
): Promise<PublicProject | null> {
  const supabase = getSupabaseAdmin();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .eq("publication_status", "published")
    .maybeSingle();

  if (projectError) {
    logError("loadProjectBySlug: project lookup failed", projectError, { slug });
    return null;
  }

  if (!project) return null;

  const projectRow = parseProjectRow(project as Record<string, unknown>);
  const projectId = projectRow.id;

  const [{ data: floorPlans }, { data: deliverySpecItems }, { data: media }] = await Promise.all([
    supabase
      .from("project_floor_plans")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("project_delivery_spec_items")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("project_media")
      .select("*")
      .eq("project_id", projectId)
      .order("collection", { ascending: true })
      .order("sort_order", { ascending: true }),
  ]);

  return mapProjectBundleToPublicProject({
    project: projectRow,
    floorPlans: floorPlans ?? [],
    deliverySpecItems: deliverySpecItems ?? [],
    media: (media ?? []) as ProjectMediaRow[],
  });
});

export async function loadFeaturedProjects(): Promise<PublicProject[]> {
  const projects = await loadPublishedProjects();
  return getFeaturedProjects(projects);
}

export async function loadProjectsHubData(filterId: ProjectHubFilterId = "all") {
  const projects = await loadPublishedProjects();
  return {
    projects: getProjectsByFilter(projects, filterId),
    allProjects: sortProjectsByHomepageOrder(projects),
    featuredProjects: getFeaturedProjects(projects),
    stats: getProjectStats(projects),
  };
}
