import "server-only";

import type { QueryData } from "@supabase/supabase-js";
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
import type { PublicProject } from "./public-types";

const PUBLIC_PROJECT_COLUMNS = "id,type,arabic_name,english_name,slug,code,featured,show_on_homepage,homepage_order,brochure_url,publication_status,published_at,general_description,short_description,image,image_alt,hero_image,hero_image_alt,small_box_image,small_box_image_alt,governorate_id,city_id,main_area_id,sub_area_id,location_label,location_description,google_maps_url,latitude,longitude,map_zoom,location_title,overview_title,overview_body,overview_media_type,overview_main_image,overview_main_image_alt,plans_title,delivery_title,delivery_body,gallery_title,seo_title,seo_description,focus_keyword,seo_keywords,canonical_url,robots_index,robots_follow,og_image,og_image_alt,created_at,updated_at";

const PUBLIC_PROJECT_AGGREGATE_COLUMNS = `${PUBLIC_PROJECT_COLUMNS},governorate:project_locations!projects_governorate_id_fkey(id,level,parent_id,name_ar,name_en),city:project_locations!projects_city_id_fkey(id,level,parent_id,name_ar,name_en),main_area:project_locations!projects_main_area_id_fkey(id,level,parent_id,name_ar,name_en),sub_area:project_locations!projects_sub_area_id_fkey(id,level,parent_id,name_ar,name_en),location_points:project_location_points(id,kind,label,distance_text,sort_order),features:project_features(id,body,sort_order),floor_plans:project_floor_plans(id,name,area_text,featured,architectural_image,architectural_image_alt,furnishing_image,furnishing_image_alt,sort_order,details:project_floor_plan_details(id,floor_plan_id,label,value,sort_order)),delivery_items:project_delivery_items(id,body,sort_order),media:project_media(id,section,image,alt_text,sort_order),videos:project_videos(id,section,video_url,poster_image,poster_alt,sort_order)` as const;
const PUBLIC_PROJECT_MODEL_CACHE_VERSION = "section-title-contract-v2";

function selectPublicProjectAggregate() {
  return getSupabaseAdmin()
    .from("projects")
    .select(PUBLIC_PROJECT_AGGREGATE_COLUMNS);
}

type PublicProjectAggregateRow = QueryData<
  ReturnType<typeof selectPublicProjectAggregate>
>[number];

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

async function queryPublicProjects() {
  const request = getSupabaseAdmin()
    .from("projects")
    .select(PUBLIC_PROJECT_COLUMNS)
    .eq("publication_status", "published");
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
    () => queryPublicProjects(),
    ["public-projects-clean-aggregate", PUBLIC_PROJECT_MODEL_CACHE_VERSION],
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

function bySortOrder<Row extends { sort_order: number }>(left: Row, right: Row) {
  return left.sort_order - right.sort_order;
}

function mapLoadedProjectAggregate(
  project: PublicProjectAggregateRow,
  context: { identity: string; source: "marketing" | "track" | "admin-preview" },
): PublicProject {
  const projectId = Number(project.id);
  const locations = [
    project.governorate,
    project.city,
    project.main_area,
    project.sub_area,
  ].filter((row): row is PublicProjectLocationRow => row !== null);
  const floorPlans = [...project.floor_plans].sort(bySortOrder);
  const floorPlanDetails = floorPlans.flatMap((plan) =>
    [...plan.details].sort(bySortOrder),
  );

  try {
    return mapProjectAggregateToPublicProject({
      project,
      locations,
      locationPoints: [...project.location_points].sort(
        (left, right) => left.kind.localeCompare(right.kind) || bySortOrder(left, right),
      ),
      features: [...project.features].sort(bySortOrder),
      floorPlans,
      floorPlanDetails,
      deliveryItems: [...project.delivery_items].sort(bySortOrder),
      media: [...project.media].sort(
        (left, right) => left.section.localeCompare(right.section) || bySortOrder(left, right),
      ),
      videos: [...project.videos].sort(
        (left, right) => left.section.localeCompare(right.section) || bySortOrder(left, right),
      ),
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

  const request = selectPublicProjectAggregate()
    .eq("slug", slug)
    .eq("publication_status", "published");
  const rootResult = await request.maybeSingle();

  if (rootResult.error) {
    throwReadError("Project root lookup failed", rootResult.error, { slug, source });
  }
  if (!rootResult.data) return { status: "not_found", project: null };

  return {
    status: "ok",
    project: mapLoadedProjectAggregate(
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
    ["public-project-clean-aggregate", PUBLIC_PROJECT_MODEL_CACHE_VERSION, slug],
    { revalidate: 300, tags: ["projects", "project"] },
  )();
});

/** Tracking uses the same canonical public visibility truth as every public Project route. */
export const loadTrackProjectBySlug = cache(async function loadTrackProjectBySlug(
  slug: string,
): Promise<PublicProject | null> {
  return unstable_cache(
    () => queryProjectBySlug(slug, "track"),
    ["track-project-clean-aggregate", PUBLIC_PROJECT_MODEL_CACHE_VERSION, slug],
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
    const { data, error } = await selectPublicProjectAggregate()
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
      project: mapLoadedProjectAggregate(
        project,
        { identity: String(id), source: "admin-preview" },
      ),
    };
  },
);
