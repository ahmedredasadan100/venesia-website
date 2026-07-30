import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import { logError } from "../logging";
import { getSupabaseAdmin } from "../supabase-admin";
import {
  mapProjectAggregateToPublicProject,
  mapProjectRowToPublicProject,
  PublicProjectMappingError,
  type PublicProjectChildRow,
  type PublicProjectRootRow,
} from "./map-public-project";
import type { ProjectHubFilterId, PublicProject } from "./public-types";
import { getProjectStats, getProjectsByFilter } from "./public-helpers";

const PUBLIC_PROJECT_COLUMNS = [
  "id", "type", "arabic_name", "english_name", "slug",
  "general_description", "short_description",
  "image", "image_alt", "hero_image", "hero_image_alt",
  "small_box_image", "small_box_image_alt",
  "governorate_id", "city_id", "main_area_id", "sub_area_id",
  "location_label", "location_description", "google_maps_url",
  "latitude", "longitude", "map_zoom",
  "overview_title", "overview_body", "overview_media_type",
  "overview_main_image", "overview_main_image_alt",
  "delivery_title", "delivery_body",
  "seo_title", "seo_description", "focus_keyword", "seo_keywords",
  "canonical_url", "robots_index", "robots_follow", "og_image", "og_image_alt",
  "created_at", "updated_at",
].join(",");

const PROJECT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class PublicProjectReadError extends Error {
  readonly code: "query_failed" | "mapping_failed";

  constructor(code: PublicProjectReadError["code"], message: string) {
    super(message);
    this.name = "PublicProjectReadError";
    this.code = code;
  }
}

export type LoadProjectBySlugResult =
  | { status: "ok"; project: PublicProject }
  | { status: "invalid_slug" | "not_found"; project: null };

function throwReadError(
  context: string,
  error: unknown,
  details: Record<string, unknown> = {},
): never {
  logError(context, error, details);
  throw new PublicProjectReadError("query_failed", "تعذر تحميل بيانات المشروع حاليًا.");
}

function locationIdsFromProjects(projects: PublicProjectRootRow[]) {
  return [...new Set(
    projects.flatMap((project) => [
      project.governorate_id,
      project.city_id,
      project.main_area_id,
      project.sub_area_id,
    ]).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0),
  )];
}

async function loadLocationRows(projects: PublicProjectRootRow[]) {
  const ids = locationIdsFromProjects(projects);
  if (!ids.length) return [];
  const result = await getSupabaseAdmin()
    .from("project_locations")
    .select("id,level,parent_id,name_ar,name_en")
    .in("id", ids);
  if (result.error) throwReadError("Public projects location lookup failed", result.error);
  return (result.data ?? []) as PublicProjectChildRow[];
}

async function queryPublicProjects() {
  const result = await getSupabaseAdmin()
    .from("projects")
    .select(PUBLIC_PROJECT_COLUMNS)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false });

  if (result.error) throwReadError("Public projects query failed", result.error);

  const projects = (result.data ?? []) as unknown as PublicProjectRootRow[];
  const locations = await loadLocationRows(projects);
  try {
    return projects.map((project) => mapProjectRowToPublicProject(project, locations));
  } catch (error) {
    logError("Public projects mapping failed", error);
    throw new PublicProjectReadError("mapping_failed", "تعذر تجهيز بيانات المشاريع للعرض.");
  }
}

async function queryPublicProjectsCached() {
  return unstable_cache(queryPublicProjects, ["public-projects-clean-aggregate"], {
    revalidate: 300,
    tags: ["projects"],
  })();
}

/**
 * Compatibility name retained for callers. The clean schema has no approved
 * publication/homepage flag, so the current public set is the projects table itself.
 */
export async function loadPublishedProjects(): Promise<PublicProject[]> {
  return queryPublicProjectsCached();
}

export async function loadPublishedProjectSlugs(): Promise<string[]> {
  return (await loadPublishedProjects()).map((project) => project.slug);
}

async function queryProjectBySlug(slug: string): Promise<LoadProjectBySlugResult> {
  if (!PROJECT_SLUG_PATTERN.test(slug)) return { status: "invalid_slug", project: null };

  const supabase = getSupabaseAdmin();
  const rootResult = await supabase
    .from("projects")
    .select(PUBLIC_PROJECT_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (rootResult.error) {
    throwReadError("Public project root lookup failed", rootResult.error, { slug });
  }
  if (!rootResult.data) return { status: "not_found", project: null };

  const project = rootResult.data as unknown as PublicProjectRootRow;
  const projectId = Number(project.id);
  const locationIds = locationIdsFromProjects([project]);

  const [locations, locationPoints, features, floorPlans, deliveryItems, media, videos] =
    await Promise.all([
      locationIds.length
        ? supabase.from("project_locations").select("id,level,parent_id,name_ar,name_en").in("id", locationIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("project_location_points").select("id,kind,label,distance_text,sort_order").eq("project_id", projectId).order("kind").order("sort_order"),
      supabase.from("project_features").select("id,body,sort_order").eq("project_id", projectId).order("sort_order"),
      supabase.from("project_floor_plans").select("id,name,area_text,featured,architectural_image,architectural_image_alt,furnishing_image,furnishing_image_alt,sort_order").eq("project_id", projectId).order("sort_order"),
      supabase.from("project_delivery_items").select("id,body,sort_order").eq("project_id", projectId).order("sort_order"),
      supabase.from("project_media").select("id,section,image,alt_text,sort_order").eq("project_id", projectId).order("section").order("sort_order"),
      supabase.from("project_videos").select("id,section,video_url,poster_image,poster_alt,sort_order").eq("project_id", projectId).order("section").order("sort_order"),
    ]);

  const childResults = { locations, locationPoints, features, floorPlans, deliveryItems, media, videos };
  const failedChild = Object.entries(childResults).find(([, result]) => result.error);
  if (failedChild) {
    throwReadError("Public project child lookup failed", failedChild[1].error, {
      slug,
      projectId,
      relation: failedChild[0],
    });
  }

  const planIds = (floorPlans.data ?? []).map((row) => Number(row.id)).filter(Number.isFinite);
  const details = planIds.length
    ? await supabase
        .from("project_floor_plan_details")
        .select("id,floor_plan_id,label,value,sort_order")
        .in("floor_plan_id", planIds)
        .order("floor_plan_id")
        .order("sort_order")
    : { data: [], error: null };
  if (details.error) {
    throwReadError("Public project floor-plan details lookup failed", details.error, { slug, projectId });
  }

  try {
    return {
      status: "ok",
      project: mapProjectAggregateToPublicProject({
        project,
        locations: (locations.data ?? []) as PublicProjectChildRow[],
        locationPoints: (locationPoints.data ?? []) as PublicProjectChildRow[],
        features: (features.data ?? []) as PublicProjectChildRow[],
        floorPlans: (floorPlans.data ?? []) as PublicProjectChildRow[],
        floorPlanDetails: (details.data ?? []) as PublicProjectChildRow[],
        deliveryItems: (deliveryItems.data ?? []) as PublicProjectChildRow[],
        media: (media.data ?? []) as PublicProjectChildRow[],
        videos: (videos.data ?? []) as PublicProjectChildRow[],
      }),
    };
  } catch (error) {
    logError("Public project aggregate mapping failed", error, { slug, projectId });
    if (error instanceof PublicProjectMappingError) {
      throw new PublicProjectReadError("mapping_failed", "تعذر تجهيز بيانات المشروع للعرض.");
    }
    throw error;
  }
}

export const loadProjectBySlugResult = cache(async function loadProjectBySlugResult(
  slug: string,
): Promise<LoadProjectBySlugResult> {
  return unstable_cache(
    async () => queryProjectBySlug(slug),
    ["public-project-clean-aggregate", slug],
    { revalidate: 300, tags: ["projects", "project"] },
  )();
});

/** Compatibility for the out-of-scope Track Your Project consumer. */
export async function loadProjectBySlug(slug: string): Promise<PublicProject | null> {
  return (await loadProjectBySlugResult(slug)).project;
}

/** No clean-schema featured flag exists; callers receive no invented selection. */
export async function loadFeaturedProjects(): Promise<PublicProject[]> {
  return [];
}

export async function loadProjectsHubData(filterId: ProjectHubFilterId = "all") {
  const projects = await loadPublishedProjects();
  return {
    projects: getProjectsByFilter(projects, filterId),
    allProjects: [...projects],
    featuredProjects: [],
    stats: getProjectStats(projects),
  };
}
