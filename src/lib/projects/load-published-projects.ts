import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import type { ProjectPublicationStatus } from "../admin/projects/project-publishing-capability";
import { logError } from "../logging";
import { getSupabaseAdmin } from "../supabase-admin";
import {
  mapProjectAggregateToPublicProject,
  mapProjectRowToPublicProject,
  PublicProjectMappingError,
  type PublicProjectLocationRow,
  type PublicProjectRootRow,
} from "./map-public-project";
import type { ProjectHubFilterId, PublicProject } from "./public-types";
import { getProjectStats, getProjectsByFilter } from "./public-helpers";

const PUBLIC_PROJECT_COLUMNS = "id,type,arabic_name,english_name,slug,code,featured,show_on_homepage,homepage_order,brochure_url,publication_status,published_at,general_description,short_description,image,image_alt,hero_image,hero_image_alt,small_box_image,small_box_image_alt,governorate_id,city_id,main_area_id,sub_area_id,location_label,location_description,google_maps_url,latitude,longitude,map_zoom,overview_title,overview_body,overview_media_type,overview_main_image,overview_main_image_alt,delivery_title,delivery_body,seo_title,seo_description,focus_keyword,seo_keywords,canonical_url,robots_index,robots_follow,og_image,og_image_alt,created_at,updated_at";

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

export type LoadProjectAdminPreviewResult =
  | {
      status: "ok";
      project: PublicProject;
      publicationStatus: ProjectPublicationStatus;
    }
  | { status: "invalid_id" | "not_found"; project: null };

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

async function loadLocationRows(
  projects: PublicProjectRootRow[],
): Promise<PublicProjectLocationRow[]> {
  const ids = locationIdsFromProjects(projects);
  if (!ids.length) return [];
  const result = await getSupabaseAdmin()
    .from("project_locations")
    .select("id,level,parent_id,name_ar,name_en")
    .in("id", ids);
  if (result.error) throwReadError("Public projects location lookup failed", result.error);
  return result.data ?? [];
}

async function queryPublicProjects(featuredOnly = false) {
  let request = getSupabaseAdmin()
    .from("projects")
    .select(PUBLIC_PROJECT_COLUMNS)
    .eq("publication_status", "published");
  if (featuredOnly) request = request.eq("featured", true);
  const result = await request
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false });

  if (result.error) throwReadError("Public projects query failed", result.error);

  const projects = result.data ?? [];
  const locations = await loadLocationRows(projects);
  try {
    return projects.map((project) => mapProjectRowToPublicProject(project, locations));
  } catch (error) {
    logError("Public projects mapping failed", error);
    throw new PublicProjectReadError("mapping_failed", "تعذر تجهيز بيانات المشاريع للعرض.");
  }
}

async function queryPublicProjectsCached() {
  return unstable_cache(
    () => queryPublicProjects(false),
    ["public-projects-clean-aggregate"],
    { revalidate: 300, tags: ["projects"] },
  )();
}

export async function loadPublishedProjects(): Promise<PublicProject[]> {
  return queryPublicProjectsCached();
}

export type PublishedProjectSitemapRow = {
  slug: string;
  updatedAt: string;
  canonicalUrl: string | null;
  robotsIndex: boolean | null;
};

export async function loadPublishedProjectSitemapRows(): Promise<
  PublishedProjectSitemapRow[]
> {
  return unstable_cache(
    async () => {
      const { data, error } = await getSupabaseAdmin()
        .from("projects")
        .select("slug,updated_at,canonical_url,robots_index")
        .eq("publication_status", "published")
        .order("updated_at", { ascending: false });
      if (error) throwReadError("Published project sitemap query failed", error);
      return (data ?? []).map((row) => ({
        slug: String(row.slug),
        updatedAt: String(row.updated_at),
        canonicalUrl: typeof row.canonical_url === "string" ? row.canonical_url : null,
        robotsIndex: typeof row.robots_index === "boolean" ? row.robots_index : null,
      }));
    },
    ["published-project-sitemap-rows"],
    { revalidate: 300, tags: ["projects"] },
  )();
}

export async function loadPublishedProjectSlugs(): Promise<string[]> {
  return (await loadPublishedProjectSitemapRows()).map((project) => project.slug);
}

async function mapLoadedProjectAggregate(
  project: PublicProjectRootRow,
  context: { identity: string; source: "marketing" | "track" | "admin-preview" },
): Promise<PublicProject> {
  const supabase = getSupabaseAdmin();
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
    throwReadError("Project aggregate child lookup failed", failedChild[1].error, {
      projectId,
      identity: context.identity,
      source: context.source,
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
    throwReadError("Project aggregate floor-plan details lookup failed", details.error, {
      projectId,
      identity: context.identity,
      source: context.source,
    });
  }

  try {
    return mapProjectAggregateToPublicProject({
      project,
      locations: locations.data ?? [],
      locationPoints: locationPoints.data ?? [],
      features: features.data ?? [],
      floorPlans: floorPlans.data ?? [],
      floorPlanDetails: details.data ?? [],
      deliveryItems: deliveryItems.data ?? [],
      media: media.data ?? [],
      videos: videos.data ?? [],
    });
  } catch (error) {
    logError("Project aggregate mapping failed", error, {
      projectId,
      identity: context.identity,
      source: context.source,
    });
    if (error instanceof PublicProjectMappingError) {
      throw new PublicProjectReadError("mapping_failed", "تعذر تجهيز بيانات المشروع للعرض.");
    }
    throw error;
  }
}

async function queryProjectBySlug(
  slug: string,
  source: "marketing" | "track",
): Promise<LoadProjectBySlugResult> {
  if (!PROJECT_SLUG_PATTERN.test(slug)) return { status: "invalid_slug", project: null };

  let request = getSupabaseAdmin()
    .from("projects")
    .select(PUBLIC_PROJECT_COLUMNS)
    .eq("slug", slug);
  if (source === "marketing") {
    request = request.eq("publication_status", "published");
  }
  const rootResult = await request.maybeSingle();

  if (rootResult.error) {
    throwReadError("Project root lookup failed", rootResult.error, { slug, source });
  }
  if (!rootResult.data) return { status: "not_found", project: null };

  return {
    status: "ok",
    project: await mapLoadedProjectAggregate(
      rootResult.data,
      { identity: slug, source },
    ),
  };
}

export const loadProjectBySlugResult = cache(async function loadProjectBySlugResult(
  slug: string,
): Promise<LoadProjectBySlugResult> {
  return unstable_cache(
    () => queryProjectBySlug(slug, "marketing"),
    ["public-project-clean-aggregate", slug],
    { revalidate: 300, tags: ["projects", "project"] },
  )();
});

/** Track keeps its pre-capability slug lookup semantics and is not Marketing visibility. */
export const loadTrackProjectBySlug = cache(async function loadTrackProjectBySlug(
  slug: string,
): Promise<PublicProject | null> {
  return unstable_cache(
    () => queryProjectBySlug(slug, "track"),
    ["track-project-clean-aggregate", slug],
    { revalidate: 300, tags: ["projects", "project"] },
  )().then((result) => result.project);
});

export const loadProjectForAdminPreviewResult = cache(
  async function loadProjectForAdminPreviewResult(
    id: number,
  ): Promise<LoadProjectAdminPreviewResult> {
    if (!Number.isSafeInteger(id) || id <= 0) {
      return { status: "invalid_id", project: null };
    }
    const { data, error } = await getSupabaseAdmin()
      .from("projects")
      .select(PUBLIC_PROJECT_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) throwReadError("Admin project preview root lookup failed", error, { id });
    if (!data) return { status: "not_found", project: null };

    const project = data;
    const publicationStatus = project.publication_status;
    if (
      publicationStatus !== "published" &&
      publicationStatus !== "unpublished"
    ) {
      throwReadError(
        "Admin project preview publication state invalid",
        new Error("invalid_project_publication_status"),
        { id },
      );
    }
    return {
      status: "ok",
      publicationStatus,
      project: await mapLoadedProjectAggregate(
        project,
        { identity: String(id), source: "admin-preview" },
      ),
    };
  },
);

export async function loadFeaturedProjects(): Promise<PublicProject[]> {
  return unstable_cache(
    () => queryPublicProjects(true),
    ["public-featured-projects-clean-aggregate"],
    { revalidate: 300, tags: ["projects"] },
  )();
}

export async function loadProjectsHubData(filterId: ProjectHubFilterId = "all") {
  const projects = await loadPublishedProjects();
  return {
    projects: getProjectsByFilter(projects, filterId),
    allProjects: [...projects],
    featuredProjects: projects.filter((project) => project.featured),
    stats: getProjectStats(projects),
  };
}
